import { describe, it, expect, beforeEach } from "@jest/globals";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { cleanDb, createTestUser, getAdminDb, request } from "./helpers";
import { createUserWithPaidMembership } from "./test-utils";
import { forumImages, forumModerators } from "../db/schema";
import { cleanupUnattachedForumImages } from "../forum/forum-images";

type UploadedImage = { id: string; url: string; width: number; height: number };

// A JPEG with GPS coordinates in its EXIF, like a photo taken on the farm
async function photoWithGps(width = 3000, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 120, b: 60 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TestPhone" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "46/1 30/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "9/1 50/1 0/1" },
    })
    .toBuffer();
}

async function uploadFile(jwt: string, data: Buffer, type: string, filename: string) {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(data)], { type }), filename);
  return fetch(`${process.env.SERVER_URL}/v1/forum/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
}

async function uploadImage(jwt: string): Promise<UploadedImage> {
  const res = await uploadFile(jwt, await photoWithGps(800, 600), "image/jpeg", "photo.jpg");
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: UploadedImage }).data;
}

async function createThread(jwt: string, body: string) {
  return request("POST", "/v1/forum/threads", { title: "Weide", body, type: "general" }, jwt);
}

async function createThreadId(jwt: string, body: string): Promise<string> {
  const res = await createThread(jwt, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { id: string } }).data.id;
}

async function imageRow(imageId: string) {
  return getAdminDb().query.forumImages.findFirst({ where: { id: imageId } });
}

async function errorCode(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { code?: string }).code;
}

describe("Forum images", () => {
  beforeEach(cleanDb);

  it("stores an upload without metadata, downscaled to 2000 px and as WebP", async () => {
    const { jwt } = await createUserWithPaidMembership("author@test.com");
    const original = await photoWithGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const res = await uploadFile(jwt, original, "image/jpeg", "photo.jpg");
    expect(res.status).toBe(200);
    const uploaded = ((await res.json()) as { data: UploadedImage }).data;
    expect(uploaded).toMatchObject({ width: 2000, height: 1000 });

    const download = await fetch(uploaded.url);
    expect(download.status).toBe(200);
    const stored = await sharp(Buffer.from(await download.arrayBuffer())).metadata();
    expect(stored.format).toBe("webp");
    expect(stored.width).toBe(2000);
    expect(stored.exif).toBeUndefined();
    expect(stored.xmp).toBeUndefined();
  });

  it("rejects a file that isn't an image and requires a membership", async () => {
    const { jwt } = await createUserWithPaidMembership("author@test.com");
    const notAnImage = await uploadFile(jwt, Buffer.from("just text"), "image/png", "fake.png");
    expect(notAnImage.status).toBe(400);
    expect(await errorCode(notAnImage)).toBe("invalid_image");

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    const svgRes = await uploadFile(jwt, svg, "image/svg+xml", "image.svg");
    expect(svgRes.status).toBe(400);

    const { jwt: noMembershipJwt } = await createTestUser("nomem@test.com", "password123");
    const noMembership = await uploadFile(noMembershipJwt, await photoWithGps(100, 100), "image/jpeg", "a.jpg");
    expect(noMembership.status).toBe(403);
  });

  it("links an image to the thread that references it, others can't reuse it", async () => {
    const { jwt, userId } = await createUserWithPaidMembership("author@test.com");
    const image = await uploadImage(jwt);
    expect(await imageRow(image.id)).toMatchObject({ uploadedBy: userId, threadId: null, replyId: null });

    const threadId = await createThreadId(
      jwt,
      `Unsere Weide:\n\n![Weide](${image.url} "Juni")\n\n[Link](https://example.com)`
    );
    expect(await imageRow(image.id)).toMatchObject({ threadId, replyId: null });

    // Already in a post: not usable in another one, by nobody
    const { jwt: otherJwt } = await createUserWithPaidMembership("other@test.com");
    const reuseByOther = await createThread(otherJwt, `![](${image.url})`);
    expect(reuseByOther.status).toBe(400);
    expect(await errorCode(reuseByOther)).toBe("invalid_image_reference");
    const reuseByAuthor = await createThread(jwt, `![](${image.url})`);
    expect(reuseByAuthor.status).toBe(400);

    // Another user's unattached upload can't be used either
    const otherUpload = await uploadImage(otherJwt);
    const foreignUpload = await createThread(jwt, `![](${otherUpload.url})`);
    expect(foreignUpload.status).toBe(400);
    expect(await errorCode(foreignUpload)).toBe("invalid_image_reference");
  });

  it("rejects external and unknown image URLs", async () => {
    const { jwt } = await createUserWithPaidMembership("author@test.com");
    const external = await createThread(jwt, "![hotlink](https://example.com/cow.jpg)");
    expect(external.status).toBe(400);
    expect(await errorCode(external)).toBe("invalid_image_reference");

    const html = await createThread(jwt, '<img src="data:image/png;base64,AAAA">');
    expect(html.status).toBe(400);

    // Forms a simple regex misses but a Markdown renderer still shows as images
    for (const body of [
      "![a [b] c](https://example.com/nested.png)",
      "![a\\]b](https://example.com/escaped.png)",
      "![x][r]\n\n[r]: https://example.com/reference.png",
      // markdown-it alone would drop these destinations and see no image
      "![svg](data:image/svg+xml;base64,PHN2Zy8+)",
      // HTML images are rejected as a whole, attribute tricks included
      '<img alt=">" src="https://example.com/quoted.png">',
      '<img srcset="https://example.com/srcset.png 1x">',
      '<image src="https://example.com/alias.png">',
      '<input type="image" src="https://example.com/input.png">',
      '<video poster="https://example.com/poster.png"></video>',
      '<div style="background:url(https://example.com/css.png)">x</div>',
      '<object data="https://example.com/object.png"></object>',
      '<style>@import "https://example.com/x.css";</style>',
      '<link rel="stylesheet" href="https://example.com/x.css">',
      '<iframe srcdoc="&lt;img &#115;rc=https://example.com/frame.png&gt;"></iframe>',
      '<table background="https://example.com/table.png"><tr><td>x</td></tr></table>',
      '<div style="background:url&#40;https://example.com/entity.png)">x</div>',
    ]) {
      const res = await createThread(jwt, body);
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe("invalid_image_reference");
    }

    // Image syntax in code is an example, not an image
    const codeExamples = await createThread(
      jwt,
      "So: `![x](https://example.com/inline.png)`\n\n```\n![y](https://example.com/block.png)\n```"
    );
    expect(codeExamples.status).toBe(200);

    const image = await uploadImage(jwt);
    const unknown = await createThread(
      jwt,
      `![](${image.url.replace(/[0-9a-f-]{36}\.webp$/, "00000000-0000-4000-8000-000000000000.webp")})`
    );
    expect(unknown.status).toBe(400);
    expect(await errorCode(unknown)).toBe("invalid_image_reference");
  });

  it("an edit detaches removed images, the cleanup removes them once they are old", async () => {
    const { jwt } = await createUserWithPaidMembership("author@test.com");
    const keptImage = await uploadImage(jwt);
    const removedImage = await uploadImage(jwt);
    const threadId = await createThreadId(jwt, `![](${keptImage.url})\n![](${removedImage.url})`);

    const editRes = await request(
      "PATCH",
      `/v1/forum/threads/byId/${threadId}`,
      { body: `![](${keptImage.url})` },
      jwt
    );
    expect(editRes.status).toBe(200);
    expect(await imageRow(keptImage.id)).toMatchObject({ threadId });
    expect(await imageRow(removedImage.id)).toMatchObject({ threadId: null });

    // Recent uploads stay (they may still be posted), old unattached ones are removed with their file
    await cleanupUnattachedForumImages();
    expect(await imageRow(removedImage.id)).toBeDefined();
    const db = getAdminDb();
    await db
      .update(forumImages)
      .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .where(eq(forumImages.id, removedImage.id));
    await cleanupUnattachedForumImages();
    expect(await imageRow(removedImage.id)).toBeUndefined();
    expect((await fetch(removedImage.url)).status).toBe(404);
    expect((await fetch(keptImage.url)).status).toBe(200);
  });

  it("links images in replies, deleting the thread removes the images of the thread and its replies", async () => {
    const { jwt } = await createUserWithPaidMembership("author@test.com");
    const threadImage = await uploadImage(jwt);
    const threadId = await createThreadId(jwt, `![](${threadImage.url})`);

    const { jwt: replierJwt } = await createUserWithPaidMembership("replier@test.com");
    const replyImage = await uploadImage(replierJwt);
    const replyRes = await request(
      "POST",
      `/v1/forum/threads/byId/${threadId}/replies`,
      { body: `Bei uns so: ![](${replyImage.url})` },
      replierJwt
    );
    expect(replyRes.status).toBe(200);
    const replyId = ((await replyRes.json()) as { data: { id: string } }).data.id;
    expect(await imageRow(replyImage.id)).toMatchObject({ replyId, threadId: null });

    const deleteRes = await request("DELETE", `/v1/forum/threads/byId/${threadId}`, undefined, jwt);
    expect(deleteRes.status).toBe(200);
    expect(await imageRow(threadImage.id)).toBeUndefined();
    expect(await imageRow(replyImage.id)).toBeUndefined();
    expect((await fetch(threadImage.url)).status).toBe(404);
    expect((await fetch(replyImage.url)).status).toBe(404);
  });

  it("a moderator removes a single image, the post stays without it", async () => {
    const { jwt } = await createUserWithPaidMembership("author@test.com");
    const image = await uploadImage(jwt);
    // Nested brackets in the alt text, which a simple pattern wouldn't remove
    const threadId = await createThreadId(jwt, `Vorher\n\n![Bild [Juni]](${image.url})\n\nNachher`);

    const { jwt: otherJwt } = await createUserWithPaidMembership("other@test.com");
    const notModerator = await request("DELETE", `/v1/forum/images/byId/${image.id}`, undefined, otherJwt);
    expect(notModerator.status).toBe(403);

    const { jwt: moderatorJwt, userId: moderatorId } = await createUserWithPaidMembership("mod@test.com");
    await getAdminDb().insert(forumModerators).values({ userId: moderatorId });
    const removeRes = await request("DELETE", `/v1/forum/images/byId/${image.id}`, undefined, moderatorJwt);
    expect(removeRes.status).toBe(200);

    expect(await imageRow(image.id)).toBeUndefined();
    expect((await fetch(image.url)).status).toBe(404);
    const threadRes = await request("GET", `/v1/forum/threads/byId/${threadId}`, undefined, jwt);
    const thread = ((await threadRes.json()) as { data: { body: string } }).data;
    expect(thread.body).toContain("Vorher");
    expect(thread.body).toContain("Nachher");
    expect(thread.body).not.toContain(image.url);
  });

  it("limits uploads that aren't in a post yet", async () => {
    const { jwt, userId } = await createUserWithPaidMembership("author@test.com");
    await getAdminDb()
      .insert(forumImages)
      .values(
        Array.from({ length: 30 }, (_, index) => ({
          storagePath: `${userId}/00000000-0000-4000-8000-${String(index).padStart(12, "0")}.webp`,
          width: 10,
          height: 10,
          uploadedBy: userId,
        }))
      );
    const res = await uploadFile(jwt, await photoWithGps(100, 100), "image/jpeg", "a.jpg");
    expect(res.status).toBe(429);
    expect(await errorCode(res)).toBe("too_many_pending_images");
  });
});
