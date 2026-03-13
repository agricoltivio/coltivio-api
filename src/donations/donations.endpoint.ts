import { z } from "zod";
import { publicEndpointFactory } from "../endpoint-factory";
import { donationsApi } from "./donations";
import { adminOnlyDb } from "../db/db";

const api = donationsApi(adminOnlyDb);

export const createDonationCheckoutEndpoint = publicEndpointFactory.build({
  method: "post",
  input: z.object({
    amount: z.number().int().min(100),
    email: z.string().email(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  }),
  output: z.object({ url: z.string() }),
  handler: async ({ input }) => {
    return api.createDonationCheckout(
      input.amount,
      input.email,
      input.successUrl,
      input.cancelUrl,
    );
  },
});
