import { z } from "zod";
import JSZip from "jszip";
import createHttpError from "http-errors";
import { membershipEndpointFactory } from "../endpoint-factory";
import { generateInvoiceDocx, generateInvoicesDocxSingle } from "./invoice";
import { rlsDb as makeRlsDb } from "../db/db";
import { orders } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { SupabaseToken } from "../supabase/supabase";
import { OrderWithRelations } from "./orders";
import { InvoiceSettings } from "./invoice-settings";

// Count orders for the same farm+year with orderDate <= the given order → 1-based position = invoice number
async function deriveInvoiceNumber(order: OrderWithRelations, farmId: string, token: SupabaseToken): Promise<string> {
  const orderYear = new Date(order.orderDate).getFullYear();
  const yearStart = new Date(orderYear, 0, 1);
  const db = makeRlsDb(token, farmId);
  const [row] = await db.rls((tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.farmId, farmId),
          sql`${orders.orderDate} >= ${yearStart.toISOString().slice(0, 10)}`,
          sql`${orders.orderDate} <= ${new Date(order.orderDate).toISOString().slice(0, 10)}`
        )
      )
  );
  const position = row?.count ?? 1;
  return `${position}/${String(orderYear).slice(-2)}`;
}

function invoiceFileName(invoiceNumber: string, order: OrderWithRelations): string {
  const contactName = `${order.contact.firstName}_${order.contact.lastName}`.replace(/\s+/g, "_");
  return `Rechnung_${invoiceNumber.replace("/", "-")}_${contactName}.docx`;
}

export const downloadInvoiceEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: z.object({ base64: z.string(), fileName: z.string() }),
  handler: async ({ input, ctx }) => {
    const order = await ctx.orders.getOrderById(input.orderId);
    if (!order) throw createHttpError(404, "Order not found");

    const settings = await ctx.invoiceSettings.getForFarm(ctx.farmId);
    if (!settings) throw createHttpError(400, "Invoice settings not configured");

    const invoiceNumber = await deriveInvoiceNumber(order, ctx.farmId, ctx.token);
    const buffer = await generateInvoiceDocx(order, settings, invoiceNumber);

    return {
      base64: buffer.toString("base64"),
      fileName: invoiceFileName(invoiceNumber, order),
    };
  },
});

export const downloadInvoicesBatchEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({
    orderIds: z.array(z.string()).min(1).max(100),
    mode: z.enum(["single", "zip"]).default("single"),
  }),
  output: z.object({ base64: z.string(), fileName: z.string() }),
  handler: async ({ input, ctx }) => {
    const settings = await ctx.invoiceSettings.getForFarm(ctx.farmId);
    if (!settings) throw createHttpError(400, "Invoice settings not configured");

    const date = new Date().toISOString().slice(0, 10);

    // Resolve all orders + invoice numbers first
    const resolved = await Promise.all(
      input.orderIds.map(async (orderId) => {
        const order = await ctx.orders.getOrderById(orderId);
        if (!order) throw createHttpError(404, `Order not found: ${orderId}`);
        const invoiceNumber = await deriveInvoiceNumber(order, ctx.farmId, ctx.token);
        return { order, invoiceNumber, settings: settings as InvoiceSettings };
      })
    );

    if (input.mode === "single") {
      const buffer = await generateInvoicesDocxSingle(resolved);
      return { base64: buffer.toString("base64"), fileName: `Rechnungen_${date}.docx` };
    }

    // mode === "zip": one DOCX per invoice
    const zip = new JSZip();
    await Promise.all(
      resolved.map(async ({ order, invoiceNumber }) => {
        const buffer = await generateInvoiceDocx(order, settings as InvoiceSettings, invoiceNumber);
        zip.file(invoiceFileName(invoiceNumber, order), buffer);
      })
    );
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return { base64: zipBuffer.toString("base64"), fileName: `Rechnungen_${date}.zip` };
  },
});
