import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { SupabaseToken } from "../supabase/supabase";

type Transaction = Parameters<
  Parameters<typeof clientDrizzle.transaction>[0]
>[0];

const client = postgres(process.env.APP_DATABASE_URL!, { prepare: false });
const adminClient = postgres(process.env.DATABASE_URL!, { prepare: false });

export async function disconnect() {
  await adminClient.end();
  await client.end();
}

export const clientDrizzle = drizzle({ client, schema, casing: "snake_case" });
export const adminDrizzle = drizzle({
  client: adminClient,
  schema,
  casing: "snake_case",
});

export type RlsDb = ReturnType<typeof rlsDb>;
export function rlsDb(token: SupabaseToken, farmId?: string | null) {
  async function rls<T>(
    transaction: (sql: Transaction) => T | Promise<T>
  ): Promise<T> {
    return clientDrizzle.transaction(async (tx) => {
      try {
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub', '${sql.raw(
            token.sub ?? ""
          )}', TRUE)`
        );
        if (farmId) {
          await tx.execute(
            sql`select set_config('request.farm_id', ${farmId}, TRUE)`
          );
        }
        const searchpath = await tx.execute(
          sql.raw(`select current_setting('search_path')`)
        );

        await tx.execute(sql`set local role ${sql.raw(token.role ?? "anon")}`);
        // await tx.execute(sql`
        //   -- auth.uid()
        //   select set_config('request.jwt.claim.sub', '${sql.raw(
        //     token.sub ?? ""
        //   )}', TRUE);
        //   select set_config('request.farm_id',${farmId ? `'${sql.raw(farmId)}'` : sql.raw("NULL")}, TRUE);
        //   -- set local role
        //   set local role ${sql.raw(token.role ?? "anon")};
        //   `);
        const result = await transaction(tx);
        return result;
      } finally {
        // await tx.execute(sql`
        //     -- reset
        //     select set_config('request.jwt.claim.sub', NULL, TRUE);
        //     select set_config('request.farm_id', NULL, TRUE);
        //     reset role;
        //     `);
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub', NULL, TRUE)`
        );
        if (farmId) {
          await tx.execute(
            sql`select set_config('request.farm_id', NULL, TRUE)`
          );
        }
        await tx.execute(sql`reset role`);
      }
    }) as Promise<T>;
  }
  return {
    admin: adminDrizzle,
    rls,
  };
}
