import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getProductByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ productId: z.string() }),
  output: tables.selectProductSchema,
  handler: async ({ input, ctx: { products } }) => {
    const product = await products.getProductById(input.productId);
    if (!product) {
      throw createHttpError(404, "Product not found");
    }
    return product;
  },
});

export const getFarmProductsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectProductSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { products, farmId } }) => {
    const result = await products.getProductsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getActiveProductsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectProductSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { products, farmId } }) => {
    const result = await products.getActiveProductsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createProductEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertProductSchema.omit({ farmId: true, id: true }),
  output: tables.selectProductSchema,
  handler: async ({ input, ctx: { products } }) => {
    return products.createProduct(input);
  },
});

export const updateProductEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateProductSchema.omit({ id: true, farmId: true }).extend({
    productId: z.string(),
  }),
  output: tables.selectProductSchema,
  handler: async ({ input, ctx: { products } }) => {
    const { productId, ...data } = input;
    return products.updateProduct(productId, data);
  },
});

export const deleteProductEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ productId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { productId }, ctx: { products } }) => {
    await products.deleteProduct(productId);
    return {};
  },
});
