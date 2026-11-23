import { and, count, eq, gt, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { adminDrizzle, RlsDb, Transaction } from "../db/db";
import { forumImages, forumReplies, forumThreads } from "../db/schema";
import { CodedError } from "../errors";
import { forumImagesStorage } from "../supabase/supabase";

export type ForumImage = typeof forumImages.$inferSelect;
export type UploadedForumImage = { id: string; url: string; width: number; height: number };
export type ForumPost = { kind: "thread"; id: string } | { kind: "reply"; id: string };

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
// Longest side after downscaling
const MAX_DIMENSION_PX = 2000;
const WEBP_QUALITY = 80;
// SVG and TIFF are left out on purpose (SVG can carry scripts and external references)
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "gif", "heif"]);
// Uploads not yet in a saved post, per user within PENDING_WINDOW_MS. Stops filling the public bucket
// with images that are never posted.
const MAX_PENDING_IMAGES_PER_USER = 30;
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
// Our storage paths: <uploader id>/<image uuid>.webp
const STORAGE_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

// Public URL of a storage path, and the prefix every forum image URL starts with
export function forumImagePublicUrl(storagePath: string): string {
  return forumImagesStorage.getPublicUrl(storagePath).data.publicUrl;
}
function forumImageUrlPrefix(): string {
  const placeholder = "__path__";
  return forumImagePublicUrl(placeholder).slice(0, -placeholder.length);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Image URLs referenced in a Markdown body: ![alt](url "title"), ![alt](<url>) and <img src="url">
export function extractImageUrls(markdown: string): string[] {
  const markdownImageUrls = [...markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)/g)].map((match) => match[1]);
  const htmlImageUrls = [...markdown.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']?([^"'\s>]+)/gi)].map((match) => match[1]);
  return [...markdownImageUrls, ...htmlImageUrls];
}

// The storage path of one of our forum image URLs, null for any other URL (external, data:, other buckets)
export function storagePathFromUrl(url: string): string | null {
  const prefix = forumImageUrlPrefix();
  if (!url.startsWith(prefix)) return null;
  const storagePath = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
  return STORAGE_PATH_PATTERN.test(storagePath) ? storagePath : null;
}

// Removes every reference to the image URL from a Markdown body (used when a moderator removes an image)
export function removeImageReferences(markdown: string, imageUrl: string): string {
  const escapedUrl = escapeRegExp(imageUrl);
  return markdown
    .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*<?${escapedUrl}[^)]*\\)`, "g"), "")
    .replace(new RegExp(`<img\\b[^>]*?\\ssrc\\s*=\\s*["']?${escapedUrl}[^>]*>`, "gi"), "");
}

// Links the images a post body references to the post and detaches the ones no longer referenced (the cleanup cron
// removes those). Every image in the body has to be one of our uploads that is either already in this post or an
// unattached upload of the author; anything else (external URLs, another user's or another post's image) is
// rejected, so the Markdown can't hotlink. Runs inside the post's RLS transaction.
export async function syncPostImages(tx: Transaction, post: ForumPost, body: string, authorId: string): Promise<void> {
  const postColumn = post.kind === "thread" ? forumImages.threadId : forumImages.replyId;
  const referencedPaths = new Set<string>();
  for (const url of extractImageUrls(body)) {
    const storagePath = storagePathFromUrl(url);
    if (!storagePath) {
      throw new CodedError("invalid_image_reference", "Images in posts must be uploaded to Coltivio");
    }
    referencedPaths.add(storagePath);
  }

  const referencedImages =
    referencedPaths.size > 0
      ? await tx
          .select()
          .from(forumImages)
          .where(inArray(forumImages.storagePath, [...referencedPaths]))
      : [];
  if (referencedImages.length !== referencedPaths.size) {
    throw new CodedError("invalid_image_reference", "The post references an unknown image");
  }
  for (const image of referencedImages) {
    const isInThisPost = post.kind === "thread" ? image.threadId === post.id : image.replyId === post.id;
    const isOwnUnattachedUpload = image.threadId === null && image.replyId === null && image.uploadedBy === authorId;
    if (!isInThisPost && !isOwnUnattachedUpload) {
      throw new CodedError("invalid_image_reference", "The image belongs to another post");
    }
  }

  const referencedIds = referencedImages.map((image) => image.id);
  // Detach images that were removed from the body
  await tx
    .update(forumImages)
    .set(post.kind === "thread" ? { threadId: null } : { replyId: null })
    .where(
      referencedIds.length > 0
        ? and(eq(postColumn, post.id), notInArray(forumImages.id, referencedIds))
        : eq(postColumn, post.id)
    );
  if (referencedIds.length > 0) {
    await tx
      .update(forumImages)
      .set(post.kind === "thread" ? { threadId: post.id } : { replyId: post.id })
      .where(inArray(forumImages.id, referencedIds));
  }
}

