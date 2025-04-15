import * as Sentry from "@sentry/node";
import { captureException } from "@sentry/node";
import {
  ensureHttpError,
  getMessageFromError,
  ResultHandler,
} from "express-zod-api";
import { z } from "zod";

Sentry.init({
  dsn: "https://8b18180562cf0566d687b290646bc3ed@o4509156353638400.ingest.de.sentry.io/4509156391911504",
});

const sentryResultHandler = new ResultHandler({
  positive: (data) => ({
    schema: z.object({ data }),
    mimeType: "application/json",
  }),
  negative: z.object({ error: z.string() }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (error) {
      const { statusCode } = ensureHttpError(error);
      if (statusCode >= 500) {
        captureException(error, {
          extra: {
            input,
            request: {
              method: request.method,
              path: request.path,
              query: request.query,
              body: request.body,
            },
          },
        });
      }
      const message = getMessageFromError(error);
      return void response.status(statusCode).json({ error: message });
    }
    response.status(200).json({ data: output });
  },
});
