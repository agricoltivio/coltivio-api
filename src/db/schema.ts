import { and, eq, isNotNull, or, relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgRole,
  pgSchema,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { ez } from "express-zod-api";
import { z } from "zod";

const polygon = customType<{ data: string }>({
  dataType() {
    return "geometry(MultiPolygon,4326)";
  },
});
const point = customType<{ data: string }>({
  dataType() {
    return "geometry(Point,4326)";
  },
});

export const currentFarmId = sql.raw(`farm_id()`);
export const farmIdColumnValue = { farmId: currentFarmId };

const appRole = pgRole("rls_client").existing();
const extensions = pgSchema("extensions");

export const federalFarmPlots = pgTable(
  "federal_farm_plots",
  {
    id: uuid().primaryKey().defaultRandom(),
    federalFarmId: text("farm_id").notNull(),
    localId: text(),
    usage: integer().notNull(),
    additionalUsages: text("a_usages"),
    area: integer().notNull(),
    cuttingDate: date("cut_date", { mode: "date" }),
    canton: text().notNull(),
    geometry: polygon().notNull(),
  },

  (table) => [
    index("federal_farm_plots_geometries_idx").using("gist", table.geometry),
    index("federal_farm_id_idx").using(
      "gin",
      table.federalFarmId.op("gin_trgm_ops")
    ),
    pgPolicy("authenticated users can read", {
      as: "permissive",
      to: authenticatedRole,
      for: "select",
      using: sql`true`,
    }),
  ]
).enableRLS();

export const federalParcels = pgTable(
  "federal_parcels",
  {
    id: uuid().primaryKey().defaultRandom(),
    gisId: integer().notNull().unique(),
    // shp files only allow 10character property names
    federalFarmId: text("fed_farm").notNull(),
    area: integer().notNull(),
    communalId: text("commun_id").notNull(),
    geometry: polygon().notNull(),
    sourceGisIds: varchar("source_ids", { length: 254 }).notNull(),
  },

  (table) => [
    index("federal_parcel_geometries_idx").using("gist", table.geometry),
    index("federal_farm_ids_idx").using(
      "gin",
      table.federalFarmId.op("gin_trgm_ops")
    ),
    pgPolicy("authenticated users can read", {
      as: "permissive",
      to: authenticatedRole,
      for: "select",
      using: sql`true`,
    }),
  ]
).enableRLS();

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull().unique(),
    fullName: text(),
    farmId: uuid().references(() => farms.id, { onDelete: "set null" }),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "profiles_id_fk",
    }).onDelete("cascade"),
    pgPolicy("user can insert own profile", {
      as: "permissive",
      to: authenticatedRole,
      for: "insert",
      withCheck: eq(authUid, table.id),
    }),
    pgPolicy("user can update own profile", {
      as: "permissive",
      to: authenticatedRole,
      for: "update",
      using: eq(authUid, table.id),
    }),
    pgPolicy(
      "members of same farm can read each others profile and owners can read their own profile",
      {
        as: "permissive",
        to: authenticatedRole,
        for: "select",
        using: or(
          and(isNotNull(table.farmId), eq(table.farmId, currentFarmId)),
          eq(authUid, table.id)
        ),
      }
    ),
  ]
).enableRLS();

export const profileRelations = relations(profiles, ({ one }) => ({
  farms: one(farms, {
    fields: [profiles.farmId],
    references: [farms.id],
  }),
}));

export const farms = pgTable(
  "farms",
  {
    id: uuid().primaryKey().defaultRandom(),
    federalId: text(),
    tvdId: text(),
    name: text().notNull(),
    address: text().notNull(),
    location: point(),
  },
  (table) => [
    pgPolicy("any user can create a new farm", {
      as: "permissive",
      to: authenticatedRole,
      for: "insert",
      withCheck: sql`true`,
    }),
    pgPolicy("only farm members can read", {
      as: "permissive",
      to: authenticatedRole,
      for: "select",
      using: eq(currentFarmId, table.id),
    }),
    pgPolicy("only farm members can update", {
      as: "permissive",
      to: authenticatedRole,
      for: "update",
      using: eq(currentFarmId, table.id),
      withCheck: eq(currentFarmId, table.id),
    }),
    pgPolicy("only farm members can delete", {
      as: "permissive",
      to: authenticatedRole,
      for: "delete",
      using: eq(currentFarmId, table.id),
    }),
  ]
).enableRLS();

