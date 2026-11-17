import { describe, expect, test } from "@jest/globals";
import { calculateNextOccurrence, TaskRecurrence } from "./tasks";

function d(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function makeRecurrence(
  overrides: Partial<TaskRecurrence> & { frequency: TaskRecurrence["frequency"] }
): TaskRecurrence {
  return {
    id: "rec-1",
    farmId: "farm-1",
    taskId: "task-1",
    interval: 1,
    byWeekday: null,
    byMonthDay: null,
    until: null,
    count: null,
    ...overrides,
  };
}

// Completes a task `times` times in a row, each time from the previous due date like setTaskStatus does
function chain(start: Date, recurrence: TaskRecurrence, times: number): string[] {
  const dates: string[] = [];
  let current: Date | null = start;
  for (let i = 0; i < times && current; i++) {
    current = calculateNextOccurrence(current, recurrence);
    if (current) dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

describe("calculateNextOccurrence", () => {
  test("monthly: 31 January plus one month is 28 February, not 3 March", () => {
    expect(calculateNextOccurrence(d("2025-01-31"), makeRecurrence({ frequency: "monthly" }))).toEqual(d("2025-02-28"));
  });

  test("monthly every 3 months: 30 November becomes 28 February, not 2 March", () => {
    const recurrence = makeRecurrence({ frequency: "monthly", interval: 3 });
    expect(calculateNextOccurrence(d("2025-11-30"), recurrence)).toEqual(d("2026-02-28"));
  });

  test("yearly: 29 February becomes 28 February, not 1 March", () => {
    expect(calculateNextOccurrence(d("2024-02-29"), makeRecurrence({ frequency: "yearly" }))).toEqual(d("2025-02-28"));
  });

  test("monthly chain without byMonthDay steps from each due date and never overflows", () => {
    expect(chain(d("2025-01-31"), makeRecurrence({ frequency: "monthly" }), 4)).toEqual([
      "2025-02-28",
      "2025-03-28",
      "2025-04-28",
      "2025-05-28",
    ]);
  });

  test("monthly chain with byMonthDay 31 returns to the month's last day", () => {
    expect(chain(d("2025-01-31"), makeRecurrence({ frequency: "monthly", byMonthDay: 31 }), 4)).toEqual([
      "2025-02-28",
      "2025-03-31",
      "2025-04-30",
      "2025-05-31",
    ]);
  });

  test("quarterly chain from 30 November", () => {
    expect(chain(d("2025-11-30"), makeRecurrence({ frequency: "monthly", interval: 3 }), 3)).toEqual([
      "2026-02-28",
      "2026-05-28",
      "2026-08-28",
    ]);
  });

  test("yearly chain from 29 February stays on 28 February", () => {
    expect(chain(d("2024-02-29"), makeRecurrence({ frequency: "yearly" }), 4)).toEqual([
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-28",
    ]);
  });

  test("stops after the until date", () => {
    const recurrence = makeRecurrence({ frequency: "monthly", until: d("2025-03-31") });
    expect(chain(d("2025-01-31"), recurrence, 5)).toEqual(["2025-02-28", "2025-03-28"]);
  });
});
