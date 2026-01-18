export function ensureDateRange(from?: Date, to?: Date) {
  return {
    from: from ?? new Date(2020, 0, 1),
    to: to ?? new Date(5000, 0, 1),
  };
}
