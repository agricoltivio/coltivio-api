import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

const cropProtectionEquipmentResponseSchema =
  tables.selectCropProtectionEquipmentSchema;

export const getCropProtectionEquipmentByIdEndpoint = farmEndpointFactory.build(
  {
    method: "get",
    input: z.object({ cropProtectionEquipmentId: z.string() }),
    output: cropProtectionEquipmentResponseSchema,
    handler: async ({ input, options: { cropProtectionEquipment } }) => {
      const equipment =
        await cropProtectionEquipment.getCropProtectionEquipmentById(
          input.cropProtectionEquipmentId
        );
      if (!equipment) {
        throw createHttpError(404, "Traktor not found");
      }
      return equipment;
    },
  }
);

export const getFarmCropProtectionEquipmentsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
      result: z.array(cropProtectionEquipmentResponseSchema),
      count: z.number(),
    }),
    handler: async ({ options: { cropProtectionEquipment, farmId } }) => {
      const result =
        await cropProtectionEquipment.getCropProtectionEquipmentsForFarm(
          farmId
        );
      return {
        result,
        count: result.length,
      };
    },
  });

export const createCropProtectionEquipmentEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertCropProtectionEquipmentSchema.omit({
    farmId: true,
    id: true,
  }),
  output: cropProtectionEquipmentResponseSchema,
  handler: async ({ input, options: { cropProtectionEquipment } }) => {
    return cropProtectionEquipment.createCropProtectionEquipment(input);
  },
});

export const updateCropProtectionEquipmentEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateCropProtectionEquipmentSchema
    .omit({ id: true, farmId: true })
    .extend({
      cropProtectionEquipmentId: z.string(),
    }),
  output: cropProtectionEquipmentResponseSchema,
  handler: async ({ input, options: { cropProtectionEquipment } }) => {
    return cropProtectionEquipment.updateCropProtectionEquipment(
      input.cropProtectionEquipmentId,
      input
    );
  },
});

export const deleteCropProtectionEquipmentEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ cropProtectionEquipmentId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { cropProtectionEquipmentId },
    options: { cropProtectionEquipment },
  }) => {
    await cropProtectionEquipment.deleteCropProtectionEquipment(
      cropProtectionEquipmentId
    );
    return {};
  },
});
