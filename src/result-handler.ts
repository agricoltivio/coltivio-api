import { captureException } from "@sentry/node";
import { ensureHttpError, ResultHandler } from "express-zod-api";
import createHttpError, { HttpError } from "http-errors";
import { z } from "zod";
import { ApiErrorCode, apiErrorCodeSchema, CodedError } from "./errors";
// initializes Sentry before the first error can be captured
import "./sentry";

// Maps domain errors (CodedError) and HTTP errors to the JSON error response, reports server errors to Sentry
export const apiResultHandler = new ResultHandler({
  positive: (data) => ({
    schema: z.object({ data }),
    mimeType: "application/json",
  }),
  negative: z.object({ error: z.string(), code: apiErrorCodeSchema.optional() }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (error) {
      const code =
        error instanceof CodedError ? error.code : isReferenceViolation(error) ? "invalid_reference" : undefined;
      const httpError = code ? createHttpError(statusByErrorCode[code], error.message) : ensureHttpError(error);
      if (!httpError.expose) {
        logger.error("Server side error", { error, url: request.url, input });
      } else {
        logger.debug("Client side error", { error, url: request.url, input });
      }
      if (httpError.statusCode >= 500) {
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
      // coded errors carry a client-safe message, so it is not replaced by the generic status text. A raw foreign
      // key violation from the database gets a generic one (its own message names tables and constraints).
      const message =
        error instanceof CodedError
          ? httpError.message
          : code === "invalid_reference"
            ? "A referenced record doesn't exist or belongs to another farm"
            : getPublicErrorMessage(httpError);
      return void response.status(httpError.statusCode).json({ error: message, code });
    }
    response.status(200).json({ data: output });
  },
});

// An insert or update whose reference doesn't exist or points to another farm's record (Postgres foreign key
// violation 23503; the same-farm composite foreign keys reject the latter). Deletes blocked by a reference
// ("update or delete on table ...") are not meant and stay server errors. Drizzle wraps the driver error as cause.
function isReferenceViolation(error: Error): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current instanceof Error; depth++) {
    if ("code" in current && current.code === "23503") {
      return current.message.startsWith("insert or update on table");
    }
    current = current.cause;
  }
  return false;
}

const statusByErrorCode: Record<ApiErrorCode, number> = {
  invalid_geometry: 400,
  sowing_unit_mismatch: 400,
  seed_not_found: 400,
  sowing_crop_mismatch: 400,
  sowing_crop_required: 400,
  crop_not_found: 400,
  plot_not_found: 400,
  seed_default_amount_without_unit: 400,
  ear_tag_range_conflict: 409,
  invalid_ear_tag_range: 400,
  ear_tag_assigned: 409,
  ear_tag_number_taken: 409,
  invalid_sire: 400,
  invalid_date_range: 400,
  crop_rotation_overlap: 409,
  outdoor_schedule_overlap: 409,
  outdoor_schedule_override_overlap: 409,
  invalid_image: 400,
  invalid_image_reference: 400,
  too_many_pending_images: 429,
  invalid_reference: 400,
};

const getPublicErrorMessage = (error: HttpError): string =>
  process.env.NODE_ENV === "production" && !error.expose
    ? createHttpError(error.statusCode).message // default message for that code
    : error.message;
