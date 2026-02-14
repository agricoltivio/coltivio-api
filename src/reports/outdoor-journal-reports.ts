import ExcelJS from "exceljs";
import { TFunction } from "i18next";
import { getDaysInMonth } from "date-fns";
import { RlsDb } from "../db/db";
import { AnimalCategory } from "../animals/animals";
import { expandOutdoorSchedule } from "../animals/outdoor-journal";
import { mapAnimalToCategory } from "../animals/animal-key-mapping";

export function outdoorJournalReportsApi(
  rlsDb: RlsDb,
  t: TFunction,
  locale: string = "de",
) {
  return {
    async generateReportBuffer(
      year: number,
    ): Promise<{ buffer: Buffer; fileName: string }> {
      return await rlsDb.rls(async (tx) => {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);

        const herds = await tx.query.herds.findMany({
          with: {
            herdMemberships: {
              with: { animal: true },
            },
            outdoorSchedules: {
              with: { recurrence: true },
            },
          },
        });

        // Pre-expand all outdoor schedules into concrete date ranges for the year
        type ExpandedOccurrence = {
          herdId: string;
          type: "pasture" | "exercise_yard";
          startDate: Date;
          endDate: Date;
        };
        const allOccurrences: ExpandedOccurrence[] = [];
        for (const herd of herds) {
          for (const schedule of herd.outdoorSchedules) {
            const ranges = expandOutdoorSchedule(schedule, yearStart, yearEnd);
            for (const range of ranges) {
              allOccurrences.push({
                herdId: herd.id,
                type: schedule.type,
                startDate: range.startDate,
                endDate: range.endDate,
              });
            }
          }
        }

        const herdById = new Map(herds.map((h) => [h.id, h]));

        // Build day-by-day matrix per month: for each category, whether pasture/exerciseYard was active
        type DayFlags = { pasture: boolean; exerciseYard: boolean };
        const monthlyData: Map<AnimalCategory, DayFlags[]>[] = [];
        const allCategories = new Set<AnimalCategory>();

        for (let month = 0; month < 12; month++) {
          const days = getDaysInMonth(new Date(year, month));
          const monthData = new Map<AnimalCategory, DayFlags[]>();

          for (let day = 1; day <= days; day++) {
            const date = new Date(year, month, day);

            for (const occ of allOccurrences) {
              if (date < occ.startDate || date > occ.endDate) continue;
              const herd = herdById.get(occ.herdId);
              if (!herd) continue;

              for (const membership of herd.herdMemberships) {
                if (membership.fromDate > date) continue;
                if (membership.toDate && membership.toDate < date) continue;
                if (
                  membership.animal.dateOfDeath &&
                  membership.animal.dateOfDeath < date
                )
                  continue;

                const category = mapAnimalToCategory(membership.animal, date);
                if (!category) continue;
                allCategories.add(category);

                if (!monthData.has(category)) {
                  monthData.set(
                    category,
                    Array.from({ length: days }, () => ({
                      pasture: false,
                      exerciseYard: false,
                    })),
                  );
                }
                const dayFlags = monthData.get(category)![day - 1];
                if (occ.type === "pasture") dayFlags.pasture = true;
                else dayFlags.exerciseYard = true;
              }
            }
          }

          monthlyData.push(monthData);
        }

        const sortedCategories = Array.from(allCategories).sort();
        const numCatCols = sortedCategories.length;

        const workbook = new ExcelJS.Workbook();

        // 2 sheets: Jan-Jun and Jul-Dec for landscape printing
        for (let half = 0; half < 2; half++) {
          const startMonth = half * 6;
          const sheetName =
            half === 0
              ? t("outdoor_journal_report.sheet_first_half")
              : t("outdoor_journal_report.sheet_second_half");
          const sheet = workbook.addWorksheet(sheetName);
          sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

          let rowIndex = 1;

          // Report title
          sheet.mergeCells(rowIndex, 1, rowIndex, 1 + numCatCols);
          sheet.getCell(rowIndex, 1).value = t(
            "outdoor_journal_report.title",
            { year: year.toString() },
          );
          sheet.getCell(rowIndex, 1).font = { bold: true, size: 18 };
          rowIndex += 2;

          for (let month = startMonth; month < startMonth + 6; month++) {
            const days = getDaysInMonth(new Date(year, month));
            const monthData = monthlyData[month];

            // Header row 1: month name merged across all columns
            sheet.mergeCells(rowIndex, 1, rowIndex, 1 + numCatCols);
            sheet.getCell(rowIndex, 1).value = t(
              `outdoor_journal_report.months.${month}` as `outdoor_journal_report.months.0`,
            );
            sheet.getCell(rowIndex, 1).font = { bold: true, size: 14 };
            sheet.getCell(rowIndex, 1).alignment = { horizontal: "center" };
            rowIndex++;

            // Header rows 2-3: "Tag" merged vertically, "Tierkategorie" merged horizontally, then category names
            const headerStart = rowIndex;
            sheet.mergeCells(headerStart, 1, headerStart + 1, 1);
            sheet.getCell(headerStart, 1).value = t(
              "outdoor_journal_report.day",
            );
            sheet.getCell(headerStart, 1).font = { bold: true };
            sheet.getCell(headerStart, 1).alignment = {
              horizontal: "center",
              vertical: "middle",
            };

            if (numCatCols > 0) {
              sheet.mergeCells(
                headerStart,
                2,
                headerStart,
                1 + numCatCols,
              );
              sheet.getCell(headerStart, 2).value = t(
                "outdoor_journal_report.animal_category",
              );
              sheet.getCell(headerStart, 2).font = { bold: true };
              sheet.getCell(headerStart, 2).alignment = {
                horizontal: "center",
              };
            }

            // Row 3: individual category labels
            rowIndex++;
            for (let c = 0; c < numCatCols; c++) {
              sheet.getCell(rowIndex, 2 + c).value = sortedCategories[c];
              sheet.getCell(rowIndex, 2 + c).font = { bold: true };
              sheet.getCell(rowIndex, 2 + c).alignment = {
                horizontal: "center",
              };
            }
            rowIndex++;

            // Day rows + count totals
            const pastureCount = new Array(numCatCols).fill(0);
            const exerciseYardCount = new Array(numCatCols).fill(0);

            for (let day = 1; day <= days; day++) {
              sheet.getCell(rowIndex, 1).value = day;
              sheet.getCell(rowIndex, 1).alignment = { horizontal: "center" };

              for (let c = 0; c < numCatCols; c++) {
                const cat = sortedCategories[c];
                const dayFlags = monthData.get(cat)?.[day - 1];
                let cellValue = "";
                if (dayFlags) {
                  if (dayFlags.pasture && dayFlags.exerciseYard) {
                    cellValue = "W/L";
                    pastureCount[c]++;
                    exerciseYardCount[c]++;
                  } else if (dayFlags.pasture) {
                    cellValue = "W";
                    pastureCount[c]++;
                  } else if (dayFlags.exerciseYard) {
                    cellValue = "L";
                    exerciseYardCount[c]++;
                  }
                }
                sheet.getCell(rowIndex, 2 + c).value = cellValue;
                sheet.getCell(rowIndex, 2 + c).alignment = {
                  horizontal: "center",
                };
              }
              rowIndex++;
            }

            // Total Weide row
            sheet.getCell(rowIndex, 1).value = t(
              "outdoor_journal_report.total_pasture",
            );
            sheet.getCell(rowIndex, 1).font = { bold: true };
            for (let c = 0; c < numCatCols; c++) {
              sheet.getCell(rowIndex, 2 + c).value =
                pastureCount[c] || "";
              sheet.getCell(rowIndex, 2 + c).alignment = {
                horizontal: "center",
              };
              sheet.getCell(rowIndex, 2 + c).font = { bold: true };
            }
            rowIndex++;

            // Total Laufhof row
            sheet.getCell(rowIndex, 1).value = t(
              "outdoor_journal_report.total_exercise_yard",
            );
            sheet.getCell(rowIndex, 1).font = { bold: true };
            for (let c = 0; c < numCatCols; c++) {
              sheet.getCell(rowIndex, 2 + c).value =
                exerciseYardCount[c] || "";
              sheet.getCell(rowIndex, 2 + c).alignment = {
                horizontal: "center",
              };
              sheet.getCell(rowIndex, 2 + c).font = { bold: true };
            }
            rowIndex++;

            // Spacing between months
            rowIndex += 2;
          }
        }

        const fileName = `${t("outdoor_journal_report.file_name", { year: year.toString() })}.xlsx`;
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        return { buffer, fileName };
      });
    },
  };
}
