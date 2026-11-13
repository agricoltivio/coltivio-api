import { describe, expect, test } from "@jest/globals";
import { addUtcMonths } from "./date-utils";

function d(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

describe("addUtcMonths", () => {
  test("clamps to the last day of a shorter target month", () => {
    expect(addUtcMonths(d("2025-01-31"), 1)).toEqual(d("2025-02-28"));
    expect(addUtcMonths(d("2024-01-31"), 1)).toEqual(d("2024-02-29"));
    expect(addUtcMonths(d("2025-03-31"), 1)).toEqual(d("2025-04-30"));
  });

  test("clamps across a year boundary", () => {
    expect(addUtcMonths(d("2025-11-30"), 3)).toEqual(d("2026-02-28"));
    expect(addUtcMonths(d("2025-12-15"), 1)).toEqual(d("2026-01-15"));
  });

  test("keeps the day when the target month is long enough", () => {
    expect(addUtcMonths(d("2025-01-15"), 1)).toEqual(d("2025-02-15"));
    expect(addUtcMonths(d("2025-02-28"), 1)).toEqual(d("2025-03-28"));
  });

  test("29 February plus whole years lands on 28 February outside leap years", () => {
    expect(addUtcMonths(d("2024-02-29"), 12)).toEqual(d("2025-02-28"));
    expect(addUtcMonths(d("2024-02-29"), 48)).toEqual(d("2028-02-29"));
  });

  test("dayOfMonth overrides the day and is clamped too", () => {
    expect(addUtcMonths(d("2025-01-15"), 1, 31)).toEqual(d("2025-02-28"));
    expect(addUtcMonths(d("2025-02-28"), 1, 31)).toEqual(d("2025-03-31"));
    expect(addUtcMonths(d("2025-01-15"), 1, 1)).toEqual(d("2025-02-01"));
  });

  test("keeps the time of day and does not mutate the input", () => {
    const input = new Date("2025-01-31T09:30:00Z");
    expect(addUtcMonths(input, 1)).toEqual(new Date("2025-02-28T09:30:00Z"));
    expect(input).toEqual(new Date("2025-01-31T09:30:00Z"));
  });
});
