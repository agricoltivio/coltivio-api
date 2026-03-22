import { z } from "zod";
import { membershipEndpointFactory } from "../endpoint-factory";
import { InvoiceSettings } from "./invoice-settings";

export const invoiceSettingsSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  senderName: z.string(),
  street: z.string(),
  zip: z.string(),
  city: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  paymentTermsDays: z.number(),
  introText: z.string().nullable(),
  closingText: z.string().nullable(),
  hasLogo: z.boolean(),
  updatedAt: z.date(),
});

const invoiceSettingsInputSchema = z.object({
  senderName: z.string().optional(),
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  introText: z.string().nullable().optional(),
  closingText: z.string().nullable().optional(),
});

type InvoiceSettingsResponse = Omit<InvoiceSettings, "logoData" | "logoMimeType"> & { hasLogo: boolean };

function toSettingsResponse(row: InvoiceSettings): InvoiceSettingsResponse {
  const { logoData, logoMimeType: _mimeType, ...rest } = row;
  return { ...rest, hasLogo: logoData !== null };
}

export const getInvoiceSettingsEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({ result: invoiceSettingsSchema.nullable() }),
  handler: async ({ ctx: { farmId, invoiceSettings } }): Promise<{ result: InvoiceSettingsResponse | null }> => {
    const result = await invoiceSettings.getForFarm(farmId);
    return { result: result ? toSettingsResponse(result) : null };
  },
});

export const upsertInvoiceSettingsEndpoint = membershipEndpointFactory.build({
  method: "put",
  input: invoiceSettingsInputSchema,
  output: invoiceSettingsSchema,
  handler: async ({ input, ctx: { farmId, invoiceSettings } }): Promise<InvoiceSettingsResponse> => {
    const row = await invoiceSettings.upsert(farmId, input);
    return toSettingsResponse(row);
  },
});

export const uploadLogoEndpoint = membershipEndpointFactory.build({
  method: "put",
  input: z.object({
    base64: z.string(),
    mimeType: z.enum(["jpg", "png"]),
  }),
  output: invoiceSettingsSchema,
  handler: async ({ input, ctx: { farmId, invoiceSettings } }): Promise<InvoiceSettingsResponse> => {
    // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
    const raw = input.base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");
    const row = await invoiceSettings.upsertLogo(farmId, buffer, input.mimeType);
    return toSettingsResponse(row);
  },
});

export const deleteLogoEndpoint = membershipEndpointFactory.build({
  method: "delete",
  input: z.object({}),
  output: z.object({ success: z.boolean() }),
  handler: async ({ ctx: { farmId, invoiceSettings } }) => {
    await invoiceSettings.deleteLogo(farmId);
    return { success: true };
  },
});
