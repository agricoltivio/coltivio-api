import createHttpError from "http-errors";
import { z } from "zod";
import {
  cropProtectionApplicationMethodSchema,
  cropProtectionUnitSchema,
} from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const cropProtectionEquipmentSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  method: cropProtectionApplicationMethodSchema,
  unit: cropProtectionUnitSchema,
  capacity: z.number(),
});

const createCropProtectionEquipmentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  method: cropProtectionApplicationMethodSchema,
  unit: cropProtectionUnitSchema,
  capacity: z.number(),
});

const updateCropProtectionEquipmentSchema =
  createCropProtectionEquipmentSchema.partial();

const cropProtectionEquipmentResponseSchema = cropProtectionEquipmentSchema;

export const getCropProtectionEquipmentByIdEndpoint = farmEndpointFactory.build(
  {
    method: "get",
    input: z.object({ cropProtectionEquipmentId: z.string() }),
    output: cropProtectionEquipmentResponseSchema,
    handler: async ({ input, ctx: { cropProtectionEquipment } }) => {
      const equipment =
        await cropProtectionEquipment.getCropProtectionEquipmentById(
          input.cropProtectionEquipmentId,
        );
      if (!equipment) {
        throw createHttpError(404, "Traktor not found");
      }
      return equipment;
    },
  },
);

export const getFarmCropProtectionEquipmentsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
      result: z.array(cropProtectionEquipmentResponseSchema),
      count: z.number(),
    }),
    handler: async ({ ctx: { cropProtectionEquipment, farmId } }) => {
      const result =
        await cropProtectionEquipment.getCropProtectionEquipmentsForFarm(
          farmId,
        );
      return {
        result,
        count: result.length,
      };
    },
  });

export const createCropProtectionEquipmentEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createCropProtectionEquipmentSchema,
  output: cropProtectionEquipmentResponseSchema,
  handler: async ({ input, ctx: { cropProtectionEquipment } }) => {
    return cropProtectionEquipment.createCropProtectionEquipment(input);
  },
});

export const updateCropProtectionEquipmentEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateCropProtectionEquipmentSchema.extend({
    cropProtectionEquipmentId: z.string(),
  }),
  output: cropProtectionEquipmentResponseSchema,
  handler: async ({ input, ctx: { cropProtectionEquipment } }) => {
    return cropProtectionEquipment.updateCropProtectionEquipment(
      input.cropProtectionEquipmentId,
      input,
    );
  },
});

export const deleteCropProtectionEquipmentEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ cropProtectionEquipmentId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { cropProtectionEquipmentId },
    ctx: { cropProtectionEquipment },
  }) => {
    await cropProtectionEquipment.deleteCropProtectionEquipment(
      cropProtectionEquipmentId,
    );
    return {};
  },
});
