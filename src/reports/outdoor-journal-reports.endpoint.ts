import { z } from "zod";
import { permissionFarmEndpoint } from "../endpoint-factory";
import { ez } from "express-zod-api";
import { generateOutdoorJournalReportBuffer } from "./outdoor-journal-reports";
import i18next from "i18next";

const animalsRead = permissionFarmEndpoint("animals", "read");

export const downloadOutdoorJournalReport = animalsRead.build({
  method: "post",
  input: z.object({
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
  }),
  output: z.object({
    base64: z.string(),
    fileName: z.string(),
  }),
  handler: async ({ input, ctx: { preferredLanguage } }) => {
    const t = i18next.getFixedT(preferredLanguage);
    const { buffer, fileName } = await generateOutdoorJournalReportBuffer(
      input.fromDate,
      input.toDate,
      t,
      preferredLanguage
    );
    return { base64: buffer.toString("base64"), fileName };
  },
});
