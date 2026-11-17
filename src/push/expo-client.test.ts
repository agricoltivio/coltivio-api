import { describe, it, expect, afterEach, jest } from "@jest/globals";
import { postToExpo } from "./expo-client";

describe("postToExpo", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends every message with the default sound and the app's Android channel", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }), { status: 200 }));

    const tickets = await postToExpo([
      { to: "ExponentPushToken[test]", title: "Titel", body: "Text", data: { taskId: "task-1" } },
    ]);

    expect(tickets).toEqual([{ status: "ok", id: "ticket-1" }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual([
      {
        to: "ExponentPushToken[test]",
        title: "Titel",
        body: "Text",
        data: { taskId: "task-1" },
        sound: "default",
        channelId: "reminders",
      },
    ]);
  });
});
