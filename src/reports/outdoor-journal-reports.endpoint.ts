import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";

export const downloadOutdoorJournalReport = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    year: z.number().int().min(2000).max(2100),
  }),
  output: z.object({
    base64: z.string(),
    fileName: z.string(),
  }),
  handler: async ({ input, ctx }) => {
    const { buffer, fileName } =
      await ctx.outdoorJournalReports.generateReportBuffer(input.year);
    return { base64: buffer.toString("base64"), fileName };
  },
});
