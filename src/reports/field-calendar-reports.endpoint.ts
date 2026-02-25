import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";

const fieldCalendarReportInput = z.object({
  fromDate: ez.dateIn(),
  toDate: ez.dateIn(),
  generateCropRotations: z.boolean(),
  generateTillages: z.boolean(),
  generateFertilizerApplications: z.boolean(),
  generateCropProtectionApplications: z.boolean(),
  generateHarvests: z.boolean(),
});

export const sendFieldCalendarReport = farmEndpointFactory.build({
  method: "post",
  input: fieldCalendarReportInput,
  output: z.object({}),
  handler: async ({ input, ctx }) => {
    await ctx.fieldCalendarReports.generateReport(
      ctx.user.id,
      input.fromDate,
      input.toDate,
      input.generateCropRotations,
      input.generateTillages,
      input.generateFertilizerApplications,
      input.generateCropProtectionApplications,
      input.generateHarvests,
    );
    return {};
  },
});

export const downloadFieldCalendarReport = farmEndpointFactory.build({
  method: "post",
  input: fieldCalendarReportInput,
  output: z.object({
    base64: z.string(),
    fileName: z.string(),
  }),
  handler: async ({ input, ctx }) => {
    const { buffer, fileName } =
      await ctx.fieldCalendarReports.generateReportBuffer(
        input.fromDate,
        input.toDate,
        input.generateCropRotations,
        input.generateTillages,
        input.generateFertilizerApplications,
        input.generateCropProtectionApplications,
        input.generateHarvests,
      );
    return { base64: buffer.toString("base64"), fileName };
  },
});
