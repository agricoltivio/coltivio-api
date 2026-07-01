import { z } from "zod";
import { permissionFarmEndpoint } from "../endpoint-factory";
import { ez } from "express-zod-api";
import { animalTypeSchema } from "../db/schema";
import { generateTreatmentReportBuffer } from "./treatment-reports";
import i18next from "i18next";

const treatmentsRead = permissionFarmEndpoint("animals", "read");

export const downloadTreatmentReport = treatmentsRead.build({
  method: "post",
  input: z.object({
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
    animalTypes: z.array(animalTypeSchema).optional(),
  }),
  output: z.object({
    base64: z.string(),
    fileName: z.string(),
  }),
  handler: async ({ input, ctx: { preferredLanguage } }) => {
    const t = i18next.getFixedT(preferredLanguage);
    const { buffer, fileName } = await generateTreatmentReportBuffer(
      input.fromDate,
      input.toDate,
      t,
      preferredLanguage,
      input.animalTypes
    );
    return { base64: buffer.toString("base64"), fileName };
  },
});
