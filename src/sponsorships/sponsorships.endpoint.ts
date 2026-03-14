import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { animalSchema } from "../animals/animals.endpoint";
import { contactSchema } from "../contacts/contacts.endpoint";
import { preferredCommunicationSchema } from "../db/schema";
import { membershipEndpointFactory } from "../endpoint-factory";
import { paymentSchema } from "../payments/payments.endpoint";
import { sponsorshipProgramSchema } from "./sponsorship-programs.endpoint";

export const sponsorshipSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  contactId: z.string(),
  animalId: z.string(),
  sponsorshipProgramId: z.string(),
  startDate: ez.dateOut(),
  endDate: ez.dateOut().nullable(),
  notes: z.string().nullable(),
  preferredCommunication: preferredCommunicationSchema.nullable(),
});

export const sponsorshipWithRelationsSchema = sponsorshipSchema.extend({
  get contact() {
    return contactSchema;
  },
  get animal() {
    return animalSchema.omit({ earTag: true });
  },
  get payments() {
    return z.array(paymentSchema);
  },
  get sponsorshipProgram() {
    return sponsorshipProgramSchema;
  },
});

const createSponsorshipSchema = z.object({
  contactId: z.string(),
  animalId: z.string(),
  sponsorshipProgramId: z.string(),
  startDate: ez.dateIn(),
  endDate: ez.dateIn().optional(),
  notes: z.string().optional(),
  preferredCommunication: preferredCommunicationSchema.optional(),
});

const updateSponsorshipSchema = createSponsorshipSchema.partial();

export const getSponsorshipByIdEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({ sponsorshipId: z.string() }),
  output: sponsorshipWithRelationsSchema,
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

const sponsorshipWithPaidFlagSchema = sponsorshipWithRelationsSchema.extend({
  paidThisYear: z.boolean(),
});

export const getFarmSponsorshipsEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({ onlyActive: z.boolean().optional().default(true) }),
  output: z.object({
    result: z.array(sponsorshipWithPaidFlagSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { sponsorships, farmId } }) => {
    const rawResult = await sponsorships.getSponsorshipsForFarm(
      farmId,
      input.onlyActive,
    );
    const currentYear = new Date().getFullYear();
    const result = rawResult.map((sponsorship) => {
      const paidThisYear =
        sponsorship.payments
          .filter((p) => new Date(p.date).getFullYear() === currentYear)
          .reduce((sum, p) => sum + p.amount, 0) >=
        sponsorship.sponsorshipProgram.yearlyCost;
      return { ...sponsorship, paidThisYear };
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const getContactSponsorshipsEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({
    contactId: z.string(),
    onlyActive: z.boolean().optional().default(true),
  }),
  output: z.object({
    result: z.array(sponsorshipWithRelationsSchema.omit({ contact: true })),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { sponsorships } }) => {
    const result = await sponsorships.getSponsorshipsForContact(
      input.contactId,
      input.onlyActive,
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const getAnimalSponsorshipsEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({
    animalId: z.string(),
    onlyActive: z.boolean().optional().default(true),
  }),
  output: z.object({
    result: z.array(sponsorshipWithRelationsSchema.omit({ animal: true })),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { sponsorships } }) => {
    const result = await sponsorships.getSponsorshipsForAnimal(
      input.animalId,
      input.onlyActive,
    );
    return {
      result,
      count: result.length,
    };
  },
});

// export const getSponsorshipPaymentsEndpoint = membershipEndpointFactory.build({
//   method: "get",
//   input: z.object({ sponsorshipId: z.string() }),
//   output: z.object({
//     result: z.array(paymentSchema),
//     count: z.number(),
//   }),
//   handler: async ({ input, ctx: { sponsorships } }) => {
//     const result = await sponsorships.getPaymentsForSponsorship(
//       input.sponsorshipId,
//     );
//     return {
//       result,
//       count: result.length,
//     };
//   },
// });

export const createSponsorshipEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: createSponsorshipSchema,
  output: sponsorshipSchema,
  handler: async ({ input, ctx: { sponsorships } }) => {
    return sponsorships.createSponsorship(input);
  },
});

export const updateSponsorshipEndpoint = membershipEndpointFactory.build({
  method: "patch",
  input: updateSponsorshipSchema.extend({
    sponsorshipId: z.string(),
  }),
  output: sponsorshipSchema,
  handler: async ({ input, ctx: { sponsorships } }) => {
    const { sponsorshipId, ...data } = input;
    return sponsorships.updateSponsorship(sponsorshipId, data);
  },
});

export const deleteSponsorshipEndpoint = membershipEndpointFactory.build({
  method: "delete",
  input: z.object({ sponsorshipId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { sponsorshipId }, ctx: { sponsorships } }) => {
    await sponsorships.deleteSponsorship(sponsorshipId);
    return {};
  },
});
