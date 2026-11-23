import { z } from "zod";

// Machine-readable error codes returned as `code` next to `error`, so clients can show a translated message.
export const apiErrorCodeSchema = z.enum([
  // the geometry has no area left after repairing it (e.g. fewer than 3 distinct points)
  "invalid_geometry",
  // the sowing unit doesn't match the seed's quantity kind (weight vs. count)
  "sowing_unit_mismatch",
  // the referenced seed doesn't exist (or belongs to another farm)
  "seed_not_found",
  // a crop was given that differs from the crop of the seed
  "sowing_crop_mismatch",
  // a sowing or sowing preset without a seed needs a crop
  "sowing_crop_required",
  // the referenced crop or plot doesn't exist (or belongs to another farm)
  "crop_not_found",
  "plot_not_found",
  // a seed's default amount only means something together with a default unit
  "seed_default_amount_without_unit",
  // some ear tag numbers of the requested range already exist on the farm
  "ear_tag_range_conflict",
  // the ear tag range is malformed (format, prefix, order) or larger than the allowed size
  "invalid_ear_tag_range",
  // the ear tag is assigned to an animal and can't be deleted
  "ear_tag_assigned",
  // another ear tag of the farm already has this number
  "ear_tag_number_taken",
  // the sire of a mating is the animal itself or not a male
  "invalid_sire",
  // an end date lies before its start date (e.g. a crop rotation, or its recurrence end before its end)
  "invalid_date_range",
  // the crop rotation overlaps another rotation of the same plot (recurrences included)
  "crop_rotation_overlap",
  // the outdoor schedule overlaps another schedule of the same herd
  "outdoor_schedule_overlap",
  // the outdoor schedule override overlaps another override of the same herd
  "outdoor_schedule_override_overlap",
  // the uploaded file is not a supported image (JPEG, PNG, WebP, GIF, AVIF; HEIC must be converted by the client) or too large
  "invalid_image",
  // a forum post references an image that wasn't uploaded to Coltivio, belongs to another post or another user
  "invalid_image_reference",
  // too many uploaded forum images that aren't in a saved post yet
  "too_many_pending_images",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

// Thrown by the domain layer. The result handler maps the code to an HTTP status and returns it to the client.
export class CodedError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "CodedError";
    this.code = code;
  }
}
