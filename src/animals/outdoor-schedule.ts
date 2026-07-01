import { appDrizzle } from "../db/db";

export async function getOutdoorSchedules(from: Date, to: Date) {
  return appDrizzle.query.outdoorSchedules.findMany({
    where: { AND: [{ startDate: { lte: to } }, { startDate: { gte: from } }] },
    with: { herd: { with: { animals: true } }, recurrence: true },
  });
}
