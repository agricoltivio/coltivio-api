import { eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { invoiceSettings } from "../db/schema";

export type InvoiceSettings = typeof invoiceSettings.$inferSelect;
export type InvoiceSettingsCreateInput = Omit<typeof invoiceSettings.$inferInsert, "id" | "farmId" | "updatedAt">;
export type InvoiceSettingsUpdateInput = Partial<InvoiceSettingsCreateInput>;

export async function listInvoiceSettingsForFarm(farmId: string): Promise<InvoiceSettings[]> {
  return appDrizzle.query.invoiceSettings.findMany({ where: { farmId } });
}

export async function getInvoiceSettingsById(id: string): Promise<InvoiceSettings | null> {
  const result = await appDrizzle.query.invoiceSettings.findFirst({ where: { id } });
  return result ?? null;
}

export async function createInvoiceSettings(
  farmId: string,
  input: InvoiceSettingsCreateInput
): Promise<InvoiceSettings> {
  const [row] = await appDrizzle
    .insert(invoiceSettings)
    .values({ farmId, ...input, updatedAt: new Date() })
    .returning();
  return row;
}

export async function updateInvoiceSettings(id: string, input: InvoiceSettingsUpdateInput): Promise<InvoiceSettings> {
  const [row] = await appDrizzle
    .update(invoiceSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(invoiceSettings.id, id))
    .returning();
  return row;
}

export async function deleteInvoiceSettings(id: string): Promise<void> {
  await appDrizzle.delete(invoiceSettings).where(eq(invoiceSettings.id, id));
}

export async function upsertInvoiceSettingsLogo(
  id: string,
  logoData: Buffer,
  logoMimeType: string
): Promise<InvoiceSettings> {
  const [row] = await appDrizzle
    .update(invoiceSettings)
    .set({ logoData, logoMimeType, updatedAt: new Date() })
    .where(eq(invoiceSettings.id, id))
    .returning();
  return row;
}

export async function deleteInvoiceSettingsLogo(id: string): Promise<void> {
  await appDrizzle
    .update(invoiceSettings)
    .set({ logoData: null, logoMimeType: null, updatedAt: new Date() })
    .where(eq(invoiceSettings.id, id));
}
