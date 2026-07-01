import ExcelJS from "exceljs";
import { TFunction } from "i18next";
import { appDrizzle } from "../db/db";

export async function generateFieldCalendarReportBuffer(
  fromDate: Date,
  toDate: Date,
  t: TFunction,
  locale: string = "de",
  selectedFlags: {
    cropRotations: boolean;
    tillages: boolean;
    fertilizerApplications: boolean;
    cropProtectionApplications: boolean;
    harvests: boolean;
  }
): Promise<{ buffer: Buffer; fileName: string }> {
  const { cropRotations, tillages, fertilizerApplications, cropProtectionApplications, harvests } = selectedFlags;

  const plots = await appDrizzle.query.plots.findMany({
    with: {
      cropRotations: {
        orderBy: { fromDate: "asc" },
        with: { crop: true, recurrence: true },
        where: { fromDate: { lte: toDate } },
      },
      tillages: { orderBy: { date: "desc" }, where: { AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }] } },
      harvests: {
        with: { crop: true },
        orderBy: { date: "desc" },
        where: { AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }] },
      },
      fertilizerApplications: {
        with: { fertilizer: true },
        orderBy: { date: "desc" },
        where: { AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }] },
      },
      cropProtectionApplications: {
        with: { product: true },
        orderBy: { dateTime: "desc" },
        where: { AND: [{ dateTime: { gte: fromDate } }, { dateTime: { lte: toDate } }] },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();

  const timelineMonths: { year: number; month: number }[] = [];
  {
    let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const rangeEnd = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    while (cur <= rangeEnd) {
      timelineMonths.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  const CROP_COLORS = [
    "FFB7D7E8",
    "FFFFD6A5",
    "FFCAFFBF",
    "FFFFADAD",
    "FFE2CFFF",
    "FFFFFFB3",
    "FFBDE0FF",
    "FFFFC6FF",
    "FFDDE5B6",
    "FFB5EAD7",
    "FFFFCCF9",
    "FFCCE5FF",
  ];
  const cropColorMap = new Map<string, string>();
  let cropColorIndex = 0;
  const getCropColor = (cropId: string): string => {
    if (!cropColorMap.has(cropId)) {
      cropColorMap.set(cropId, CROP_COLORS[cropColorIndex % CROP_COLORS.length]);
      cropColorIndex++;
    }
    return cropColorMap.get(cropId)!;
  };

  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  const PLOT_COL = 1;
  const MONTH_START_COL = 2;

  const writeTimelineHeaders = (sheet: ExcelJS.Worksheet, startRow: number) => {
    const yearRow = startRow;
    const monthRow = startRow + 1;
    let yearGroupStart = 0;
    for (let i = 0; i <= timelineMonths.length; i++) {
      const isNewYear = i === timelineMonths.length || timelineMonths[i].year !== timelineMonths[yearGroupStart].year;
      if (isNewYear) {
        const startCol = MONTH_START_COL + yearGroupStart;
        const endCol = MONTH_START_COL + i - 1;
        if (startCol < endCol) sheet.mergeCells(yearRow, startCol, yearRow, endCol);
        const yearCell = sheet.getCell(yearRow, startCol);
        yearCell.value = timelineMonths[yearGroupStart].year;
        yearCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        yearCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
        yearCell.alignment = { horizontal: "center", vertical: "middle" };
        yearGroupStart = i;
      }
    }
    const plotLabelCell = sheet.getCell(monthRow, PLOT_COL);
    plotLabelCell.value = t("plots.plot");
    plotLabelCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    plotLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    for (let i = 0; i < timelineMonths.length; i++) {
      const monthDate = new Date(timelineMonths[i].year, timelineMonths[i].month, 1);
      const monthCell = sheet.getCell(monthRow, MONTH_START_COL + i);
      monthCell.value = monthDate.toLocaleDateString(locale, { month: "short" });
      monthCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      monthCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      monthCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getColumn(MONTH_START_COL + i).width = 12;
    }
    sheet.getColumn(PLOT_COL).width = 22;
  };

  const ROW_BORDER: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF505050" } };
  const COL_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF808080" } };

  type PlotCropRotation = (typeof plots)[0]["cropRotations"][0];
  const expandCropRotation = (
    rotation: PlotCropRotation,
    rangeFrom: Date,
    rangeTo: Date
  ): { fromDate: Date; toDate: Date }[] => {
    const base = rotation.fromDate;
    const durationMs = rotation.toDate.getTime() - base.getTime();
    const rec = rotation.recurrence;
    const results: { fromDate: Date; toDate: Date }[] = [];
    let n = 0;
    while (true) {
      const occFrom = new Date(base.getFullYear() + (rec ? rec.interval * n : 0), base.getMonth(), base.getDate());
      const occTo = new Date(occFrom.getTime() + durationMs);
      if (occFrom > rangeTo) break;
      if (rec?.until && occFrom > rec.until) break;
      if (occTo >= rangeFrom) results.push({ fromDate: occFrom, toDate: occTo });
      if (!rec) break;
      n++;
    }
    return results;
  };

  const writeRotationBars = (sheet: ExcelJS.Worksheet, row: number, rotations: PlotCropRotation[]) => {
    type Occurrence = { monthIdx: number; label: string | null; cropId: string };
    const monthFill: Occurrence[] = [];

    for (const rotation of rotations) {
      const occurrences = expandCropRotation(rotation, fromDate, toDate);
      for (const occ of occurrences) {
        let isFirstCell = true;
        for (let i = 0; i < timelineMonths.length; i++) {
          const { year, month } = timelineMonths[i];
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          if (occ.fromDate <= lastDay && occ.toDate >= firstDay) {
            monthFill.push({
              monthIdx: i,
              label: isFirstCell ? `${rotation.crop.name}  ${fmtDate(occ.fromDate)} – ${fmtDate(occ.toDate)}` : null,
              cropId: rotation.cropId,
            });
            isFirstCell = false;
          }
        }
      }
    }

    const filledIndices = new Set(monthFill.map((f) => f.monthIdx));
    for (let i = 0; i < timelineMonths.length; i++) {
      const col = MONTH_START_COL + i;
      const barCell = sheet.getCell(row, col);
      barCell.border = { bottom: ROW_BORDER, right: COL_BORDER, left: i === 0 ? COL_BORDER : undefined };
      if (!filledIndices.has(i)) continue;
      const fill = monthFill.find((f) => f.monthIdx === i)!;
      barCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: getCropColor(fill.cropId) } };
      if (fill.label) {
        barCell.value = fill.label;
        barCell.alignment = { vertical: "middle", wrapText: false };
      }
    }
  };

  // Main sheet
  (function generateMainSheet() {
    const tillageRows: (string | number)[][] = [];
    const fertilizerApplicationRows: (string | number)[][] = [];
    const cropProtectionApplicationRows: (string | number)[][] = [];
    const harvestRows: (string | number)[][] = [];

    for (const plot of plots) {
      if (tillages) {
        plot.tillages.forEach((tillage) => {
          tillageRows.push([
            plot.name,
            plot.usage ?? "",
            tillage.date.toLocaleDateString(locale),
            (tillage.size / 100).toFixed(2),
            tillage.reason ? t(`tillages.reasons.${tillage.reason}`) : "",
            t(`tillages.actions.${tillage.action}`),
          ]);
        });
      }
      if (fertilizerApplications) {
        plot.fertilizerApplications.forEach((app) => {
          fertilizerApplicationRows.push([
            plot.name,
            plot.usage ?? "",
            app.date.toLocaleDateString(locale),
            (app.size / 100).toFixed(2),
            app.fertilizer.name,
            t(`units.short.${app.fertilizer.unit}`),
            t(`application_units.${app.unit}`),
            app.numberOfUnits,
            app.amountPerUnit,
            app.amountPerUnit * app.numberOfUnits,
          ]);
        });
      }
      if (cropProtectionApplications) {
        plot.cropProtectionApplications.forEach((app) => {
          cropProtectionApplicationRows.push([
            plot.name,
            plot.usage ?? "",
            app.dateTime.toLocaleDateString(locale, { hour: "2-digit", minute: "2-digit" }),
            (app.size / 100).toFixed(2),
            app.product.name,
            t(`units.short.${app.product.unit}`),
            t(`application_units.${app.unit}`),
            app.numberOfUnits,
            app.amountPerUnit,
            app.amountPerUnit * app.numberOfUnits,
          ]);
        });
      }
      if (harvests) {
        plot.harvests.forEach((harvest) => {
          harvestRows.push([
            plot.name,
            plot.usage ?? "",
            harvest.date.toLocaleDateString(locale),
            (harvest.size / 100).toFixed(2),
            harvest.crop.name,
            t(`harvests.labels.harvest_units.${harvest.unit}`),
            harvest.conservationMethod ? t(`harvests.labels.conservation_method.${harvest.conservationMethod}`) : "",
            harvest.numberOfUnits,
            harvest.kilosPerUnit,
            harvest.numberOfUnits * harvest.kilosPerUnit,
          ]);
        });
      }
    }

    const sheet = workbook.addWorksheet(t("field_calendar_report.sheet_titles.main_short"));
    let rowIndex = 1;
    sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
    const mainTitle = sheet.getCell(`A${rowIndex}`);
    mainTitle.value = t("field_calendar_report.sheet_titles.main", {
      fromDate: fromDate.toLocaleDateString("de", { hour: "2-digit", minute: "2-digit" }),
      toDate: toDate.toLocaleDateString("de", { hour: "2-digit", minute: "2-digit" }),
    });
    mainTitle.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
    mainTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
    mainTitle.alignment = { vertical: "middle" };
    rowIndex += 3;

    const addTable = (name: string, title: string, columns: { name: string }[], rows: (string | number)[][]) => {
      if (rows.length === 0) return;
      sheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
      sheet.getCell(`A${rowIndex}`).value = title;
      sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      rowIndex += 2;
      sheet.addTable({ name, ref: `A${rowIndex}`, headerRow: true, style: { showRowStripes: true }, columns, rows });
      rowIndex += rows.length + 3;
    };

    if (tillages)
      addTable(
        "main_tillages",
        t("tillages.tillage"),
        [
          { name: t("plots.plot") },
          { name: t("plots.usage") },
          { name: t("common.date") },
          { name: t("common.size_a") },
          { name: t("common.reason") },
          { name: t("common.action") },
        ],
        tillageRows
      );
    if (fertilizerApplications)
      addTable(
        "main_fertilizer_applications",
        t("fertilizer_applications.fertilizer_application"),
        [
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
        fertilizerApplicationRows
      );
    if (cropProtectionApplications)
      addTable(
        "main_crop_protection_applications",
        t("crop_protections.crop_protection"),
        [
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
        cropProtectionApplicationRows
      );
    if (harvests)
      addTable(
        "main_harvests",
        t("harvests.harvest"),
        [
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
        harvestRows
      );
  })();

  // Rotation timeline sheet
  if (cropRotations) {
    (function generateRotationTimelineSheet() {
      if (timelineMonths.length === 0) return;
      const sheet = workbook.addWorksheet(t("crop_rotations.crop_rotation"));
      writeTimelineHeaders(sheet, 1);
      let rowIndex = 3;
      for (const plot of plots) {
        if (plot.cropRotations.length === 0) continue;
        const nameCell = sheet.getCell(rowIndex, PLOT_COL);
        nameCell.value = plot.name;
        nameCell.font = { bold: true };
        nameCell.alignment = { vertical: "middle" };
        nameCell.border = { bottom: ROW_BORDER };
        writeRotationBars(sheet, rowIndex, plot.cropRotations);
        sheet.getRow(rowIndex).height = 36;
        rowIndex++;
      }
    })();
  }

  // Per-plot sheet
  (function generatePerPlotSheet() {
    const sheet = workbook.addWorksheet(t("field_calendar_report.sheet_titles.per_plot_short"));
    let rowIndex = 1;
    sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
    const perPlotTitle = sheet.getCell(`A${rowIndex}`);
    perPlotTitle.value = t("field_calendar_report.sheet_titles.per_plot", {
      fromDate: fromDate.toLocaleDateString("de", { hour: "2-digit", minute: "2-digit" }),
      toDate: toDate.toLocaleDateString("de", { hour: "2-digit", minute: "2-digit" }),
    });
    perPlotTitle.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
    perPlotTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
    perPlotTitle.alignment = { vertical: "middle" };
    rowIndex += 3;

    let plotIndex = 0;
    for (const plot of plots) {
      const hasData = (Object.entries(selectedFlags) as [keyof typeof selectedFlags, boolean][]).some(
        ([key, isSelected]) => isSelected && plot[key].length > 0
      );
      if (!hasData) continue;

      sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
      const plotBanner = sheet.getCell(`A${rowIndex}`);
      plotBanner.value = `${t("plots.plot")}: ${plot.name}`;
      plotBanner.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      plotBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
      plotBanner.alignment = { vertical: "middle" };
      rowIndex += 2;

      const detailFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
      sheet.getCell(`A${rowIndex}`).value = t("plots.usage");
      sheet.getCell(`A${rowIndex}`).font = { bold: true };
      sheet.getCell(`A${rowIndex}`).fill = detailFill;
      sheet.getCell(`B${rowIndex}`).value = plot.usage ?? t("common.unknown");
      rowIndex++;
      sheet.getCell(`A${rowIndex}`).value = t("common.size_ha");
      sheet.getCell(`A${rowIndex}`).font = { bold: true };
      sheet.getCell(`A${rowIndex}`).fill = detailFill;
      sheet.getCell(`B${rowIndex}`).value = (plot.size / 10000).toFixed(2);
      rowIndex++;
      sheet.getCell(`A${rowIndex}`).value = t("crops.crop");
      sheet.getCell(`A${rowIndex}`).font = { bold: true };
      sheet.getCell(`A${rowIndex}`).fill = detailFill;
      sheet.getCell(`B${rowIndex}`).value = plot.cropRotations[0]?.crop.name;
      rowIndex += 2;

      const addSection = (title: string, columns: { name: string }[], rows: (string | number)[][], idx: number) => {
        if (rows.length === 0) return;
        sheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
        sheet.getCell(`A${rowIndex}`).value = title;
        sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
        rowIndex++;
        sheet.addTable({
          name: `${title}_${plot.name}_${idx}`.replace(/[^a-zA-Z0-9_]/g, "_"),
          ref: `A${rowIndex}`,
          headerRow: true,
          style: { showRowStripes: true },
          columns,
          rows,
        });
        rowIndex += rows.length + 3;
      };

      if (cropRotations && plot.cropRotations.length > 0) {
        const rotationTableRows = plot.cropRotations.flatMap((rotation) =>
          expandCropRotation(rotation, fromDate, toDate).map((occ) => [
            rotation.crop.name,
            occ.fromDate.toLocaleDateString(locale),
            occ.toDate.toLocaleDateString(locale),
          ])
        );
        if (rotationTableRows.length > 0) {
          sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
          sheet.getCell(`A${rowIndex}`).value = t("crop_rotations.crop_rotation");
          sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
          sheet.getCell(`A${rowIndex}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
          rowIndex++;
          sheet.addTable({
            name: `rotations_${plot.name}_${plotIndex}`.replace(/[^a-zA-Z0-9_]/g, "_"),
            ref: `A${rowIndex}`,
            headerRow: true,
            style: { showRowStripes: true },
            columns: [{ name: t("crops.crop") }, { name: t("common.from") }, { name: t("common.to") }],
            rows: rotationTableRows,
          });
          rowIndex += rotationTableRows.length + 3;
        }
      }

      if (tillages)
        addSection(
          t("tillages.tillage"),
          [
            { name: t("common.date") },
            { name: t("common.size_a") },
            { name: t("common.reason") },
            { name: t("common.action") },
          ],
          plot.tillages.map((t2) => [
            t2.date.toLocaleDateString(locale),
            (t2.size / 100).toFixed(2),
            t2.reason ? t(`tillages.reasons.${t2.reason}`) : "",
            t(`tillages.actions.${t2.action}`),
          ]),
          plotIndex
        );
      if (fertilizerApplications)
        addSection(
          t("fertilizer_applications.fertilizer_application"),
          [
            { name: t("common.date") },
            { name: t("common.size_a") },
            { name: t("fertilizer_applications.fertilizer") },
            { name: t("common.unit") },
            { name: t("common.application_unit") },
            { name: t("common.number_of_application_units") },
            { name: t("common.amount_per_application_unit") },
            { name: t("common.total") },
          ],
          plot.fertilizerApplications.map((a) => [
            a.date.toLocaleDateString(locale),
            (a.size / 100).toFixed(2),
            a.fertilizer.name,
            t(`units.short.${a.fertilizer.unit}`),
            t(`application_units.${a.unit}`),
            a.numberOfUnits,
            a.amountPerUnit,
            a.amountPerUnit * a.numberOfUnits,
          ]),
          plotIndex
        );
      if (cropProtectionApplications)
        addSection(
          t("crop_protections.crop_protection"),
          [
            { name: t("common.date") },
            { name: t("common.size_a") },
            { name: t("crop_protections.product") },
            { name: t("common.unit") },
            { name: t("common.application_unit") },
            { name: t("common.number_of_application_units") },
            { name: t("common.amount_per_application_unit") },
            { name: t("common.total") },
          ],
          plot.cropProtectionApplications.map((a) => [
            a.dateTime.toLocaleDateString(locale, { hour: "2-digit", minute: "2-digit" }),
            (a.size / 100).toFixed(2),
            a.product.name,
            t(`units.short.${a.product.unit}`),
            t(`application_units.${a.unit}`),
            a.numberOfUnits,
            a.amountPerUnit,
            a.amountPerUnit * a.numberOfUnits,
          ]),
          plotIndex
        );
      if (harvests)
        addSection(
          t("harvests.harvest"),
          [
            { name: t("common.date") },
            { name: t("common.size_a") },
            { name: t("crops.crop") },
            { name: t("harvests.application_unit") },
            { name: t("harvests.conservation") },
            { name: t("harvests.produced_units") },
            { name: t("harvests.kilos_per_unit") },
            { name: t("harvests.total_kilos") },
          ],
          plot.harvests.map((h) => [
            h.date.toLocaleDateString(locale),
            (h.size / 100).toFixed(2),
            h.crop.name,
            t(`harvests.labels.harvest_units.${h.unit}`),
            h.conservationMethod ? t(`harvests.labels.conservation_method.${h.conservationMethod}`) : "",
            h.numberOfUnits,
            h.kilosPerUnit,
            h.numberOfUnits * h.kilosPerUnit,
          ]),
          plotIndex
        );

      plotIndex++;
    }
  })();

  const fileName = `${t("field_calendar_report.file_name", { fromDate: fromDate.toLocaleDateString("de"), toDate: toDate.toLocaleDateString("de") })}.xlsx`;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, fileName };
}
