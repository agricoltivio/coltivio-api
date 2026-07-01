import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "./schema";

const _db = drizzle(process.env.DATABASE_URL!, { relations });

async function main() {
  // const [battesta] = await db
  //   .insert(members)
  //   .values([
  //     {
  //       name: "Mr. Battesta",
  //       email: "battesta@miadi.ch",
  //       username: "battesta",
  //     },
  //     {
  //       name: "Mr. Batman",
  //       email: "batman@miadi.ch",
  //       username: "batman",
  //     },
  //     {
  //       name: "Mr. Super",
  //       email: "superman@foo.ch",
  //       username: "super",
  //     },
  //   ])
  //   .returning({ id: members.id });
  // await db.transaction(async (tx) => {
  //   const [farm] = await tx
  //     .insert(farms)
  //     .values({
  //       name: "Agri Miadi",
  //       federalId: "GR3837/ 1/105",
  //       tvdId: "1070323",
  //       ownerId: battesta.id,
  //       location: sql`ST_MakePoint(9.123333, 46.307513)`,
  //     })
  //     .returning({ id: farms.id });
  //   await tx.insert(farmUsers).values({
  //     farmId: farm.id,
  //     userId: battesta.id,
  //     role: "ADMIN",
  //   });
  // });
}
main()
  .then(async () => {})
  .catch(async (e) => {
    // process.exit(1);
    console.log(e);
  })
  .finally(async () => {
    // pool already managed by postgres-js
  });
