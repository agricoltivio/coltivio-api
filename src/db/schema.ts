import { and, defineRelations, eq, isNotNull, or, sql } from "drizzle-orm";
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
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

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

export const federalFarmPlots = pgTable.withRLS(
  "federal_farm_plots",
  {
    id: integer().primaryKey(),
    federalFarmId: text("farm_id").notNull(),
    localId: text("local_id"),
    usage: integer().notNull(),
    size: integer().notNull(),
    cuttingDate: date("cut_date", { mode: "date" }),
    canton: text().notNull(),
    geometry: polygon().notNull(),
  },

  (table) => [
    index("federal_farm_plots_geometries_idx").using("gist", table.geometry),
    index("federal_farm_id_idx").using(
      "gin",
      table.federalFarmId.op("gin_trgm_ops"),
    ),
    pgPolicy("authenticated users can read", {
      as: "permissive",
      to: authenticatedRole,
      for: "select",
      using: sql`true`,
    }),
  ],
);

export const profiles = pgTable.withRLS(
  "profiles",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull().unique(),
    fullName: text(),
    emailVerified: boolean().notNull().default(false),
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
          eq(authUid, table.id),
        ),
      },
    ),
  ],
);

export const farms = pgTable.withRLS(
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
  ],
);

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "USER",
  "CONTRACTOR",
]);

export const parcels = pgTable.withRLS(
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
  ],
);
export const cropRotations = pgTable.withRLS(
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
    toDate: date({ mode: "date" }).notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const frequency = pgEnum("frequency", ["weekly", "monthly", "yearly"]);

export const weekday = pgEnum("weekday", [
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
]);

export const cropRotationYearlyRecurrences = pgTable.withRLS(
  "crop_rotation_yearly_recurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    cropRotationId: uuid("crop_rotation_id")
      .references(() => cropRotations.id, { onDelete: "cascade" })
      .notNull(),

    interval: integer("interval").default(1).notNull(),
    until: date({ mode: "date" }),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
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
  "custom",
]);

