import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";

export const downloadOutdoorJournalReport = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
  }),
  output: z.object({
    base64: z.string(),
    fileName: z.string(),
  }),
  handler: async ({ input, ctx }) => {
    const { buffer, fileName } =
      await ctx.outdoorJournalReports.generateReportBuffer(
        input.fromDate,
        input.toDate,
      );
    return { base64: buffer.toString("base64"), fileName };
  },
});
