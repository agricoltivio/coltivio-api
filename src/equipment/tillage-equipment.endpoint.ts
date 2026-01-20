import createHttpError from "http-errors";
import { z } from "zod";
import { tillageActionSchema, tillageReasonSchema } from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

// API Schemas - decoupled from database schema for stable API contract
export const tillageEquipmentSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  action: tillageActionSchema,
  reason: tillageReasonSchema,
});

const createTillageEquipmentSchema = z.object({
  name: z.string(),
  action: tillageActionSchema,
  reason: tillageReasonSchema,
});

const updateTillageEquipmentSchema = createTillageEquipmentSchema.partial();

const tillageEquipmentResponseSchema = tillageEquipmentSchema;

export const getTillageEquipmentByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ tillageEquipmentId: z.string() }),
  output: tillageEquipmentResponseSchema,
  handler: async ({ input, ctx: { tillageEquipments } }) => {
    const tillageEquipment = await tillageEquipments.getTillageEquipmentById(
      input.tillageEquipmentId
    );
    if (!tillageEquipment) {
      throw createHttpError(404, "Traktor not found");
    }
    return tillageEquipment;
  },
});

export const getFarmTillageEquipmentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tillageEquipmentResponseSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { tillageEquipments, farmId } }) => {
    const result = await tillageEquipments.getTillageEquipmentForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createTillageEquipmentEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createTillageEquipmentSchema,
  output: tillageEquipmentResponseSchema,
  handler: async ({ input, ctx: { tillageEquipments } }) => {
    return tillageEquipments.createTillageEquipment(input);
  },
});

export const updateTillageEquipmentEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateTillageEquipmentSchema.extend({
    tillageEquipmentId: z.string(),
  }),
  output: tillageEquipmentResponseSchema,
  handler: async ({ input, ctx: { tillageEquipments } }) => {
    return tillageEquipments.updateTillageEquipment(
      input.tillageEquipmentId,
      input
    );
  },
});

export const deleteTillageEquipmentEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ tillageEquipmentId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { tillageEquipmentId },
    ctx: { tillageEquipments },
  }) => {
    await tillageEquipments.deleteTillageEquipment(tillageEquipmentId);
    return {};
  },
});
