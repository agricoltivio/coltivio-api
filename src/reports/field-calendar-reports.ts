import * as Sentry from "@sentry/node";
import ExcelJS from "exceljs";
import { TFunction } from "i18next";
import { txEmailApi } from "../brevo/brevo";
import { RlsDb } from "../db/db";

export function fieldCalendarReportsApi(
  rlsDb: RlsDb,
  t: TFunction,
  locale: string = "de",
) {
  return {
    async generateReportBuffer(
      fromDate: Date,
      toDate: Date,
      cropRotations: boolean,
      tillages: boolean,
      fertilizerApplications: boolean,
      cropProtectionApplications: boolean,
      harvests: boolean,
    ): Promise<{ buffer: Buffer; fileName: string }> {
      const selectedFlags = {
        cropRotations,
        tillages,
        fertilizerApplications,
        cropProtectionApplications,
        harvests,
      };
      return await rlsDb.rls(async (tx) => {
        const plots = await tx.query.plots.findMany({
          with: {
            cropRotations: {
              orderBy: { fromDate: "desc" },
              with: { crop: true },
              where: {
                AND: [
                  { fromDate: { gte: fromDate } },
                  { fromDate: { lte: toDate } },
                ],
              },
            },
            tillages: {
              orderBy: { date: "desc" },
              where: {
                AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }],
              },
            },
            harvests: {
              with: { crop: true },
              orderBy: { date: "desc" },
              where: {
                AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }],
              },
            },
            fertilizerApplications: {
              with: { fertilizer: true },
              orderBy: { date: "desc" },
              where: {
                AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }],
              },
            },
            cropProtectionApplications: {
              with: { product: true },
              orderBy: { dateTime: "desc" },
              where: {
                AND: [
                  { dateTime: { gte: fromDate } },
                  { dateTime: { lte: toDate } },
                ],
              },
            },
          },
        });

        const workbook = new ExcelJS.Workbook();
        generateMainSheet();
        generatePerPlotSheet();

        function generateMainSheet() {
          const cropRotationRows: any[][] = [];
          const tillageRows: any[][] = [];
          const fertilizerApplicationRows: any[][] = [];
          const cropProtectionApplicationRows: any[][] = [];
          const harvestRows: any[][] = [];

          for (const plot of plots) {
            if (cropRotations) {
              plot.cropRotations.forEach((cropRotation) => {
                cropRotationRows.push([
                  plot.name,
                  plot.usage,
                  cropRotation.fromDate.toLocaleDateString(locale),
                  cropRotation.toDate?.toLocaleDateString(locale) ?? "",
                  cropRotation.crop.name,
                ]);
              });
            }

            if (tillages) {
              plot.tillages.forEach((tillage) => {
                tillageRows.push([
                  plot.name,
                  plot.usage,
                  tillage.date.toLocaleDateString(locale),
                  (tillage.size / 100).toFixed(2),
                  tillage.reason ? t(`tillages.reasons.${tillage.reason}`) : "",
                  t(`tillages.actions.${tillage.action}`),
                ]);
              });
            }

            if (fertilizerApplications) {
              plot.fertilizerApplications.forEach((application) => {
                fertilizerApplicationRows.push([
                  plot.name,
                  plot.usage,
                  application.date.toLocaleDateString(locale),
                  (application.size / 100).toFixed(2),
                  application.fertilizer.name,
                  t(`units.short.${application.fertilizer.unit}`),
                  t(`application_units.${application.unit}`),
                  application.numberOfUnits,
                  application.amountPerUnit,
                  application.amountPerUnit * application.numberOfUnits,
                ]);
              });
            }

            if (cropProtectionApplications) {
              plot.cropProtectionApplications.forEach((application) => {
                cropProtectionApplicationRows.push([
                  plot.name,
                  plot.usage,
                  application.dateTime.toLocaleDateString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  (application.size / 100).toFixed(2),
                  application.product.name,
                  t(`units.short.${application.product.unit}`),
                  t(`application_units.${application.unit}`),
                  application.numberOfUnits,
                  application.amountPerUnit,
                  application.amountPerUnit * application.numberOfUnits,
                ]);
              });
            }

            if (harvests) {
              plot.harvests.forEach((harvest) => {
                harvestRows.push([
                  plot.name,
                  plot.usage,
                  harvest.date.toLocaleDateString(locale),
                  (harvest.size / 100).toFixed(2),
                  harvest.crop.name,
                  t(`harvests.labels.harvest_units.${harvest.unit}`),
                  harvest.conservationMethod
                    ? t(
                        `harvests.labels.conservation_method.${harvest.conservationMethod}`,
                      )
                    : "",
                  harvest.numberOfUnits,
                  harvest.kilosPerUnit,
                  harvest.numberOfUnits * harvest.kilosPerUnit,
                ]);
              });
            }
          }

          const sheet = workbook.addWorksheet(
            t("field_calendar_report.sheet_titles.main_short"),
          );
          let rowIndex = 1;
          sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
          const mainTitle = sheet.getCell(`A${rowIndex}`);
          mainTitle.value = t(
            "field_calendar_report.sheet_titles.main",
            {
              fromDate: fromDate.toLocaleDateString("de", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              toDate: toDate.toLocaleDateString("de", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          );
          mainTitle.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
          mainTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
          mainTitle.alignment = { vertical: "middle" };
          rowIndex += 3;

          if (cropRotations && cropRotationRows.length > 0) {
            // crop rotations table
            sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
            sheet.getCell(`A${rowIndex}`).value = t(
              "crop_rotations.crop_rotation",
            );
            sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            rowIndex += 2;

            sheet.addTable({
              name: "main_crop_rotations",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("plots.plot") },
                { name: t("plots.usage") },
                { name: t("common.from") },
                { name: t("common.to") },
                { name: t("crops.crop") },
              ],
              rows: cropRotationRows,
            });
            rowIndex += cropRotationRows.length + 3;
          }

          if (tillages && tillageRows.length > 0) {
            //tillages table
            sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
            sheet.getCell(`A${rowIndex}`).value = t("tillages.tillage");
            sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            rowIndex += 2;

            sheet.addTable({
              name: "main_tillages",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("plots.plot") },
                { name: t("plots.usage") },
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("common.reason") },
                { name: t("common.action") },
              ],
              rows: tillageRows,
            });
            rowIndex += tillageRows.length + 3;
          }

          if (fertilizerApplications && fertilizerApplicationRows.length > 0) {
            // table fertilizer applications
            sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
            sheet.getCell(`A${rowIndex}`).value = t(
              "fertilizer_applications.fertilizer_application",
            );
            sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            rowIndex += 2;

            sheet.addTable({
              name: "main_fertilizer_applications",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("plots.plot") },
                { name: t("plots.usage") },
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("fertilizer_applications.fertilizer") },
                { name: t("common.unit") },
                { name: t("common.application_unit") },
                { name: t("common.number_of_application_units") },
                { name: t("common.amount_per_application_unit") },
                { name: t("common.total") },
              ],
              rows: fertilizerApplicationRows,
            });
            rowIndex += fertilizerApplicationRows.length + 3;
          }

          if (
            cropProtectionApplications &&
            cropProtectionApplicationRows.length > 0
          ) {
            // table crop protection applications
            sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
            sheet.getCell(`A${rowIndex}`).value = t(
              "crop_protections.crop_protection",
            );
            sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            rowIndex += 2;

            sheet.addTable({
              name: "main_crop_protection_applications",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("plots.plot") },
                { name: t("plots.usage") },
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("crop_protections.product") },
                { name: t("common.unit") },
                { name: t("common.application_unit") },
                { name: t("common.number_of_application_units") },
                { name: t("common.amount_per_application_unit") },
                { name: t("common.total") },
              ],
              rows: cropProtectionApplicationRows,
            });

            rowIndex += cropProtectionApplicationRows.length + 3;
          }

          if (harvests && harvestRows.length > 0) {
            // table harvests
            sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
            sheet.getCell(`A${rowIndex}`).value = t("harvests.harvest");
            sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            rowIndex += 2;

            sheet.addTable({
              name: "main_harvests",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("plots.plot") },
                { name: t("plots.usage") },
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("crops.crop") },
                { name: t("harvests.application_unit") },
                { name: t("harvests.conservation") },
                { name: t("harvests.produced_units") },
                { name: t("harvests.kilos_per_unit") },
                { name: t("harvests.total_kilos") },
              ],
              rows: harvestRows,
            });
            rowIndex += harvestRows.length + 3;
          }
        }

        function generatePerPlotSheet() {
          const sheet = workbook.addWorksheet(
            t("field_calendar_report.sheet_titles.per_plot_short"),
          );
          let rowIndex = 1;

          sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
          const perPlotTitle = sheet.getCell(`A${rowIndex}`);
          perPlotTitle.value = t(
            "field_calendar_report.sheet_titles.per_plot",
            {
              fromDate: fromDate.toLocaleDateString("de", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              toDate: toDate.toLocaleDateString("de", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          );
          perPlotTitle.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
          perPlotTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
          perPlotTitle.alignment = { vertical: "middle" };
          rowIndex += 3;

          let plotIndex = 0;
          for (const plot of plots) {
            if (
              (
                Object.entries(selectedFlags) as Array<
                  [keyof typeof selectedFlags, boolean]
                >
              ).every(
                ([key, isSelected]) => !isSelected || plot[key].length === 0,
              )
            ) {
              continue;
            }

            const { name, size, usage } = plot;

            // Plot banner
            sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
            const plotBanner = sheet.getCell(`A${rowIndex}`);
            plotBanner.value = `${t("plots.plot")}: ${name}`;
            plotBanner.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            plotBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
            plotBanner.alignment = { vertical: "middle" };
            rowIndex += 2;

            // Plot details
            const detailFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
            sheet.getCell(`A${rowIndex}`).value = t("plots.usage");
            sheet.getCell(`A${rowIndex}`).font = { bold: true };
            sheet.getCell(`A${rowIndex}`).fill = detailFill;
            sheet.getCell(`B${rowIndex}`).value = usage ?? t("common.unknown");
            rowIndex++;
            sheet.getCell(`A${rowIndex}`).value = t("common.size_ha");
            sheet.getCell(`A${rowIndex}`).font = { bold: true };
            sheet.getCell(`A${rowIndex}`).fill = detailFill;
            sheet.getCell(`B${rowIndex}`).value = (size / 10000).toFixed(2);
            rowIndex++;
            sheet.getCell(`A${rowIndex}`).value = t("crops.crop");
            sheet.getCell(`A${rowIndex}`).font = { bold: true };
            sheet.getCell(`A${rowIndex}`).fill = detailFill;
            sheet.getCell(`B${rowIndex}`).value =
              plot.cropRotations[0]?.crop.name;
            rowIndex += 2;

            const addSection = <T>(
              title: string,
              headers: Array<{ key: keyof T; value: string }>,
              data: T[],
              index: number,
            ) => {
              if (data.length > 0) {
                sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
                sheet.getCell(`A${rowIndex}`).value = title;
                sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
                sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
                rowIndex++;

                const tableRows = data.map((entry) =>
                  headers.map((header) => entry[header.key] || ""),
                );
                sheet.addTable({
                  name: `${title}_${name}_${index}`.replace(/[^a-zA-Z0-9_]/g, "_"),
                  ref: `A${rowIndex}`,
                  headerRow: true,
                  style: { showRowStripes: true },
                  columns: headers.map((header, i) => ({ name: header.value })),
                  rows: tableRows,
                });

                rowIndex += tableRows.length + 3;
              }
            };
            if (cropRotations) {
              addSection(
                t("crop_rotations.crop_rotation"),
                [
                  { key: "fromDate", value: t("common.from") },
                  { key: "toDate", value: t("common.to") },
                  { key: "crop", value: t("crops.crop") },
                ],
                plot.cropRotations.map((cropRotation) => ({
                  fromDate: cropRotation.fromDate.toLocaleDateString(locale),
                  toDate: cropRotation.toDate?.toLocaleDateString(locale),
                  crop: cropRotation.crop.name,
                })),
                plotIndex,
              );
            }

            if (tillages) {
              addSection(
                t("tillages.tillage"),
                [
                  { key: "date", value: t("common.date") },
                  { key: "size", value: t("common.size_a") },
                  { key: "reason", value: t("common.reason") },
                  { key: "action", value: t("common.action") },
                ],
                plot.tillages.map((tillage) => ({
                  date: tillage.date.toLocaleDateString(locale),
                  size: (tillage.size / 100).toFixed(2),
                  reason: tillage.reason
                    ? t(`tillages.reasons.${tillage.reason}`)
                    : "",
                  action: t(`tillages.actions.${tillage.action}`),
                })),
                plotIndex,
              );
            }

            if (fertilizerApplications) {
              addSection(
                t("fertilizer_applications.fertilizer_application"),
                [
                  { key: "date", value: t("common.date") },
                  { key: "size", value: t("common.size_a") },
                  {
                    key: "fertilizer",
                    value: t("fertilizer_applications.fertilizer"),
                  },
                  { key: "unit", value: t("common.unit") },
                  { key: "applicationUnit", value: t("common.application_unit") },
                  {
                    key: "numberOfUnits",
                    value: t("common.number_of_application_units"),
                  },
                  {
                    key: "amountPerUnit",
                    value: t("common.amount_per_application_unit"),
                  },
                  {
                    key: "total",
                    value: t("common.total"),
                  },
                ],
                plot.fertilizerApplications.map((application) => ({
                  date: application.date.toLocaleDateString(locale),
                  size: (application.size / 100).toFixed(2),
                  fertilizer: application.fertilizer.name,
                  unit: t(`units.short.${application.fertilizer.unit}`),
                  applicationUnit: t(`application_units.${application.unit}`),
                  numberOfUnits: application.numberOfUnits,
                  amountPerUnit: application.amountPerUnit,
                  total: application.amountPerUnit * application.numberOfUnits,
                })),
                plotIndex,
              );
            }

            if (cropProtectionApplications) {
              addSection(
                t("crop_protections.crop_protection"),
                [
                  { key: "date", value: t("common.date") },
                  { key: "size", value: t("common.size_a") },
                  {
                    key: "product",
                    value: t("crop_protections.product"),
                  },
                  { key: "unit", value: t("common.unit") },
                  { key: "applicationUnit", value: t("common.application_unit") },
                  {
                    key: "numberOfUnits",
                    value: t("common.number_of_application_units"),
                  },
                  {
                    key: "amountPerUnit",
                    value: t("common.amount_per_application_unit"),
                  },
                  {
                    key: "total",
                    value: t("common.total"),
                  },
                ],
                plot.cropProtectionApplications.map((application) => ({
                  date: application.dateTime.toLocaleDateString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  size: (application.size / 100).toFixed(2),
                  product: application.product.name,
                  unit: t(`units.short.${application.product.unit}`),
                  applicationUnit: t(`application_units.${application.unit}`),
                  numberOfUnits: application.numberOfUnits,
                  amountPerUnit: application.amountPerUnit,
                  total: application.amountPerUnit * application.numberOfUnits,
                })),
                plotIndex,
              );
            }

            if (harvests) {
              addSection(
                t("harvests.harvest"),
                [
                  { key: "date", value: t("common.date") },
                  { key: "size", value: t("common.size_a") },
                  { key: "crop", value: t("crops.crop") },
                  {
                    key: "processingType",
                    value: t(`harvests.application_unit`),
                  },
                  {
                    key: "conservationMethod",
                    value: t("harvests.conservation"),
                  },
                  {
                    key: "producedUnits",
                    value: t("harvests.produced_units"),
                  },
                  {
                    key: "kilosPerUnit",
                    value: t("harvests.kilos_per_unit"),
                  },
                  {
                    key: "totalKilos",
                    value: t("harvests.total_kilos"),
                  },
                ],
                plot.harvests.map((harvest) => ({
                  date: harvest.date.toLocaleDateString(locale),
                  size: (harvest.size / 100).toFixed(2),
                  crop: harvest.crop.name,
                  processingType: t(
                    `harvests.labels.harvest_units.${harvest.unit}`,
                  ),
                  conservationMethod: harvest.conservationMethod
                    ? t(
                        `harvests.labels.conservation_method.${harvest.conservationMethod}`,
                      )
                    : "",
                  producedUnits: harvest.numberOfUnits,
                  kilosPerUnit: harvest.kilosPerUnit,
                  totalKilos: harvest.numberOfUnits * harvest.kilosPerUnit,
                })),
                plotIndex,
              );
            }
            plotIndex++;
          }
        }

        const fileName = `${t("field_calendar_report.file_name", { fromDate: fromDate.toLocaleDateString("de"), toDate: toDate.toLocaleDateString("de") })}.xlsx`;
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        return { buffer, fileName };
      });
    },

    async generateReport(
      userId: string,
      fromDate: Date,
      toDate: Date,
      cropRotations: boolean,
      tillages: boolean,
      fertilizerApplications: boolean,
      cropProtectionApplications: boolean,
      harvests: boolean,
    ): Promise<void> {
      const { buffer, fileName } = await this.generateReportBuffer(
        fromDate,
        toDate,
        cropRotations,
        tillages,
        fertilizerApplications,
        cropProtectionApplications,
        harvests,
      );
      await rlsDb.rls(async (tx) => {
        const user = await tx.query.profiles.findFirst({
          where: { id: userId },
        });
        if (!user) {
          throw new Error(`User with id ${userId} not found`);
        }
        try {
          await txEmailApi.sendTransacEmail({
            sender: { email: "noreply@app.coltivio.ch", name: "Coltivio" },
            to: [{ email: user.email, name: user.fullName || undefined }],
            subject: fileName,
            htmlContent: `<p>${t("field_calendar_report.mail_content", { fromDate: fromDate.toLocaleDateString("de"), toDate: toDate.toLocaleDateString("de") })}</p>`,
            attachment: [
              {
                content: buffer.toString("base64"),
                name: fileName,
              },
            ],
          });
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
        }
      });
    },
  };
}
