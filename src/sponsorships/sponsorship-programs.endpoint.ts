import createHttpError from "http-errors";
import { z } from "zod";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  createSponsorshipProgram,
  deleteSponsorshipProgram,
  getSponsorshipProgramById,
  getSponsorshipProgramsForFarm,
  updateSponsorshipProgram,
} from "./sponsorship-programs";

const sponsorshipProgramsRead = permissionFarmEndpoint("commerce", "read");
const sponsorshipsWrite = permissionFarmEndpoint("commerce", "write");

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

export const getSponsorshipProgramByIdEndpoint = sponsorshipProgramsRead.build({
  method: "get",
  input: z.object({ sponsorshipProgramId: z.string() }),
  output: sponsorshipProgramSchema,
  handler: async ({ input }) => {
    const sponsorshipProgram = await getSponsorshipProgramById(input.sponsorshipProgramId);
    if (!sponsorshipProgram) {
      throw createHttpError(404, "Sponsorship type not found");
    }
    return sponsorshipProgram;
  },
});

export const getFarmSponsorshipProgramsEndpoint = sponsorshipProgramsRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(sponsorshipProgramSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getSponsorshipProgramsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createSponsorshipProgramEndpoint = sponsorshipsWrite.build({
  method: "post",
  input: createSponsorshipProgramSchema,
  output: sponsorshipProgramSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createSponsorshipProgram(input, farmId);
  },
});

export const updateSponsorshipProgramEndpoint = sponsorshipsWrite.build({
  method: "patch",
  input: updateSponsorshipProgramSchema.extend({
    sponsorshipProgramId: z.string(),
  }),
  output: sponsorshipProgramSchema,
  handler: async ({ input }) => {
    const { sponsorshipProgramId, ...data } = input;
    return updateSponsorshipProgram(sponsorshipProgramId, data);
  },
});

export const deleteSponsorshipProgramEndpoint = sponsorshipsWrite.build({
  method: "delete",
  input: z.object({ sponsorshipProgramId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { sponsorshipProgramId } }) => {
    await deleteSponsorshipProgram(sponsorshipProgramId);
    return {};
  },
});
