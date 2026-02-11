import {
  addYears,
  addMonths,
  addWeeks,
  addDays,
  differenceInMilliseconds,
  getDay,
  setDay,
  isBefore,
  isAfter,
  max,
  min,
} from "date-fns";
import {
  AnimalCategory,
  Animal,
  OutdoorScheduleWithRecurrence,
  Herd,
} from "./animals";
import { getAnimalCategoryTransitions } from "./animal-key-mapping";

export type OutdoorJournalEntry = {
  category: AnimalCategory;
  startDate: Date;
  endDate: Date;
  animalCount: number;
};

export type OutdoorJournalResult = {
  entries: OutdoorJournalEntry[];
  uncategorizedAnimalCount: number;
};

type DateRange = { startDate: Date; endDate: Date };

const WEEKDAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const MAX_ITERATIONS = 10_000;

// Expands a single outdoor schedule (with optional recurrence) into concrete date ranges
export function expandOutdoorSchedule(
  schedule: OutdoorScheduleWithRecurrence,
  queryFrom: Date,
  queryTo: Date,
): DateRange[] {
  const recurrence = schedule.recurrence;

  // No recurrence: return single range if it overlaps query window
  if (!recurrence) {
    const start = schedule.startDate;
    const end = schedule.endDate ?? schedule.startDate;
    if (isAfter(start, queryTo) || isBefore(end, queryFrom)) return [];
    return [
      { startDate: max([start, queryFrom]), endDate: min([end, queryTo]) },
    ];
  }

  const durationMs = differenceInMilliseconds(
    schedule.endDate ?? schedule.startDate,
    schedule.startDate,
  );
  const interval = recurrence.interval;
  const until = recurrence.until ? new Date(recurrence.until) : null;
  const maxCount = recurrence.count ?? Infinity;
  const ranges: DateRange[] = [];
  let iterations = 0;
  let occurrenceCount = 0;

  if (recurrence.frequency === "yearly") {
    let current = schedule.startDate;
    while (iterations++ < MAX_ITERATIONS) {
      if (until && isAfter(current, until)) break;
      if (isAfter(current, queryTo)) break;
      if (occurrenceCount >= maxCount) break;

      const occEnd = new Date(current.getTime() + durationMs);
      occurrenceCount++;

      // Check overlap with query range
      if (!isAfter(queryFrom, occEnd) && !isAfter(current, queryTo)) {
        ranges.push({
          startDate: max([current, queryFrom]),
          endDate: min([occEnd, queryTo]),
        });
      }

      current = addYears(schedule.startDate, interval * occurrenceCount);
    }
  } else if (recurrence.frequency === "monthly") {
    let current = schedule.startDate;
    let step = 0;
    while (iterations++ < MAX_ITERATIONS) {
      let occStart = current;
      // Override day-of-month if byMonthDay is set
      if (recurrence.byMonthDay !== null && recurrence.byMonthDay !== undefined) {
        occStart = new Date(occStart);
        occStart.setDate(recurrence.byMonthDay);
      }

      if (until && isAfter(occStart, until)) break;
      if (isAfter(occStart, queryTo)) break;
      if (occurrenceCount >= maxCount) break;

      const occEnd = new Date(occStart.getTime() + durationMs);
      occurrenceCount++;

      if (!isAfter(queryFrom, occEnd) && !isAfter(occStart, queryTo)) {
        ranges.push({
          startDate: max([occStart, queryFrom]),
          endDate: min([occEnd, queryTo]),
        });
      }

      step++;
      current = addMonths(schedule.startDate, interval * step);
    }
  } else if (recurrence.frequency === "weekly") {
    let weekStart = schedule.startDate;
    let step = 0;
    while (iterations++ < MAX_ITERATIONS) {
      if (until && isAfter(weekStart, until)) break;
      if (isAfter(weekStart, queryTo)) break;
      if (occurrenceCount >= maxCount) break;

      const weekdays =
        recurrence.byWeekday && recurrence.byWeekday.length > 0
          ? recurrence.byWeekday
          : null;

      if (weekdays) {
        // For each specified weekday, create an occurrence in this week
        for (const wd of weekdays) {
          if (occurrenceCount >= maxCount) break;
          const dayIndex = WEEKDAY_INDEX[wd];
          const occStart = setDay(weekStart, dayIndex, {
            weekStartsOn: getDay(weekStart) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          });
          const occEnd = new Date(occStart.getTime() + durationMs);

          if (until && isAfter(occStart, until)) continue;
          if (isBefore(occStart, schedule.startDate)) continue;

          occurrenceCount++;
          if (!isAfter(queryFrom, occEnd) && !isAfter(occStart, queryTo)) {
            ranges.push({
              startDate: max([occStart, queryFrom]),
              endDate: min([occEnd, queryTo]),
            });
          }
        }
      } else {
        // Use original weekday
        const occEnd = new Date(weekStart.getTime() + durationMs);
        occurrenceCount++;

        if (!isAfter(queryFrom, occEnd) && !isAfter(weekStart, queryTo)) {
          ranges.push({
            startDate: max([weekStart, queryFrom]),
            endDate: min([occEnd, queryTo]),
          });
        }
      }

      step++;
      weekStart = addWeeks(schedule.startDate, interval * step);
    }
  }

  return ranges;
}