// Removes image files and rows. A row is only deleted once its file is gone, so a failed removal is retried by the cron.
async function removeImages(images: Pick<ForumImage, "id" | "storagePath">[]): Promise<void> {
  if (images.length === 0) return;
  const { error } = await forumImagesStorage.remove(images.map((image) => image.storagePath));
  if (error) throw new Error(`Failed to remove forum images from storage: ${error.message}`);
  await adminDrizzle.delete(forumImages).where(
    inArray(
      forumImages.id,
      images.map((image) => image.id)
    )
  );
}

// Images of a thread and all its replies, or of a single reply; removed right away when the post is deleted, so a
// deleted (e.g. moderated) post's images don't stay reachable until the next cron run
export async function removeImagesOfThread(threadId: string): Promise<void> {
  const images = await adminDrizzle
    .select({ id: forumImages.id, storagePath: forumImages.storagePath })
    .from(forumImages)
    .leftJoin(forumReplies, eq(forumReplies.id, forumImages.replyId))
    .where(or(eq(forumImages.threadId, threadId), eq(forumReplies.threadId, threadId)));
  await removeImages(images);
}
export async function removeImagesOfReply(replyId: string): Promise<void> {
  const images = await adminDrizzle
    .select({ id: forumImages.id, storagePath: forumImages.storagePath })
    .from(forumImages)
    .where(eq(forumImages.replyId, replyId));
  await removeImages(images);
}

// Unattached images older than the pending window: never posted, or detached by an edit or a deleted post
export async function cleanupUnattachedForumImages(): Promise<number> {
  const unattachedImages = await adminDrizzle
    .select({ id: forumImages.id, storagePath: forumImages.storagePath })
    .from(forumImages)
    .where(
      and(
        isNull(forumImages.threadId),
        isNull(forumImages.replyId),
        lt(forumImages.createdAt, new Date(Date.now() - PENDING_WINDOW_MS))
      )
    );
  await removeImages(unattachedImages);
  return unattachedImages.length;
}

export function forumImagesApi(db: RlsDb) {
  return {
    // Re-encodes the upload before storing it: applies the EXIF orientation, then drops all metadata (EXIF with
    // GPS, XMP, ICC), downscales to MAX_DIMENSION_PX and writes WebP. The original bytes are never stored.
    async uploadImage(uploadedBy: string, file: { data: Buffer; size: number }): Promise<UploadedForumImage> {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new CodedError("invalid_image", `The image is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
      }

      const [{ pendingCount }] = await db.rls((tx) =>
        tx
          .select({ pendingCount: count() })
          .from(forumImages)
          .where(
            and(
              eq(forumImages.uploadedBy, uploadedBy),
              isNull(forumImages.threadId),
              isNull(forumImages.replyId),
              gt(forumImages.createdAt, new Date(Date.now() - PENDING_WINDOW_MS))
            )
          )
      );
      if (pendingCount >= MAX_PENDING_IMAGES_PER_USER) {
        throw new CodedError("too_many_pending_images", "Too many uploaded images that aren't in a post yet");
      }

      const inputFormat = await sharp(file.data)
        .metadata()
        .then((metadata) => metadata.format)
        .catch(() => undefined);
      if (!inputFormat || !ALLOWED_INPUT_FORMATS.has(inputFormat)) {
        throw new CodedError("invalid_image", "The file is not a supported image");
      }
      // Animated GIFs keep only their first frame
      const { data: encoded, info } = await sharp(file.data)
        .rotate()
        .resize({ width: MAX_DIMENSION_PX, height: MAX_DIMENSION_PX, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true })
        .catch(() => {
          throw new CodedError("invalid_image", "The image could not be read");
        });

      const storagePath = `${uploadedBy}/${randomUUID()}.webp`;
      const { error } = await forumImagesStorage.upload(storagePath, encoded, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error(`Failed to upload forum image: ${error.message}`);

      const [image] = await db.rls((tx) =>
        tx.insert(forumImages).values({ storagePath, width: info.width, height: info.height, uploadedBy }).returning()
      );
      return { id: image.id, url: forumImagePublicUrl(storagePath), width: image.width, height: image.height };
    },

    // Moderators: removes one image from storage and from the post's Markdown, the post itself stays
    async removeImageAsModerator(imageId: string): Promise<boolean> {
      const image = await db.admin.query.forumImages.findFirst({ where: { id: imageId } });
      if (!image) return false;
      const imageUrl = forumImagePublicUrl(image.storagePath);
      if (image.threadId) {
        const thread = await db.admin.query.forumThreads.findFirst({ where: { id: image.threadId } });
        if (thread) {
          await db.admin
            .update(forumThreads)
            .set({ body: removeImageReferences(thread.body, imageUrl) })
            .where(eq(forumThreads.id, thread.id));
        }
      }
      if (image.replyId) {
        const reply = await db.admin.query.forumReplies.findFirst({ where: { id: image.replyId } });
        if (reply) {
          await db.admin
            .update(forumReplies)
            .set({ body: removeImageReferences(reply.body, imageUrl) })
            .where(eq(forumReplies.id, reply.id));
        }
      }
      await removeImages([image]);
      return true;
    },
  };
}
