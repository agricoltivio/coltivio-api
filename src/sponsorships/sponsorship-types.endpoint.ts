import createHttpError from "http-errors";
import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";

// API Schemas - decoupled from database schema for stable API contract
export const sponsorshipTypeSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  yearlyCost: z.number(),
});

const createSponsorshipTypeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  yearlyCost: z.number(),
});

const updateSponsorshipTypeSchema = createSponsorshipTypeSchema.partial();

export const getSponsorshipTypeByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ sponsorshipTypeId: z.string() }),
  output: sponsorshipTypeSchema,
  handler: async ({ input, ctx: { sponsorshipTypes } }) => {
    const sponsorshipType = await sponsorshipTypes.getSponsorshipTypeById(
      input.sponsorshipTypeId,
    );
    if (!sponsorshipType) {
      throw createHttpError(404, "Sponsorship type not found");
    }
    return sponsorshipType;
  },
});

export const getFarmSponsorshipTypesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(sponsorshipTypeSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { sponsorshipTypes, farmId } }) => {
    const result = await sponsorshipTypes.getSponsorshipTypesForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createSponsorshipTypeEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createSponsorshipTypeSchema,
  output: sponsorshipTypeSchema,
  handler: async ({ input, ctx: { sponsorshipTypes } }) => {
    return sponsorshipTypes.createSponsorshipType(input);
  },
});

export const updateSponsorshipTypeEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateSponsorshipTypeSchema.extend({
    sponsorshipTypeId: z.string(),
  }),
  output: sponsorshipTypeSchema,
  handler: async ({ input, ctx: { sponsorshipTypes } }) => {
    const { sponsorshipTypeId, ...data } = input;
    return sponsorshipTypes.updateSponsorshipType(sponsorshipTypeId, data);
  },
});

export const deleteSponsorshipTypeEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ sponsorshipTypeId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { sponsorshipTypeId },
    ctx: { sponsorshipTypes },
  }) => {
    await sponsorshipTypes.deleteSponsorshipType(sponsorshipTypeId);
    return {};
  },
});