type HerdWithAnimalsAndSchedules = Herd & {
  animals: Animal[];
  outdoorSchedules: OutdoorScheduleWithRecurrence[];
};

// Main orchestration: expand schedules, compute category ranges, merge with sweep-line
export function buildOutdoorJournal(
  herds: HerdWithAnimalsAndSchedules[],
  queryFrom: Date,
  queryTo: Date,
): OutdoorJournalResult {
  // Collect all category fragments across all herds
  const fragments: {
    category: AnimalCategory;
    startDate: Date;
    endDate: Date;
  }[] = [];
  const uncategorizedAnimals = new Set<string>();

  for (const herd of herds) {
    // Expand all outdoor schedules for this herd
    const occurrences: DateRange[] = [];
    for (const schedule of herd.outdoorSchedules) {
      occurrences.push(...expandOutdoorSchedule(schedule, queryFrom, queryTo));
    }

    // For each occurrence, compute category ranges for each living animal
    for (const occ of occurrences) {
      for (const animal of herd.animals) {
        // Skip dead animals (died before this occurrence started)
        if (animal.dateOfDeath && isBefore(animal.dateOfDeath, occ.startDate))
          continue;

        const transitions = getAnimalCategoryTransitions(
          animal,
          occ.startDate,
          occ.endDate,
        );

        for (const t of transitions) {
          if (t.category === null) {
            uncategorizedAnimals.add(animal.id);
          } else {
            fragments.push({
              category: t.category,
              startDate: t.startDate,
              endDate: t.endDate,
            });
          }
        }
      }
    }
  }

  // Merge fragments by category using sweep-line
  const byCategory = new Map<
    AnimalCategory,
    { category: AnimalCategory; startDate: Date; endDate: Date }[]
  >();
  for (const f of fragments) {
    let list = byCategory.get(f.category);
    if (!list) {
      list = [];
      byCategory.set(f.category, list);
    }
    list.push(f);
  }

  const entries: OutdoorJournalEntry[] = [];

  for (const [category, categoryFragments] of byCategory) {
    // Build sweep events: +1 at start, -1 at end+1day
    const events: { date: number; delta: number }[] = [];
    for (const f of categoryFragments) {
      events.push({ date: f.startDate.getTime(), delta: 1 });
      events.push({ date: addDays(f.endDate, 1).getTime(), delta: -1 });
    }

    // Sort: by date, then +delta before -delta (so opens before closes on same date)
    events.sort((a, b) => a.date - b.date || b.delta - a.delta);

    let runningCount = 0;
    let segmentStart: number | null = null;
    let currentCount = 0;

    for (const event of events) {
      if (runningCount > 0 && segmentStart !== null && event.date !== segmentStart) {
        // Close current segment if count changes at a new date
        if (currentCount !== runningCount + event.delta || event.date !== segmentStart) {
          entries.push({
            category,
            startDate: new Date(segmentStart),
            // endDate is the day before this event
            endDate: addDays(new Date(event.date), -1),
            animalCount: runningCount,
          });
          segmentStart = null;
        }
      }

      runningCount += event.delta;

      if (runningCount > 0 && segmentStart === null) {
        segmentStart = event.date;
        currentCount = runningCount;
      } else if (runningCount > 0 && segmentStart !== null && runningCount !== currentCount) {
        // Count changed, start new segment
        segmentStart = event.date;
        currentCount = runningCount;
      } else if (runningCount === 0) {
        segmentStart = null;
        currentCount = 0;
      }
    }
  }

  // Sort by category then startDate
  entries.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    return a.startDate.getTime() - b.startDate.getTime();
  });

  return {
    entries,
    uncategorizedAnimalCount: uncategorizedAnimals.size,
  };
}
