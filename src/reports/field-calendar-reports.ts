import * as Sentry from "@sentry/node";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";
import { TFunction } from "i18next";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { txEmailApi } from "../brevo/brevo";

export function fieldCalendarReportsApi(
  rlsDb: RlsDb,
  t: TFunction,
  locale: string
) {
  return {
    async generateReport(
      userId: string,
      fromDate: Date,
      toDate: Date,
      cropRotations: boolean,
      tillages: boolean,
      fertilizerApplications: boolean,
      cropProtectionApplications: boolean,
      harvests: boolean
    ): Promise<void> {
      const selectedFlags = {
        cropRotations,
        tillages,
        fertilizerApplications,
        cropProtectionApplications,
        harvests,
      };
      await rlsDb.rls(async (tx) => {
        const user = await tx.query.profiles.findFirst({
          where: eq(tables.profiles.id, userId),
        });
        if (!user) {
          throw new Error(`User with id ${userId} not found`);
        }
        const plots = await tx.query.plots.findMany({
          with: {
            cropRotations: {
              orderBy: desc(tables.cropRotations.fromDate),
              with: { crop: true },
              where: and(
                gte(tables.cropRotations.fromDate, fromDate),
                lte(tables.cropRotations.fromDate, toDate)
              ),
            },
            tillages: {
              with: { equipment: true },
              orderBy: desc(tables.tillages.date),
              where: and(
                gte(tables.tillages.date, fromDate),
                lte(tables.tillages.date, toDate)
              ),
            },
            harvests: {
              with: { crop: true, machinery: true },
              orderBy: desc(tables.harvests.date),
              where: and(
                gte(tables.harvests.date, fromDate),
                lte(tables.harvests.date, toDate)
              ),
            },
            fertilizerApplications: {
              with: { fertilizer: true, spreader: true },
              orderBy: desc(tables.fertilizerApplications.date),
              where: and(
                gte(tables.fertilizerApplications.date, fromDate),
                lte(tables.fertilizerApplications.date, toDate)
              ),
            },
            cropProtectionApplications: {
              with: { equipment: true, product: true },
              orderBy: desc(tables.cropProtectionApplications.dateTime),
              where: and(
                gte(tables.cropProtectionApplications.dateTime, fromDate),
                lte(tables.cropProtectionApplications.dateTime, toDate)
              ),
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
                  cropRotation.fromDate.toLocaleDateString(locale),
                  cropRotation.toDate?.toLocaleDateString(locale) ?? "",
                  cropRotation.crop.name,
                ]);
              });
            }

            if (tillages) {
              plot.tillages.forEach((tillage) => {
                tillageRows.push([
                  tillage.date.toLocaleDateString(locale),
                  (tillage.size / 100).toFixed(2),
                  t(`tillages.reasons.${tillage.reason}`),
                  t(`tillages.actions.${tillage.action}`),
                  tillage.equipment?.name,
                ]);
              });
            }

            if (fertilizerApplications) {
              plot.fertilizerApplications.forEach((application) => {
                fertilizerApplicationRows.push([
                  application.date.toLocaleDateString(locale),
                  (application.size / 100).toFixed(2),
                  application.fertilizer.name,
                  t(`units.short.${application.unit}`),
                  application.spreader?.name,
                  application.numberOfApplications,
                  application.amountPerApplication,
                  application.amountPerApplication *
                    application.numberOfApplications,
                ]);
              });
            }

            if (cropProtectionApplications) {
              plot.cropProtectionApplications.forEach((application) => {
                cropProtectionApplicationRows.push([
                  application.dateTime.toLocaleDateString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  (application.size / 100).toFixed(2),
                  application.product.name,
                  t(`units.short.${application.unit}`),
                  application.equipment?.name,
                  application.numberOfApplications,
                  application.amountPerApplication,
                  application.amountPerApplication *
                    application.numberOfApplications,
                ]);
              });
            }

            if (harvests) {
              plot.harvests.forEach((harvest) => {
                harvestRows.push([
                  harvest.date.toLocaleDateString(locale),
                  (harvest.size / 100).toFixed(2),
                  harvest.crop.name,
                  harvest.machinery?.name,
                  t(
                    `harvests.labels.processing_type.${harvest.processingType}`
                  ),
                  t(
                    `harvests.labels.conservation_method.${harvest.conservationMethod}`
                  ),
                  harvest.producedUnits,
                  harvest.kilosPerUnit,
                  harvest.producedUnits * harvest.kilosPerUnit,
                ]);
              });
            }
          }

          const sheet = workbook.addWorksheet(
            t("field_calendar_report.sheet_titles.main_short")
          );
          let rowIndex = 1;
          sheet.getCell(`A${rowIndex}`).value = t(
            "field_calendar_report.sheet_titles.main",
            {
              fromDate: fromDate.toLocaleDateString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              }),
              toDate: toDate.toLocaleDateString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          );
          sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 24 };
          rowIndex += 3;

          if (cropRotations && cropRotationRows.length > 0) {
            // crop rotations table
            sheet.getCell(`A${rowIndex}`).value = t(
              "crop_rotations.crop_rotation"
            );
            sheet.getCell(`A${rowIndex}`).font = {
              bold: true,
              size: 16,
            };
            rowIndex += 2;

            sheet.addTable({
              name: "main_crop_rotations",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
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
            sheet.getCell(`A${rowIndex}`).value = t("tillages.tillage");
            sheet.getCell(`A${rowIndex}`).font = {
              bold: true,
              size: 16,
            };
            rowIndex += 2;

            sheet.addTable({
              name: "main_tillages",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("common.reason") },
                { name: t("common.action") },
                { name: t("common.machinery") },
              ],
              rows: tillageRows,
            });
            rowIndex += tillageRows.length + 3;
          }

          if (fertilizerApplications && fertilizerApplicationRows.length > 0) {
            // table fertilizer applications
            sheet.getCell(`A${rowIndex}`).value = t(
              "fertilizer_applications.fertilizer_application"
            );
            sheet.getCell(`A${rowIndex}`).font = {
              bold: true,
              size: 16,
            };
            rowIndex += 2;

            sheet.addTable({
              name: "main_fertilizer_applications",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("fertilizer_applications.fertilizer") },
                { name: t("common.unit") },
                { name: t("common.machinery") },
                { name: t("common.amount_of_loads") },
                { name: t("common.amount_per_load") },
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
            sheet.getCell(`A${rowIndex}`).value = t(
              "crop_protections.crop_protection"
            );
            sheet.getCell(`A${rowIndex}`).font = {
              bold: true,
              size: 16,
            };
            rowIndex += 2;

            sheet.addTable({
              name: "main_crop_protection_applications",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("crop_protections.product") },
                { name: t("common.unit") },
                { name: t("common.machinery") },
                { name: t("common.amount_of_loads") },
                { name: t("common.amount_per_load") },
                { name: t("common.total") },
              ],
              rows: cropProtectionApplicationRows,
            });

            rowIndex += cropProtectionApplicationRows.length + 3;
          }

          if (harvests && harvestRows.length > 0) {
            // table harvests
            sheet.getCell(`A${rowIndex}`).value = t("harvests.harvest");
            sheet.getCell(`A${rowIndex}`).font = {
              bold: true,
              size: 16,
            };
            rowIndex += 2;

            sheet.addTable({
              name: "main_harvests",
              ref: `A${rowIndex}`,
              headerRow: true,
              style: { showRowStripes: true },
              columns: [
                { name: t("common.date") },
                { name: t("common.size_a") },
                { name: t("crops.crop") },
                { name: t("common.machinery") },
                { name: t("harvests.processing_type") },
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
            t("field_calendar_report.sheet_titles.per_plot_short")
          );
          let rowIndex = 1;

          sheet.getCell(`A${rowIndex}`).value = t(
            "field_calendar_report.sheet_titles.per_plot",
            {
              fromDate: fromDate.toLocaleDateString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              }),
              toDate: toDate.toLocaleDateString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          );
          sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 24 };
          rowIndex += 3;

          let plotIndex = 0;
          for (const plot of plots) {
            // if (
            //   plot.harvests.length === 0 &&
            //   plot.tillages.length === 0 &&
            //   plot.fertilizerApplications.length === 0 &&
            //   plot.cropProtectionApplications.length === 0
            // ) {
            //   continue;
            // }
            if (
              (
                Object.entries(selectedFlags) as Array<
                  [keyof typeof selectedFlags, boolean]
                >
              ).every(
                ([key, isSelected]) => !isSelected || plot[key].length === 0
              )
            ) {
              continue;
            }

            const { name, size } = plot;

            // add plot name as title
            sheet.getCell(`A${rowIndex}`).value = t("plots.plot");
            sheet.getCell(`A${rowIndex}`).font = {
              bold: true,
              size: 14,
            };
            sheet.getCell(`B${rowIndex}`).value = name;
            sheet.getCell(`B${rowIndex}`).font = {
              bold: true,
              size: 14,
            };
            rowIndex += 2;

            // add plot details
            sheet.getCell(`A${rowIndex}`).value = t("common.size_ha");
            sheet.getCell(`A${rowIndex}`).font = { bold: true };
            sheet.getCell(`B${rowIndex}`).value = (size / 10000).toFixed(2);
            rowIndex++;
            sheet.getCell(`A${rowIndex}`).value = t("crops.crop");
            sheet.getCell(`A${rowIndex}`).font = { bold: true };
            sheet.getCell(`B${rowIndex}`).value =
              plot.cropRotations[0]?.crop.name;
            rowIndex += 2;

            const addSection = <T>(
              title: string,
              headers: Array<{ key: keyof T; value: string }>,
              data: T[],
              index: number
            ) => {
              if (data.length > 0) {
                sheet.getCell(`A${rowIndex}`).value = title;
                sheet.getCell(`A${rowIndex}`).font = {
                  bold: true,
                  size: 12,
                };
                rowIndex++;

                const tableRows = data.map((entry) =>
                  headers.map((header) => entry[header.key] || "")
                );
                sheet.addTable({
                  name: `${title}_${name}_${index}`,
                  ref: `A${rowIndex}`,
                  headerRow: true,
                  style: { showRowStripes: true },
                  columns: headers.map((header, i) => ({ name: header.value })),
                  // columns:
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
                plotIndex
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
                  { key: "equipment", value: t("common.machinery") },
                ],
                plot.tillages.map((tillage) => ({
                  date: tillage.date.toLocaleDateString(locale),
                  size: (tillage.size / 100).toFixed(2),
                  reason: t(`tillages.reasons.${tillage.reason}`),
                  action: t(`tillages.actions.${tillage.action}`),
                  equipment: tillage.equipment?.name,
                })),
                plotIndex
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
                  { key: "spreader", value: t("common.machinery") },
                  {
                    key: "numberOfApplications",
                    value: t("common.amount_of_loads"),
                  },
                  {
                    key: "amountPerApplication",
                    value: t("common.amount_per_load"),
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
                  unit: t(`units.short.${application.unit}`),
                  spreader: application.spreader?.name,
                  numberOfApplications: application.numberOfApplications,
                  amountPerApplication: application.amountPerApplication,
                  total:
                    application.amountPerApplication *
                    application.numberOfApplications,
                })),
                plotIndex
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
                  { key: "equipment", value: t("common.machinery") },
                  {
                    key: "numberOfApplications",
                    value: t("common.amount_of_loads"),
                  },
                  {
                    key: "amountPerApplication",
                    value: t("common.amount_per_load"),
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
                  unit: t(`units.short.${application.unit}`),
                  equipment: application.equipment?.name,
                  numberOfApplications: application.numberOfApplications,
                  amountPerApplication: application.amountPerApplication,
                  total:
                    application.amountPerApplication *
                    application.numberOfApplications,
                })),
                plotIndex
              );
            }

            if (harvests) {
              addSection(
                t("harvests.harvest"),
                [
                  { key: "date", value: t("common.date") },
                  { key: "size", value: t("common.size_a") },
                  { key: "crop", value: t("crops.crop") },
                  { key: "machinery", value: t("common.machinery") },
                  {
                    key: "processingType",
                    value: t(`harvests.processing_type`),
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
                  machinery: harvest.machinery?.name,
                  processingType: t(
                    `harvests.labels.processing_type.${harvest.processingType}`
                  ),
                  conservationMethod: t(
                    `harvests.labels.conservation_method.${harvest.conservationMethod}`
                  ),
                  producedUnits: harvest.producedUnits,
                  kilosPerUnit: harvest.kilosPerUnit,
                  totalKilos: harvest.producedUnits * harvest.kilosPerUnit,
                })),
                plotIndex
              );
            }
            plotIndex++;
          }
        }

        const fileName = `${t("field_calendar_report.file_name", { fromDate: fromDate.toLocaleDateString(locale), toDate: toDate.toLocaleDateString(locale) })}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        const attachement = Buffer.from(buffer).toString("base64");

        // await workbook.xlsx.writeFile(
        //   `${t("file_name", { fromDate: fromDate.toLocaleDateString(locale), toDate: toDate.toLocaleDateString(locale) })}.xlsx`
        // );
        try {
          await txEmailApi.sendTransacEmail({
            sender: { email: "noreply@app.coltivio.ch", name: "Coltivio" },
            to: [{ email: user.email, name: user.fullName || undefined }],
            subject: fileName,
            htmlContent: `<p>${t("field_calendar_report.mail_content", { fromDate: fromDate.toLocaleDateString(locale), toDate: toDate.toLocaleDateString(locale) })}</p>`,
            attachment: [
              {
                content: attachement,
                name: fileName,
              },
            ],
          });
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
        }
        return;
      });
    },
  };
}
