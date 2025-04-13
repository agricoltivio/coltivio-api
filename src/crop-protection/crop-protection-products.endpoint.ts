import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getCropProtectionProductByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ cropProtectionProductId: z.string() }),
  output: tables.selectCropProtectionProductSchema,
  handler: async ({ input, options: { cropProtectionProducts } }) => {
    const cropProtectionProduct =
      await cropProtectionProducts.getCropProtectionProductById(
        input.cropProtectionProductId
      );
    if (!cropProtectionProduct) {
      throw createHttpError(404, "CropProtectionProduct not found");
    }
    return cropProtectionProduct;
  },
});

export const getFarmCropProtectionProductsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectCropProtectionProductSchema),
    count: z.number(),
  }),
  handler: async ({ options: { cropProtectionProducts, farmId } }) => {
    const result =
      await cropProtectionProducts.getCropProtectionProductsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropProtectionProductEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertCropProtectionProductSchema.omit({
    farmId: true,
    id: true,
  }),
  output: tables.selectCropProtectionProductSchema,
  handler: async ({ input, options: { cropProtectionProducts } }) => {
    return cropProtectionProducts.createCropProtectionProduct(input);
  },
});

export const updateCropProtectionProductEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateCropProtectionProductSchema
    .omit({ id: true, farmId: true })
    .extend({
      cropProtectionProductId: z.string(),
    }),
  output: tables.selectCropProtectionProductSchema,
  handler: async ({ input, options: { cropProtectionProducts } }) => {
    return cropProtectionProducts.updateCropProtectionProduct(
      input.cropProtectionProductId,
      input
    );
  },
});

export const deleteCropProtectionProductEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ cropProtectionProductId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { cropProtectionProductId },
    options: { cropProtectionProducts: cropProtectionProduct },
  }) => {
    await cropProtectionProduct.deleteCropProtectionProduct(
      cropProtectionProductId
    );
    return {};
  },
});

export const cropProtectionProductInUseEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ cropProtectionProductId: z.string() }),
  output: z.object({ inUse: z.boolean() }),
  handler: async ({
    input: { cropProtectionProductId },
    options: { cropProtectionProducts },
  }) => {
    const inUse = await cropProtectionProducts.cropProtectionProductInUse(
      cropProtectionProductId
    );
    return { inUse };
  },
});
