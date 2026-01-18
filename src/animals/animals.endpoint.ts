import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getAnimalByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: tables.selectAnimalSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const animal = await animals.getAnimalById(input.animalId);
    if (!animal) {
      throw createHttpError(404, "Animal not found");
    }
    return animal;
  },
});

export const getFarmAnimalsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectAnimalSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { animals, farmId } }) => {
    const result = await animals.getAnimalsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getLivingAnimalsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectAnimalSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { animals, farmId } }) => {
    const result = await animals.getLivingAnimalsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createAnimalEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertAnimalSchema.omit({ farmId: true, id: true }),
  output: tables.selectAnimalSchema,
  handler: async ({ input, ctx: { animals } }) => {
    return animals.createAnimal(input);
  },
});

export const updateAnimalEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateAnimalSchema.omit({ id: true, farmId: true }).extend({
    animalId: z.string(),
  }),
  output: tables.selectAnimalSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const { animalId, ...data } = input;
    return animals.updateAnimal(animalId, data);
  },
});

export const deleteAnimalEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ animalId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { animalId }, ctx: { animals } }) => {
    await animals.deleteAnimal(animalId);
    return {};
  },
});

export const getAnimalChildrenEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: z.object({
    result: z.array(tables.selectAnimalSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { animals } }) => {
    const result = await animals.getChildrenOfAnimal(input.animalId);
    return {
      result,
      count: result.length,
    };
  },
});
