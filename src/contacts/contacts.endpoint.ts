import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getContactByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ contactId: z.string() }),
  output: tables.selectContactSchema,
  handler: async ({ input, ctx: { contacts } }) => {
    const contact = await contacts.getContactById(input.contactId);
    if (!contact) {
      throw createHttpError(404, "Contact not found");
    }
    return contact;
  },
});

export const getFarmContactsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectContactSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { contacts, farmId } }) => {
    const result = await contacts.getContactsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createContactEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertContactSchema.omit({ farmId: true, id: true }),
  output: tables.selectContactSchema,
  handler: async ({ input, ctx: { contacts } }) => {
    return contacts.createContact(input);
  },
});

export const updateContactEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateContactSchema.omit({ id: true, farmId: true }).extend({
    contactId: z.string(),
  }),
  output: tables.selectContactSchema,
  handler: async ({ input, ctx: { contacts } }) => {
    const { contactId, ...data } = input;
    return contacts.updateContact(contactId, data);
  },
});

export const deleteContactEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ contactId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { contactId }, ctx: { contacts } }) => {
    await contacts.deleteContact(contactId);
    return {};
  },
});
