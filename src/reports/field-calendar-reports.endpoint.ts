import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";

export const generateFieldCalendarReport = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
    generateCropRotations: z.boolean(),
    generateTillages: z.boolean(),
    generateFertilizerApplications: z.boolean(),
    generateCropProtectionApplications: z.boolean(),
    generateHarvests: z.boolean(),
  }),
  output: z.object({}),
  handler: async ({ input, options }) => {
    await options.fieldCalendarReports.generateReport(
      options.user.id,
      input.fromDate,
      input.toDate,
      input.generateCropRotations,
      input.generateTillages,
      input.generateFertilizerApplications,
      input.generateCropProtectionApplications,
      input.generateHarvests
    );
    return {};
  },
});
