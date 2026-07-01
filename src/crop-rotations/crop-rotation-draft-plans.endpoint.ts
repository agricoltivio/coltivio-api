import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  buildPlanInput,
  createDraftPlan,
  deleteDraftPlan,
  getDraftPlanById,
  listDraftPlans,
  updateDraftPlan,
} from "./crop-rotation-draft-plans";
import { cropRotationSchema, cropRotationWithRecurrenceSchema } from "./crop-rotations.endpoint";
import { planCropRotations } from "./crop-rotations";

const cropRotationsRead = permissionFarmEndpoint("field_calendar", "read");
const cropRotationsWrite = permissionFarmEndpoint("field_calendar", "write");

const draftPlanSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  createdAt: ez.dateOut(),
  updatedAt: ez.dateOut(),
});

const draftPlanRotationInputSchema = z.object({
  cropId: z.string(),
  sowingDate: ez.dateIn().optional(),
  fromDate: ez.dateIn(),
  toDate: ez.dateIn(),
  recurrenceInterval: z.number().int().min(1).optional(),
  recurrenceUntil: ez.dateIn().optional(),
});

const draftPlanPlotInputSchema = z.object({
  plotId: z.string(),
  rotations: z.array(draftPlanRotationInputSchema),
});

const draftPlanWithPlotsSchema = draftPlanSchema.extend({
  plots: z.array(
    z.object({
      id: z.string(),
      plotId: z.string(),
      rotations: z.array(cropRotationWithRecurrenceSchema),
    })
  ),
});

export const createDraftPlanEndpoint = cropRotationsWrite.build({
  method: "post",
  input: z.object({
    name: z.string(),
    plots: z.array(draftPlanPlotInputSchema).optional().default([]),
  }),
  output: draftPlanWithPlotsSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createDraftPlan(input.name, input.plots, farmId);
  },
});

export const listDraftPlansEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(draftPlanSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await listDraftPlans(farmId);
    return { result, count: result.length };
  },
});

export const getDraftPlanByIdEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({ draftPlanId: z.string() }),
  output: draftPlanWithPlotsSchema,
  handler: async ({ input }) => {
    const plan = await getDraftPlanById(input.draftPlanId);
    if (!plan) throw createHttpError(404, "Draft plan not found");
    return plan;
  },
});

export const updateDraftPlanEndpoint = cropRotationsWrite.build({
  method: "patch",
  input: z.object({
    draftPlanId: z.string(),
    name: z.string().optional(),
    plots: z.array(draftPlanPlotInputSchema).optional(),
  }),
  output: draftPlanWithPlotsSchema,
  handler: async ({ input: { draftPlanId, ...data }, ctx: { farmId } }) => {
    return updateDraftPlan(draftPlanId, data, farmId);
  },
});

export const deleteDraftPlanEndpoint = cropRotationsWrite.build({
  method: "delete",
  input: z.object({ draftPlanId: z.string() }),
  output: z.object({}),
  handler: async ({ input }) => {
    await deleteDraftPlan(input.draftPlanId);
    return {};
  },
});

export const applyDraftPlanEndpoint = cropRotationsWrite.build({
  method: "post",
  input: z.object({ draftPlanId: z.string() }),
  output: z.object({
    result: z.array(cropRotationSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    const planInput = await buildPlanInput(input.draftPlanId);
    if (!planInput) throw createHttpError(404, "Draft plan not found");

    try {
      const result = await planCropRotations(planInput, farmId);
      await deleteDraftPlan(input.draftPlanId);
      return { result, count: result.length };
    } catch (err) {
      if (err instanceof Error && err.message.includes("Overlapping")) {
        throw createHttpError(409, err.message);
      }
      throw err;
    }
  },
});
