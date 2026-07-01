import { z } from "zod";
import { permissionFarmEndpoint } from "../endpoint-factory";
import { ez } from "express-zod-api";
import { generateFieldCalendarReportBuffer } from "./field-calendar-reports";
import i18next from "i18next";

// Gated by plots read as the minimum — the report aggregates crop_rotations, tillages,
// fertilization, crop_protection, and harvests, but requires at least field-level access.
const plotsRead = permissionFarmEndpoint("field_calendar", "read");

const fieldCalendarReportInput = z.object({
  fromDate: ez.dateIn(),
  toDate: ez.dateIn(),
  generateCropRotations: z.boolean(),
  generateTillages: z.boolean(),
  generateFertilizerApplications: z.boolean(),
  generateCropProtectionApplications: z.boolean(),
  generateHarvests: z.boolean(),
});

export const downloadFieldCalendarReport = plotsRead.build({
  method: "post",
  input: fieldCalendarReportInput,
  output: z.object({
    base64: z.string(),
    fileName: z.string(),
  }),
  handler: async ({ input, ctx: { preferredLanguage } }) => {
    const t = i18next.getFixedT(preferredLanguage);
    const { buffer, fileName } = await generateFieldCalendarReportBuffer(
      input.fromDate,
      input.toDate,
      t,
      preferredLanguage,
      {
        cropRotations: input.generateCropRotations,
        tillages: input.generateTillages,
        fertilizerApplications: input.generateFertilizerApplications,
        cropProtectionApplications: input.generateCropProtectionApplications,
        harvests: input.generateHarvests,
      }
    );
    return { base64: buffer.toString("base64"), fileName };
  },
});