export const farmRelations = relations(farms, ({ many, one }) => ({
  users: many(profiles),
  parcels: many(parcels),
  plots: many(plots),
  harvests: many(harvests),
  fertilizerApplications: many(fertilizerApplications),
  harvestingMachinery: many(harvestingMachinery),
}));

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "USER",
  "CONTRACTOR",
]);

export const parcels = pgTable(
  "parcels",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    communalId: text().notNull(),
    gisId: integer(),
    geometry: polygon(),
    size: integer().notNull(),
  },

  (table) => [
    index("parcel_geometries_idx").using("gist", table.geometry),
    index("parcel_gisid_idx").on(table.gisId),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const parcelRelations = relations(parcels, ({ one, many }) => ({
  farm: one(farms, {
    fields: [parcels.farmId],
    references: [farms.id],
  }),
}));

export const cropRotations = pgTable(
  "crop_rotations",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    plotId: uuid()
      .notNull()
      .references(() => plots.id, { onDelete: "cascade" }),
    cropId: uuid()
      .notNull()
      .references(() => crops.id),
    sowingDate: date({ mode: "date" }),
    fromDate: date({ mode: "date" }).notNull(),
    toDate: date({ mode: "date" }),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const cropRotationsRelations = relations(
  cropRotations,
  ({ one, many }) => ({
    farm: one(farms, {
      fields: [cropRotations.farmId],
      references: [farms.id],
    }),
    plot: one(plots, {
      fields: [cropRotations.plotId],
      references: [plots.id],
    }),
    crop: one(crops, {
      fields: [cropRotations.cropId],
      references: [crops.id],
    }),
  })
);

export const tillageReason = pgEnum("tillage_reason", [
  "weed_control",
  // "pest_control",
  "soil_loosening",
  "other",
]);

export const tillageAction = pgEnum("tillage_action", [
  // soil preparation
  "plowing",
  "tilling",
  "harrowing",
  "rolling",
  "rotavating",
  // weed control,
  "weed_harrowing", // striegel
  "hoeing",
  "flame_weeding",
  "other",
]);

export const tillageEquipment = pgTable(
  "tillage_equipment",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    action: tillageAction().notNull(),
    reason: tillageReason().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const tillages = pgTable(
  "tillages",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp().notNull().defaultNow(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    plotId: uuid()
      .notNull()
      .references(() => plots.id, { onDelete: "cascade" }),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    reason: tillageReason().notNull(),
    action: tillageAction().notNull(),
    equipmentId: uuid().references(() => tillageEquipment.id),
    date: date({ mode: "date" }).notNull(),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const tillagesRelations = relations(tillages, ({ one }) => ({
  equipment: one(tillageEquipment, {
    fields: [tillages.equipmentId],
    references: [tillageEquipment.id],
  }),
  plot: one(plots, {
    fields: [tillages.plotId],
    references: [plots.id],
  }),
}));

export const cropProtectionUnit = pgEnum("crop_protection_unit", [
  "ml",
  "l",
  "g",
  "kg",
]);

export const cropProtectionProducts = pgTable(
  "crop_protection_products",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    unit: cropProtectionUnit().notNull(),
    description: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
);

export const cropProtectionApplicationMehtod = pgEnum(
  "crop_protection_application_method",
  ["spraying", "misting", "broadcasting", "injecting", "other"]
);

export const cropProtectionEquipment = pgTable(
  "crop_protection_equipment",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    description: text(),
    method: cropProtectionApplicationMehtod().notNull(),
    unit: cropProtectionUnit().notNull(),
    capacity: integer().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
);

export const cropProtectionApplications = pgTable(
  "crop_protection_applications",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp().notNull().defaultNow(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    plotId: uuid()
      .notNull()
      .references(() => plots.id, { onDelete: "cascade" }),
    dateTime: timestamp().notNull(),
    equipmentId: uuid().references(() => cropProtectionEquipment.id),
    productId: uuid()
      .notNull()
      .references(() => cropProtectionProducts.id),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    method: cropProtectionApplicationMehtod().notNull(),
    amountPerApplication: integer().notNull(),
    numberOfApplications: real().notNull(),
    unit: cropProtectionUnit().notNull(),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
);

export const cropProtectionApplicationRelations = relations(
  cropProtectionApplications,
  ({ one }) => ({
    equipment: one(cropProtectionEquipment, {
      fields: [cropProtectionApplications.equipmentId],
      references: [cropProtectionEquipment.id],
    }),
    plot: one(plots, {
      fields: [cropProtectionApplications.plotId],
      references: [plots.id],
    }),
    product: one(cropProtectionProducts, {
      fields: [cropProtectionApplications.productId],
      references: [cropProtectionProducts.id],
    }),
  })
);

export const plots = pgTable(
  "plots",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    description: text(),
    localId: text(), // parcel number
    usage: integer(),
    additionalUsages: text(),
    cuttingDate: date({ mode: "date" }),
    geometry: polygon().notNull(),
    size: integer().notNull(),
  },

  (table) => [
    index("plot_geometries_idx").using("gist", table.geometry),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const plotRelations = relations(plots, ({ one, many }) => ({
  farm: one(farms, {
    fields: [plots.farmId],
    references: [farms.id],
  }),
  cropRotations: many(cropRotations),
  harvests: many(harvests),
  tillages: many(tillages),
  cropProtectionApplications: many(cropProtectionApplications),
  fertilizerApplications: many(fertilizerApplications),
}));

export const conservationMethod = pgEnum("forage_conservation_method", [
  "dried",
  "silage",
  "haylage",
  "other",
  "none",
]);
export const processingType = pgEnum("forage_processing_type", [
  "none",
  "square_bale",
  "round_bale",
  "other",
]);

export const cropCategory = pgEnum("crop_category", [
  "grass",
  "grain",
  "vegetable",
  "fruit",
  "other",
]);

export const crops = pgTable(
  "crops",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    naturalMeadow: boolean().notNull().default(false),
    category: cropCategory().notNull(),
    variety: text(),
    usageCodes: integer().array().notNull().default([]),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const harvestingMachinery = pgTable(
  "harvesting_machinery",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    default: boolean().notNull().default(false),
    defaultConservationMethod: conservationMethod().notNull(),
    defaultProcessingType: processingType().notNull(),
    defaultKilosPerUnit: integer().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const harvestingMachineryRelations = relations(
  harvestingMachinery,
  ({ one, many }) => ({
    farm: one(farms, {
      fields: [harvestingMachinery.farmId],
      references: [farms.id],
    }),
    harvests: many(harvests),
  })
);

export const harvests = pgTable(
  "forage_harvests",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp().notNull().defaultNow(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    date: date({ mode: "date" }).notNull(),
    plotId: uuid()
      .notNull()
      .references(() => plots.id, { onDelete: "cascade" }),
    cropId: uuid()
      .notNull()
      .references(() => crops.id),
    conservationMethod: conservationMethod().notNull(),
    processingType: processingType().notNull(),
    kilosPerUnit: real().notNull(),
    producedUnits: real().notNull(),
    harvestCount: integer(),
    machineryId: uuid().references(() => harvestingMachinery.id, {
      onDelete: "set null",
    }),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const harvestsRelations = relations(harvests, ({ one, many }) => ({
  plot: one(plots, {
    fields: [harvests.plotId],
    references: [plots.id],
  }),
  crop: one(crops, {
    fields: [harvests.cropId],
    references: [crops.id],
  }),
  machinery: one(harvestingMachinery, {
    fields: [harvests.machineryId],
    references: [harvestingMachinery.id],
  }),
}));

export const fertilizerUnit = pgEnum("fertilizer_unit", [
  "l",
  "kg",
  "dt",
  "t",
  "m3",
]);

export const fertilizerType = pgEnum("fertilizer_type", ["mineral", "organic"]);
export const fertilizationMethod = pgEnum("fertilization_method", [
  "spray",
  "spread",
  "other",
]);

export const fertilizerSpreaders = pgTable(
  "fertilizer_spreaders",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    unit: fertilizerUnit().notNull(),
    defaultMethod: fertilizationMethod().notNull(),
    capacity: real().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const fertilizerSpreadersRelations = relations(
  fertilizerSpreaders,
  ({ one, many }) => ({
    farm: one(farms, {
      fields: [fertilizerSpreaders.farmId],
      references: [farms.id],
    }),
    fertilizationApplications: many(fertilizerApplications),
  })
);

export const fertilizers = pgTable(
  "fertilizers",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    description: text(),
    type: fertilizerType().notNull(),
    unit: fertilizerUnit().notNull(),
    // nitrogenPerUnit: real(),
    // phosphorusPerUnit: real(),
    // potassiumPerUnit: real(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const fertilizerRelations = relations(fertilizers, ({ one, many }) => ({
  farm: one(farms, {
    fields: [fertilizers.farmId],
    references: [farms.id],
  }),
  fertilizerSpreaders: many(fertilizerSpreaders),
  fertilizerApplications: many(fertilizerApplications),
}));

export const fertilizerApplications = pgTable(
  "fertilizer_applications",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp().notNull().defaultNow(),
    createdBy: uuid()
      .notNull()
      .references(() => profiles.id),
    plotId: uuid()
      .notNull()
      .references(() => plots.id, { onDelete: "cascade" }),
    date: date({ mode: "date" }).notNull(),
    unit: fertilizerUnit().notNull(),
    method: fertilizationMethod().notNull(),
    amountPerApplication: integer().notNull(),
    numberOfApplications: real().notNull(),
    fertilizerId: uuid()
      .references(() => fertilizers.id)
      .notNull(),
    spreaderId: uuid().references(() => fertilizerSpreaders.id, {
      onDelete: "set null",
    }),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ]
).enableRLS();

export const fertilizerApplicationsRelations = relations(
  fertilizerApplications,
  ({ one, many }) => ({
    fertilizer: one(fertilizers, {
      fields: [fertilizerApplications.fertilizerId],
      references: [fertilizers.id],
    }),
    farm: one(farms, {
      fields: [fertilizerApplications.farmId],
      references: [farms.id],
    }),
    spreader: one(fertilizerSpreaders, {
      fields: [fertilizerApplications.spreaderId],
      references: [fertilizerSpreaders.id],
    }),
    plot: one(plots, {
      fields: [fertilizerApplications.plotId],
      references: [plots.id],
    }),
  })
);

export const idSchema = z.object({ id: z.string() });
export const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(z.array(z.number())))),
});

export const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const selectFarmSchema = createSelectSchema(farms).merge(
  z.object({
    location: pointSchema,
  })
);
export const insertFarmSchema = selectFarmSchema.omit({ id: true });
export const updateFarmSchema = insertFarmSchema.partial().merge(idSchema);

export const selectUserSchema = createSelectSchema(profiles);
export const insertUserSchema = createInsertSchema(profiles);
export const updateUserSchema = insertUserSchema.partial().merge(idSchema);

export const selectCropSchema = createSelectSchema(crops);
export const insertCropSchema = createInsertSchema(crops);
export const updateCropSchema = insertCropSchema.partial().merge(idSchema);

export const cropProtectionUnitSchema = z.enum(cropProtectionUnit.enumValues);

export const selectCropProtectionProductSchema = createSelectSchema(
  cropProtectionProducts
);
export const insertCropProtectionProductSchema = createInsertSchema(
  cropProtectionProducts
);
export const updateCropProtectionProductSchema =
  insertCropProtectionProductSchema.partial().merge(idSchema);

export const selectCropProtectionApplicationSchema = createSelectSchema(
  cropProtectionApplications
);
export const insertCropProtectionApplicationSchema = createInsertSchema(
  cropProtectionApplications
);
export const updateCropProtectionApplicationSchema =
  insertCropProtectionApplicationSchema.partial().merge(idSchema);

export const selectCropProtectionEquipmentSchema = createSelectSchema(
  cropProtectionEquipment
);
export const insertCropProtectionEquipmentSchema = createInsertSchema(
  cropProtectionEquipment
);
export const updateCropProtectionEquipmentSchema =
  insertCropProtectionEquipmentSchema.partial().merge(idSchema);

export const selectTillageSchema = createSelectSchema(tillages);
export const insertTillageSchema = createInsertSchema(tillages);
export const updateTillageSchema = insertTillageSchema
  .partial()
  .merge(idSchema);

export const selectTillageEquipmentSchema =
  createSelectSchema(tillageEquipment);
export const insertTillageEquipmentSchema =
  createInsertSchema(tillageEquipment);
export const updateTillageEquipmentSchema = insertTillageEquipmentSchema
  .partial()
  .merge(idSchema);

export const selectHarvestingMachinerySchema =
  createSelectSchema(harvestingMachinery);
export const insertHarvestingMachinerySchema =
  createInsertSchema(harvestingMachinery);
export const updateHarvestingMachinerySchema = insertHarvestingMachinerySchema
  .partial()
  .merge(idSchema);

export const selectHarvestSchema = createSelectSchema(harvests)
  .omit({ geometry: true })
  .merge(
    z.object({
      geometry: multiPolygonSchema,
    })
  );
export const insertHarvestSchema = createInsertSchema(harvests).merge(
  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
);
export const updateHarvestSchema = insertHarvestSchema
  .partial()
  .merge(idSchema);

export const processingTypeEnumSchema = z.enum(processingType.enumValues);
export const conservationMethodEnumSchema = z.enum(
  conservationMethod.enumValues
);

export const fertilizerUnitSchema = z.enum(fertilizerUnit.enumValues);
export const fertilizationMethodSchema = z.enum(fertilizationMethod.enumValues);

export const selectFertilizerApplicationSchema = createSelectSchema(
  fertilizerApplications
);
export const insertFertilizerApplicationSchema = createInsertSchema(
  fertilizerApplications
).merge(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }));
export const updateFertilizerApplicationSchema =
  insertFertilizerApplicationSchema.partial().merge(idSchema);

export const selectFertilizerSpreaderSchema =
  createSelectSchema(fertilizerSpreaders);
export const insertFertilizerSpreaderSchema =
  createInsertSchema(fertilizerSpreaders);
export const updateFertilizerSpreaderSchema = insertFertilizerSpreaderSchema
  .partial()
  .merge(idSchema);

export const selectFertilizerSchema = createSelectSchema(fertilizers);
export const insertFertilizerSchema = createInsertSchema(fertilizers);
export const updateFertilizerSchema = insertFertilizerSchema
  .partial()
  .merge(idSchema);

export const selectParcelSchema = createSelectSchema(parcels)
  .omit({ geometry: true })
  .merge(
    z.object({
      geometry: multiPolygonSchema,
    })
  );
export const insertParcelSchema = createInsertSchema(parcels);
export const updateParcelSchema = insertParcelSchema.partial().merge(idSchema);

export const selectCropRotationSchema = createSelectSchema(cropRotations).merge(
  z.object({
    sowingDate: ez.dateOut().nullable(),
    fromDate: ez.dateOut(),
    toDate: ez.dateOut().nullable(),
    crop: selectCropSchema,
  })
);
export const insertCropRotationSchema = createInsertSchema(cropRotations).merge(
  z.object({
    sowingDate: ez.dateIn().optional(),
    fromDate: ez.dateIn(),
    toDate: ez.dateIn().optional(),
  })
);
export const updateCropRotationSchema = insertCropRotationSchema
  .partial()
  .merge(idSchema);

export const selectPlotSchema = createSelectSchema(plots)
  .omit({ geometry: true, cuttingDate: true })
  .merge(
    z.object({
      geometry: multiPolygonSchema,
      cuttingDate: ez.dateOut().nullable(),
      cropRotations: z.array(selectCropRotationSchema),
    })
  );
export const insertPlotSchema = createInsertSchema(plots)
  .omit({ geometry: true, cuttingDate: true })
  .merge(
    z.object({
      geometry: multiPolygonSchema,
      cuttingDate: ez.dateIn().optional(),
      cropId: z.string(),
    })
  );
export const updatePlotSchema = insertPlotSchema.partial().merge(idSchema);

export const selectFederalFarmPlotSchema = createSelectSchema(federalFarmPlots)
  .omit({ geometry: true, cuttingDate: true })
  .merge(
    z.object({
      geometry: multiPolygonSchema,
      cuttingDate: ez.dateOut().nullable(),
    })
  );