export const tillagePresets = pgTable.withRLS(
  "tillage_presets",
  {
    id: uuid().defaultRandom().primaryKey(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    reason: tillageReason(),
    action: tillageAction().notNull(),
    customAction: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const tillages = pgTable.withRLS(
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
    reason: tillageReason(),
    action: tillageAction().notNull(),
    customAction: text(),
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
  ],
);

export const cropProtectionUnit = pgEnum("crop_protection_unit", [
  "ml",
  "l",
  "g",
  "kg",
]);

export const cropProtectionProducts = pgTable.withRLS(
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
  ],
);

export const cropProtectionApplicationMethod = pgEnum(
  "crop_protection_application_method",
  ["spraying", "misting", "broadcasting", "injecting", "other"],
);

export const cropProtectionApplicationUnit = pgEnum(
  "crop_protection_application_unit",
  ["load", "bag", "total_amount", "amount_per_hectare", "other"],
);

export const cropProtectionApplicationPresets = pgTable.withRLS(
  "crop_protection_application_presets",
  {
    id: uuid().defaultRandom().primaryKey(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    method: cropProtectionApplicationMethod(),
    unit: cropProtectionApplicationUnit().notNull(),
    customUnit: text(),
    amountPerUnit: real().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const cropProtectionApplications = pgTable.withRLS(
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
    productId: uuid()
      .notNull()
      .references(() => cropProtectionProducts.id),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    method: cropProtectionApplicationMethod(),
    unit: cropProtectionApplicationUnit().notNull(),
    amountPerUnit: real().notNull(),
    numberOfUnits: real().notNull(),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const plots = pgTable.withRLS(
  "plots",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    localId: text(), // parcel number
    usage: integer(),
    cuttingDate: date({ mode: "date" }),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    additionalNotes: text(),
  },

  (table) => [
    index("plot_geometries_idx").using("gist", table.geometry),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const conservationMethod = pgEnum("conservation_method", [
  "dried",
  "silage",
  "haylage",
  "other",
  "none",
]);

export const cropCategory = pgEnum("crop_category", [
  "grass",
  "grain",
  "vegetable",
  "fruit",
  "other",
]);

export const cropFamilies = pgTable.withRLS(
  "crop_families",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    waitingTimeInYears: integer().notNull().default(0),
    additionalNotes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const crops = pgTable.withRLS(
  "crops",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    category: cropCategory().notNull(),
    familyId: uuid().references(() => cropFamilies.id, {
      onDelete: "set null",
    }),
    variety: text(),
    waitingTimeInYears: integer(),
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
  ],
);

export const harvestUnits = pgEnum("harvest_unit", [
  "load",
  "square_bale",
  "round_bale",
  "crate",
  "total_amount",
  "other",
]);

export const harvestPresets = pgTable.withRLS(
  "harvest_presets",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    unit: harvestUnits().notNull(),
    kilosPerUnit: real().notNull(),
    conservationMethod: conservationMethod(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const harvests = pgTable.withRLS(
  "harvests",
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
    conservationMethod: conservationMethod(),
    unit: harvestUnits().notNull(),
    kilosPerUnit: real().notNull(),
    numberOfUnits: real().notNull(),
    harvestCount: integer(),
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
  ],
);

export const fertilizerUnit = pgEnum("fertilizer_unit", ["l", "kg", "dt", "t"]);

export const animalSex = pgEnum("animal_sex", ["male", "female"]);

export const animalType = pgEnum("animal_type", [
  "goat",
  "sheep",
  "cow",
  "horse",
  "donkey",
  "pig",
  "deer",
]);

export const deathReason = pgEnum("death_reason", ["died", "slaughtered"]);

export const productCategory = pgEnum("product_category", [
  "meat",
  "vegetables",
  "dairy",
  "eggs",
  "other",
]);

export const productUnit = pgEnum("product_unit", [
  "kg",
  "g",
  "piece",
  "bunch",
  "liter",
]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "fulfilled",
  "cancelled",
]);

export const preferredCommunication = pgEnum("preferred_communication", [
  "email",
  "phone",
  "whatsapp",
]);

export const contacts = pgTable.withRLS(
  "contacts",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    firstName: text().notNull(),
    lastName: text().notNull(),
    street: text(),
    city: text(),
    zip: text(),
    phone: text(),
    email: text(),
    preferredCommunication: preferredCommunication(),
    labels: text().array().notNull().default([]),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const products = pgTable.withRLS(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    category: productCategory().notNull(),
    unit: productUnit().notNull(),
    pricePerUnit: real().notNull(),
    description: text(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const orders = pgTable.withRLS(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, {
        onDelete: "cascade",
      }),
    status: orderStatus().notNull().default("pending"),
    orderDate: date({ mode: "date" }).notNull(),
    shippingDate: date({ mode: "date" }),
    notes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const orderItems = pgTable.withRLS(
  "order_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, {
        onDelete: "cascade",
      }),
    productId: uuid()
      .notNull()
      .references(() => products.id, {
        onDelete: "restrict",
      }),
    quantity: real().notNull(),
    unitPrice: real().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "twint",
  "card",
  "other",
]);

export const sponsorshipPrograms = pgTable.withRLS(
  "sponsorship_programs",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    description: text(),
    yearlyCost: real().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const sponsorships = pgTable.withRLS(
  "sponsorships",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, {
        onDelete: "cascade",
      }),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, {
        onDelete: "cascade",
      }),
    sponsorshipProgramId: uuid()
      .notNull()
      .references(() => sponsorshipPrograms.id, {
        onDelete: "restrict",
      }),
    startDate: date({ mode: "date" }).notNull(),
    endDate: date({ mode: "date" }),
    notes: text(),
    preferredCommunication: preferredCommunication(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const payments = pgTable.withRLS(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, {
        onDelete: "cascade",
      }),
    sponsorshipId: uuid().references(() => sponsorships.id, {
      onDelete: "set null",
    }),
    orderId: uuid().references(() => orders.id, {
      onDelete: "set null",
    }),
    date: date({ mode: "date" }).notNull(),
    amount: real().notNull(),
    currency: text().notNull().default("CHF"),
    method: paymentMethod().notNull(),
    notes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const fertilizerType = pgEnum("fertilizer_type", ["mineral", "organic"]);
export const fertilizationMethod = pgEnum("fertilization_method", [
  "spray",
  "spread",
  "other",
]);

export const fertilizers = pgTable.withRLS(
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
  ],
);

export const fertilizerApplicationUnit = pgEnum("fertilizer_application_unit", [
  "load",
  "bag",
  "total_amount",
  "amount_per_hectare",
  "other",
]);

export const fertilizerApplicationPresets = pgTable.withRLS(
  "fertilizer_application_presets",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    fertilizerId: uuid()
      .notNull()
      .references(() => fertilizers.id, {
        onDelete: "cascade",
      }),
    unit: fertilizerApplicationUnit().notNull(),
    method: fertilizationMethod(),
    amountPerUnit: real().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const fertilizerApplications = pgTable.withRLS(
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
    method: fertilizationMethod(),
    unit: fertilizerApplicationUnit().notNull(),
    amountPerUnit: real().notNull(),
    numberOfUnits: real().notNull(),
    fertilizerId: uuid()
      .references(() => fertilizers.id)
      .notNull(),
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
  ],
);

export const earTags = pgTable.withRLS(
  "ear_tags",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    number: text().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const animalCategory = pgEnum("animal_category", [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "A9",
  "B1",
  "B2",
  "B3",
  "C1",
  "C2",
  "D1",
  "D2",
  "D3",
  "E1",
  "E2",
  "E3",
  "E4",
  "F1",
  "F2",
]);

export const animalUsage = pgEnum("animal_usage", ["milk", "other"]);

export const animals = pgTable.withRLS(
  "animals",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    type: animalType().notNull(),
    usage: animalUsage().notNull(),
    requiresCategoryOverride: boolean().notNull().default(false),
    categoryOverride: animalCategory(),
    sex: animalSex().notNull(),
    dateOfBirth: date({ mode: "date" }).notNull(),
    registered: boolean().notNull().default(false),
    earTagId: uuid().references(() => earTags.id, { onDelete: "restrict" }),
    motherId: uuid(),
    fatherId: uuid(),
    dateOfDeath: date({ mode: "date" }),
    deathReason: deathReason(),
    herdId: uuid().references(() => herds.id, { onDelete: "set null" }),
  },
  (table) => [
    foreignKey({
      columns: [table.motherId],
      foreignColumns: [table.id],
      name: "animals_mother_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.fatherId],
      foreignColumns: [table.id],
      name: "animals_father_fk",
    }).onDelete("set null"),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const herds = pgTable.withRLS(
  "herds",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const herdMemberships = pgTable.withRLS(
  "herd_memberships",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    herdId: uuid()
      .notNull()
      .references(() => herds.id, { onDelete: "cascade" }),
    fromDate: date({ mode: "date" }).notNull(),
    toDate: date({ mode: "date" }), // null = still active
  },
  (table) => [
    index("herd_memberships_animal_id_idx").on(table.animalId),
    index("herd_memberships_herd_id_idx").on(table.herdId),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const outdoorScheduleType = pgEnum("outdoor_schedule_type", [
  "pasture",
  "exercise_yard",
]);

export const outdoorSchedules = pgTable.withRLS(
  "outdoor_shedules",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    herdId: uuid()
      .notNull()
      .references(() => herds.id, { onDelete: "cascade" }),
    startDate: date({ mode: "date" }).notNull(),
    endDate: date({ mode: "date" }),
    type: outdoorScheduleType().notNull(),
    notes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const outdoorScheduleRecurrences = pgTable.withRLS(
  "outdoor_schedule_recurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    outdoorScheduleId: uuid("outdoor_schedule_id")
      .references(() => outdoorSchedules.id, { onDelete: "cascade" })
      .notNull(),

    frequency: frequency("frequency").notNull(),
    interval: integer("interval").default(1).notNull(),

    byWeekday: weekday("by_weekday").array(),
    byMonthDay: integer("by_month_day"),

    until: date("until"),
    count: integer("count"),
  },

  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const drugs = pgTable.withRLS(
  "drugs",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    name: text().notNull(),
    criticalAntibiotic: boolean().notNull(),
    receivedFrom: text().notNull(),
    notes: text(),
  },
  (table) => [
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);
export const drugDoseUnit = pgEnum("drug_dose_unit", [
  "tablet",
  "capsule",
  "patch",
  "dose",
  "mg",
  "mcg",
  "g",
  "ml",
  "drop",
]);

export const drugDosePerUnit = pgEnum("dose_per_unit", [
  "kg",
  "animal",
  "day",
  "total_amount",
]);

export const drugTreatment = pgTable.withRLS(
  "drug_treatment",
  {
    id: uuid().primaryKey().defaultRandom(),
    drugId: uuid()
      .notNull()
      .references(() => drugs.id, { onDelete: "cascade" }),
    animalType: animalType().notNull(),
    doseUnit: drugDoseUnit().notNull(),
    doseValue: real().notNull(),
    dosePerUnit: drugDosePerUnit().notNull(),
    milkWaitingDays: integer().notNull(),
    meatWaitingDays: integer().notNull(),
    organsWaitingDays: integer().notNull(),
  },
  (table) => [
    index("drug_treatment_drug_id_idx").on(table.drugId),
    unique("drug_treatment_drug_animal_unique").on(
      table.drugId,
      table.animalType,
    ),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM ${drugs}
        WHERE ${drugs.id} = ${table.drugId}
        AND ${drugs.farmId} = current_setting('request.farm_id')::uuid
      )`,
    }),
  ],
);

export const treatments = pgTable.withRLS(
  "treatments",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, {
        onDelete: "cascade",
      }),
    drugId: uuid().references(() => drugs.id, { onDelete: "restrict" }),
    startDate: date({ mode: "date" }).notNull(),
    endDate: date({ mode: "date" }).notNull(),
    name: text().notNull(),
    notes: text(),
    drugDoseUnit: drugDoseUnit(),
    drugDoseValue: real(),
    drugDosePerUnit: drugDosePerUnit(),
    drugReceivedFrom: text(),
    criticalAntibiotic: boolean().notNull(),
    antibiogramAvailable: boolean().notNull(),
    milkUsableDate: date("milk_usable_date", { mode: "date" }),
    meatUsableDate: date("meat_usable_date", { mode: "date" }),
    organsUsableDate: date("organs_usable_date", { mode: "date" }),
    createdAt: timestamp().notNull().defaultNow(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
  },
  (table) => [
    index("treatments_drug_id_idx").on(table.drugId),
    index("treatments_date_idx").on(table.startDate),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

export const animalTreatments = pgTable.withRLS(
  "animal_treatments",
  {
    id: uuid().primaryKey().defaultRandom(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    treatmentId: uuid()
      .notNull()
      .references(() => treatments.id, { onDelete: "cascade" }),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("animal_treatments_animal_id_idx").on(table.animalId),
    index("animal_treatments_treatment_id_idx").on(table.treatmentId),
    unique("animal_treatments_unique").on(table.animalId, table.treatmentId),
    pgPolicy("only farm members", {
      as: "permissive",
      to: authenticatedRole,
      using: eq(table.farmId, currentFarmId),
      withCheck: eq(table.farmId, currentFarmId),
    }),
  ],
);

// Schema object for defineRelations (contains all tables)
const tables = {
  federalFarmPlots,
  profiles,
  farms,
  parcels,
  cropRotations,
  cropRotationRecurrences: cropRotationYearlyRecurrences,
  tillagePresets,
  tillages,
  cropProtectionProducts,
  cropProtectionApplicationPresets,
  cropProtectionApplications,
  plots,
  cropFamilies,
  crops,
  harvestPresets,
  harvests,
  fertilizers,
  fertilizerApplicationPresets,
  fertilizerApplications,
  contacts,
  products,
  orders,
  orderItems,
  sponsorshipPrograms,
  sponsorships,
  payments,
  earTags,
  animals,
  drugs,
  drugTreatment,
  treatments,
  animalTreatments,
  herds,
  herdMemberships,
  outdoorSchedules,
  outdoorScheduleRecurrences,
};

// Define all relations using the new Drizzle v1 API
export const relations = defineRelations(tables, (r) => ({
  profiles: {
    farm: r.one.farms({
      from: r.profiles.farmId,
      to: r.farms.id,
    }), // optional - farmId can be null
  },
  farms: {
    users: r.many.profiles(),
    parcels: r.many.parcels(),
    plots: r.many.plots(),
    harvests: r.many.harvests(),
    fertilizerApplications: r.many.fertilizerApplications(),
  },
  parcels: {
    farm: r.one.farms({
      from: r.parcels.farmId,
      to: r.farms.id,
      optional: false,
    }),
  },
  crops: {
    family: r.one.cropFamilies({
      from: r.crops.familyId,
      to: r.cropFamilies.id,
    }),
  },
  cropRotations: {
    farm: r.one.farms({
      from: r.cropRotations.farmId,
      to: r.farms.id,
      optional: false,
    }),
    plot: r.one.plots({
      from: r.cropRotations.plotId,
      to: r.plots.id,
      optional: false,
    }),
    crop: r.one.crops({
      from: r.cropRotations.cropId,
      to: r.crops.id,
      optional: false,
    }),
    recurrence: r.one.cropRotationRecurrences({
      from: r.cropRotations.id,
      to: r.cropRotationRecurrences.cropRotationId,
    }),
  },
  cropRotationRecurrences: {
    cropRotation: r.one.cropRotations({
      from: r.cropRotationRecurrences.cropRotationId,
      to: r.cropRotations.id,
      optional: false,
    }),
  },
  tillagePresets: {
    farm: r.one.farms({
      from: r.tillagePresets.farmId,
      to: r.farms.id,
      optional: false,
    }),
  },
  tillages: {
    plot: r.one.plots({
      from: r.tillages.plotId,
      to: r.plots.id,
      optional: false,
    }),
  },
  cropProtectionApplicationPresets: {
    farm: r.one.farms({
      from: r.cropProtectionApplicationPresets.farmId,
      to: r.farms.id,
      optional: false,
    }),
  },
  cropProtectionApplications: {
    plot: r.one.plots({
      from: r.cropProtectionApplications.plotId,
      to: r.plots.id,
      optional: false,
    }),
    product: r.one.cropProtectionProducts({
      from: r.cropProtectionApplications.productId,
      to: r.cropProtectionProducts.id,
      optional: false,
    }),
  },
  plots: {
    farm: r.one.farms({
      from: r.plots.farmId,
      to: r.farms.id,
      optional: false,
    }),
    cropRotations: r.many.cropRotations(),
    harvests: r.many.harvests(),
    tillages: r.many.tillages(),
    cropProtectionApplications: r.many.cropProtectionApplications(),
    fertilizerApplications: r.many.fertilizerApplications(),
  },
  harvestPresets: {
    farm: r.one.farms({
      from: r.harvestPresets.farmId,
      to: r.farms.id,
      optional: false,
    }),
  },
  harvests: {
    farm: r.one.farms({
      from: r.harvests.farmId,
      to: r.farms.id,
      optional: false,
    }),
    plot: r.one.plots({
      from: r.harvests.plotId,
      to: r.plots.id,
      optional: false,
    }),
    crop: r.one.crops({
      from: r.harvests.cropId,
      to: r.crops.id,
      optional: false,
    }),
  },
  fertilizers: {
    farm: r.one.farms({
      from: r.fertilizers.farmId,
      to: r.farms.id,
      optional: false,
    }),
    fertilizerApplications: r.many.fertilizerApplications(),
    fertilizerApplicationPresets: r.many.fertilizerApplicationPresets(),
  },
  fertilizerApplicationPresets: {
    farm: r.one.farms({
      from: r.fertilizerApplicationPresets.farmId,
      to: r.farms.id,
      optional: false,
    }),
    fertilizer: r.one.fertilizers({
      from: r.fertilizerApplicationPresets.fertilizerId,
      to: r.fertilizers.id,
      optional: false,
    }),
  },
  fertilizerApplications: {
    fertilizer: r.one.fertilizers({
      from: r.fertilizerApplications.fertilizerId,
      to: r.fertilizers.id,
      optional: false,
    }),
    farm: r.one.farms({
      from: r.fertilizerApplications.farmId,
      to: r.farms.id,
      optional: false,
    }),
    plot: r.one.plots({
      from: r.fertilizerApplications.plotId,
      to: r.plots.id,
      optional: false,
    }),
  },
  contacts: {
    farm: r.one.farms({
      from: r.contacts.farmId,
      to: r.farms.id,
      optional: false,
    }),
    payments: r.many.payments(),
    sponsorships: r.many.sponsorships(),
    orders: r.many.orders(),
  },
  products: {
    farm: r.one.farms({
      from: r.products.farmId,
      to: r.farms.id,
      optional: false,
    }),
    orderItems: r.many.orderItems(),
  },
  orders: {
    farm: r.one.farms({
      from: r.orders.farmId,
      to: r.farms.id,
      optional: false,
    }),
    contact: r.one.contacts({
      from: r.orders.contactId,
      to: r.contacts.id,
      optional: false,
    }),
    items: r.many.orderItems(),
    payments: r.many.payments(),
  },
  orderItems: {
    farm: r.one.farms({
      from: r.orderItems.farmId,
      to: r.farms.id,
      optional: false,
    }),
    order: r.one.orders({
      from: r.orderItems.orderId,
      to: r.orders.id,
      optional: false,
    }),
    product: r.one.products({
      from: r.orderItems.productId,
      to: r.products.id,
      optional: false,
    }),
  },
  sponsorshipPrograms: {
    farm: r.one.farms({
      from: r.sponsorshipPrograms.farmId,
      to: r.farms.id,
      optional: false,
    }),
    sponsorships: r.many.sponsorships(),
  },
  sponsorships: {
    farm: r.one.farms({
      from: r.sponsorships.farmId,
      to: r.farms.id,
      optional: false,
    }),
    contact: r.one.contacts({
      from: r.sponsorships.contactId,
      to: r.contacts.id,
      optional: false,
    }),
    animal: r.one.animals({
      from: r.sponsorships.animalId,
      to: r.animals.id,
      optional: false,
    }),
    sponsorshipProgram: r.one.sponsorshipPrograms({
      from: r.sponsorships.sponsorshipProgramId,
      to: r.sponsorshipPrograms.id,
      optional: false,
    }),
    payments: r.many.payments(),
  },
  payments: {
    farm: r.one.farms({
      from: r.payments.farmId,
      to: r.farms.id,
      optional: false,
    }),
    contact: r.one.contacts({
      from: r.payments.contactId,
      to: r.contacts.id,
      optional: false,
    }),
    sponsorship: r.one.sponsorships({
      from: r.payments.sponsorshipId,
      to: r.sponsorships.id,
    }), // optional - sponsorshipId can be null
    order: r.one.orders({
      from: r.payments.orderId,
      to: r.orders.id,
    }), // optional - orderId can be null
  },
  earTags: {
    farm: r.one.farms({
      from: r.earTags.farmId,
      to: r.farms.id,
      optional: false,
    }),
    animal: r.one.animals({
      from: r.earTags.id,
      to: r.animals.earTagId,
    }), // optional - may not be assigned to any animal
  },
  animals: {
    farm: r.one.farms({
      from: r.animals.farmId,
      to: r.farms.id,
      optional: false,
    }),
    earTag: r.one.earTags({
      from: r.animals.earTagId,
      to: r.earTags.id,
    }), // optional - earTagId can be null
    mother: r.one.animals({
      from: r.animals.motherId,
      to: r.animals.id,
      alias: "mother",
    }), // optional - motherId can be null
    father: r.one.animals({
      from: r.animals.fatherId,
      to: r.animals.id,
      alias: "father",
    }), // optional - fatherId can be null
    childrenAsMother: r.many.animals({
      from: r.animals.id,
      to: r.animals.motherId,
      alias: "childrenAsMother",
    }),
    childrenAsFather: r.many.animals({
      from: r.animals.id,
      to: r.animals.fatherId,
      alias: "childrenAsFather",
    }),
    sponsorships: r.many.sponsorships(),
    animalTreatments: r.many.animalTreatments(),
    herd: r.one.herds({
      from: r.animals.herdId,
      to: r.herds.id,
    }),
    herdMemberships: r.many.herdMemberships(),
  },
  herds: {
    farm: r.one.farms({
      from: r.herds.farmId,
      to: r.farms.id,
      optional: false,
    }),
    animals: r.many.animals(),
    herdMemberships: r.many.herdMemberships(),
    outdoorSchedules: r.many.outdoorSchedules(),
  },
  herdMemberships: {
    farm: r.one.farms({
      from: r.herdMemberships.farmId,
      to: r.farms.id,
      optional: false,
    }),
    animal: r.one.animals({
      from: r.herdMemberships.animalId,
      to: r.animals.id,
      optional: false,
    }),
    herd: r.one.herds({
      from: r.herdMemberships.herdId,
      to: r.herds.id,
      optional: false,
    }),
  },
  outdoorSchedules: {
    farm: r.one.farms({
      from: r.outdoorSchedules.farmId,
      to: r.farms.id,
      optional: false,
    }),
    herd: r.one.herds({
      from: r.outdoorSchedules.herdId,
      to: r.herds.id,
      optional: false,
    }),
    recurrence: r.one.outdoorScheduleRecurrences(),
  },
  outdoorScheduleRecurrences: {
    outdoorSchedule: r.one.outdoorSchedules({
      from: r.outdoorScheduleRecurrences.outdoorScheduleId,
      to: r.outdoorSchedules.id,
      optional: false,
    }),
  },
  drugs: {
    farm: r.one.farms({
      from: r.drugs.farmId,
      to: r.farms.id,
      optional: false,
    }),
    drugTreatment: r.many.drugTreatment(),
  },
  drugTreatment: {
    drug: r.one.drugs({
      from: r.drugTreatment.drugId,
      to: r.drugs.id,
      optional: false,
    }),
  },
  treatments: {
    farm: r.one.farms({
      from: r.treatments.farmId,
      to: r.farms.id,
      optional: false,
    }),
    drug: r.one.drugs({
      from: r.treatments.drugId,
      to: r.drugs.id,
    }),
    createdByProfile: r.one.profiles({
      from: r.treatments.createdBy,
      to: r.profiles.id,
    }), // optional - createdBy can be null
    animalTreatments: r.many.animalTreatments(),
  },
  animalTreatments: {
    animal: r.one.animals({
      from: r.animalTreatments.animalId,
      to: r.animals.id,
      optional: false,
    }),
    treatment: r.one.treatments({
      from: r.animalTreatments.treatmentId,
      to: r.treatments.id,
      optional: false,
    }),
  },
}));

export const idSchema = z.object({ id: z.string() });
export const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(z.array(z.number())))),
});

export const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const cropCategorySchema = z.enum(cropCategory.enumValues);
export const cropProtectionApplicationUnitSchema = z.enum(
  cropProtectionApplicationUnit.enumValues,
);
export const cropProtectionApplicationMethodSchema = z.enum(
  cropProtectionApplicationMethod.enumValues,
);
export const tillageActionSchema = z.enum(tillageAction.enumValues);
export const tillageReasonSchema = z.enum(tillageReason.enumValues);

export const cropProtectionUnitSchema = z.enum(cropProtectionUnit.enumValues);

export const harvestUnitsSchema = z.enum(harvestUnits.enumValues);
export const conservationMethodEnumSchema = z.enum(
  conservationMethod.enumValues,
);

export const fertilizerApplicationUnitSchema = z.enum(
  fertilizerApplicationUnit.enumValues,
);
export const fertilizerUnitSchema = z.enum(fertilizerUnit.enumValues);
export const fertilizerTypeSchema = z.enum(fertilizerType.enumValues);
export const fertilizationMethodSchema = z.enum(fertilizationMethod.enumValues);

export const animalTypeSchema = z.enum(animalType.enumValues);
export const animalUsageSchema = z.enum(animalUsage.enumValues);
export const animalCateogrySchema = z.enum(animalCategory.enumValues);
export const animalSexSchema = z.enum(animalSex.enumValues);
export const deathReasonSchema = z.enum(deathReason.enumValues);
export const drugDoseUnitSchema = z.enum(drugDoseUnit.enumValues);
export const drugDosePerUnitSchema = z.enum(drugDosePerUnit.enumValues);
export const outdoorScheduleTypeSchema = z.enum(outdoorScheduleType.enumValues);

export const preferredCommunicationSchema = z.enum(
  preferredCommunication.enumValues,
);

export const frequencySchema = z.enum(frequency.enumValues);
export const weekdaySchema = z.enum(weekday.enumValues);

export const paymentMethodSchema = z.enum(paymentMethod.enumValues);

export const productCategorySchema = z.enum(productCategory.enumValues);
export const productUnitSchema = z.enum(productUnit.enumValues);
export const orderStatusSchema = z.enum(orderStatus.enumValues);
