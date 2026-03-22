import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";
import { animalTypeSchema } from "../db/schema";

export const downloadTreatmentReport = farmEndpointFactory.build({
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
  handler: async ({ input, ctx }) => {
    const { buffer, fileName } = await ctx.treatmentReports.generateReportBuffer(
      input.fromDate,
      input.toDate,
      input.animalTypes
    );
    return { base64: buffer.toString("base64"), fileName };
  },
});
