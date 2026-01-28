import createHttpError from "http-errors";
import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";

export const animalGroupSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

const createAnimalGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const updateAnimalGroupSchema = createAnimalGroupSchema.partial();

export const getAnimalGroupsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(animalGroupSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { animalGroups, farmId } }) => {
    const result = await animalGroups.getForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createAnimalGroupEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createAnimalGroupSchema,
  output: animalGroupSchema,
  handler: async ({ input, ctx: { animalGroups } }) => {
    return animalGroups.create(input);
  },
});

export const getAnimalGroupByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ groupId: z.string() }),
  output: animalGroupSchema,
  handler: async ({ input, ctx: { animalGroups } }) => {
    const group = await animalGroups.getById(input.groupId);
    if (!group) {
      throw createHttpError(404, "Animal group not found");
    }
    return group;
  },
});

export const updateAnimalGroupEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateAnimalGroupSchema.extend({
    groupId: z.string(),
  }),
  output: animalGroupSchema,
  handler: async ({ input, ctx: { animalGroups } }) => {
    const { groupId, ...data } = input;
    return animalGroups.update(groupId, data);
  },
});

export const deleteAnimalGroupEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ groupId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { groupId }, ctx: { animalGroups } }) => {
    await animalGroups.delete(groupId);
    return {};
  },
});
