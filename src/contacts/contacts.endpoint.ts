// import { z } from "zod";
// import { sessionEndpointFactory } from "../endpoint-factory";
// import * as tables from "../db/schema";
// import {
//   createContact,
//   deleteContact,
//   getContactById,
//   getContactsForFarm,
//   updateContact,
// } from "./contacts";
// import createHttpError from "http-errors";

// export const getContactsForFarmEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ farmId: z.string() }),
//   output: z.object({
//     result: z.array(tables.selectContactSchema),
//     count: z.number(),
//   }),
//   handler: async ({ input, options }) => {
//     const contacts = await getContactsForFarm(input.farmId);

//     return { result: contacts, count: contacts.length };
//   },
// });

// export const getContactByIdEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ contactId: z.string() }),
//   output: tables.selectContactSchema,
//   handler: async ({ input, options }) => {
//     const contact = await getContactById(input.contactId);
//     if (!contact) {
//       throw createHttpError(404, "Contact not found");
//     }
//     return contact;
//   },
// });

// export const createContactEndpoint = sessionEndpointFactory.build({
//   method: "post",
//   input: tables.insertContactSchema,
//   output: tables.selectContactSchema,
//   handler: async ({ input, options }) => {
//     return createContact(input);
//   },
// });

// export const updateContactEndpoint = sessionEndpointFactory.build({
//   method: "patch",
//   input: tables.updateContactSchema,
//   output: tables.selectContactSchema,
//   handler: async ({ input, options }) => {
//     return updateContact(input.id, input);
//   },
// });

// export const deleteContactEndpoint = sessionEndpointFactory.build({
//   method: "delete",
//   input: z.object({ contactId: z.string() }),
//   output: z.object({}),
//   handler: async ({ input: { contactId }, options }) => {
//     await deleteContact(contactId);
//     return {};
//   },
// });
