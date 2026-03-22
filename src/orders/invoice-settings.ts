import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { invoiceSettings, farmIdColumnValue } from "../db/schema";

export type InvoiceSettings = typeof invoiceSettings.$inferSelect;
export type InvoiceSettingsUpsertInput = Omit<typeof invoiceSettings.$inferInsert, "id" | "farmId" | "updatedAt">;

export function invoiceSettingsApi(rlsDb: RlsDb) {
  return {
    async getForFarm(farmId: string): Promise<InvoiceSettings | null> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.invoiceSettings.findFirst({
          where: { farmId },
        });
        return result ?? null;
      });
    },

    async upsert(farmId: string, input: InvoiceSettingsUpsertInput): Promise<InvoiceSettings> {
      return rlsDb.rls(async (tx) => {
        const [row] = await tx
          .insert(invoiceSettings)
          .values({ ...farmIdColumnValue, ...input, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: invoiceSettings.farmId,
            set: { ...input, updatedAt: new Date() },
          })
          .returning();
        return row;
      });
    },

    async upsertLogo(farmId: string, logoData: Buffer, logoMimeType: string): Promise<InvoiceSettings> {
      return rlsDb.rls(async (tx) => {
        const [row] = await tx
          .insert(invoiceSettings)
          .values({ ...farmIdColumnValue, logoData, logoMimeType, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: invoiceSettings.farmId,
            set: { logoData, logoMimeType, updatedAt: new Date() },
          })
          .returning();
        return row;
      });
    },

    async deleteLogo(farmId: string): Promise<void> {
      await rlsDb.rls(async (tx) => {
        await tx
          .update(invoiceSettings)
          .set({ logoData: null, logoMimeType: null, updatedAt: new Date() })
          .where(eq(invoiceSettings.farmId, farmId));
      });
    },
  };
}
