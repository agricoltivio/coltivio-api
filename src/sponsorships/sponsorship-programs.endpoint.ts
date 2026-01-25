import createHttpError from "http-errors";
import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";

export const sponsorshipProgramSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  yearlyCost: z.number(),
});

const createSponsorshipProgramSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  yearlyCost: z.number(),
});

const updateSponsorshipProgramSchema = createSponsorshipProgramSchema.partial();

export const getSponsorshipProgramByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ sponsorshipProgramId: z.string() }),
  output: sponsorshipProgramSchema,
  handler: async ({ input, ctx: { sponsorshipPrograms } }) => {
    const sponsorshipProgram =
      await sponsorshipPrograms.getSponsorshipProgramById(
        input.sponsorshipProgramId,
      );
    if (!sponsorshipProgram) {
      throw createHttpError(404, "Sponsorship type not found");
    }
    return sponsorshipProgram;
  },
});

export const getFarmSponsorshipProgramsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(sponsorshipProgramSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { sponsorshipPrograms, farmId } }) => {
    const result =
      await sponsorshipPrograms.getSponsorshipProgramsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createSponsorshipProgramEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createSponsorshipProgramSchema,
  output: sponsorshipProgramSchema,
  handler: async ({ input, ctx: { sponsorshipPrograms } }) => {
    return sponsorshipPrograms.createSponsorshipProgram(input);
  },
});

export const updateSponsorshipProgramEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateSponsorshipProgramSchema.extend({
    sponsorshipProgramId: z.string(),
  }),
  output: sponsorshipProgramSchema,
  handler: async ({ input, ctx: { sponsorshipPrograms } }) => {
    const { sponsorshipProgramId, ...data } = input;
    return sponsorshipPrograms.updateSponsorshipProgram(
      sponsorshipProgramId,
      data,
    );
  },
});

export const deleteSponsorshipProgramEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ sponsorshipProgramId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { sponsorshipProgramId },
    ctx: { sponsorshipPrograms },
  }) => {
    await sponsorshipPrograms.deleteSponsorshipProgram(sponsorshipProgramId);
    return {};
  },
});
