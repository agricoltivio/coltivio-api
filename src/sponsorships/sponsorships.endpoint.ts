import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getSponsorshipByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ sponsorshipId: z.string() }),
  output: tables.selectSponsorshipSchema,
  handler: async ({ input, ctx: { sponsorships } }) => {
    const sponsorship = await sponsorships.getSponsorshipById(
      input.sponsorshipId,
    );
    if (!sponsorship) {
      throw createHttpError(404, "Sponsorship not found");
    }
    return sponsorship;
  },
});

export const getFarmSponsorshipsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectSponsorshipSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { sponsorships, farmId } }) => {
    const result = await sponsorships.getSponsorshipsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getContactSponsorshipsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ contactId: z.string() }),
  output: z.object({
    result: z.array(tables.selectSponsorshipSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { sponsorships } }) => {
    const result = await sponsorships.getSponsorshipsForContact(
      input.contactId,
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const getAnimalSponsorshipsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: z.object({
    result: z.array(tables.selectSponsorshipSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { sponsorships } }) => {
    const result = await sponsorships.getSponsorshipsForAnimal(input.animalId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getSponsorshipPaymentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ sponsorshipId: z.string() }),
  output: z.object({
    result: z.array(tables.selectPaymentSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { sponsorships } }) => {
    const result = await sponsorships.getPaymentsForSponsorship(
      input.sponsorshipId,
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const createSponsorshipEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertSponsorshipSchema.omit({ farmId: true, id: true }),
  output: tables.selectSponsorshipSchema,
  handler: async ({ input, ctx: { sponsorships } }) => {
    return sponsorships.createSponsorship(input);
  },
});

export const updateSponsorshipEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateSponsorshipSchema
    .omit({ id: true, farmId: true })
    .extend({
      sponsorshipId: z.string(),
    }),
  output: tables.selectSponsorshipSchema,
  handler: async ({ input, ctx: { sponsorships } }) => {
    const { sponsorshipId, ...data } = input;
    return sponsorships.updateSponsorship(sponsorshipId, data);
  },
});

export const deleteSponsorshipEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ sponsorshipId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { sponsorshipId }, ctx: { sponsorships } }) => {
    await sponsorships.deleteSponsorship(sponsorshipId);
    return {};
  },
});
