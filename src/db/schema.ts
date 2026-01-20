import { and, eq, isNotNull, or, defineRelations, sql } from "drizzle-orm";
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
import { createSelectSchema } from "drizzle-zod";

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
    toDate: date({ mode: "date" }),
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
  "other",
]);

export const tillageEquipment = pgTable.withRLS(
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
    reason: tillageReason().notNull(),
    action: tillageAction().notNull(),
    equipmentId: uuid().references(() => tillageEquipment.id, {
      onDelete: "set null",
    }),
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
    defaultEquipmentId: uuid().references(() => cropProtectionEquipment.id, {
      onDelete: "set null",
    }),
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

export const cropProtectionApplicationMehtod = pgEnum(
  "crop_protection_application_method",
  ["spraying", "misting", "broadcasting", "injecting", "other"],
);

export const cropProtectionEquipment = pgTable.withRLS(
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
    capacity: real().notNull(),
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
    equipmentId: uuid().references(() => cropProtectionEquipment.id, {
      onDelete: "set null",
    }),
    productId: uuid()
      .notNull()
      .references(() => cropProtectionProducts.id),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    method: cropProtectionApplicationMehtod().notNull(),
    amountPerApplication: real().notNull(),
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
    additionalUsages: text(),
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
  ],
);

export const harvestingMachinery = pgTable.withRLS(
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
  ],
);

export const harvests = pgTable.withRLS(
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
  ],
);

export const fertilizerUnit = pgEnum("fertilizer_unit", ["l", "kg", "dt", "t"]);

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
    stock: real().notNull(),
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

export const sponsorshipTypes = pgTable.withRLS(
  "sponsorship_types",
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
    sponsorshipTypeId: uuid()
      .notNull()
      .references(() => sponsorshipTypes.id, {
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

export const fertilizerSpreaders = pgTable.withRLS(
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
  ],
);

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
    defaultSpreaderId: uuid().references(() => fertilizerSpreaders.id, {
      onDelete: "set null",
    }),
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
    unit: fertilizerUnit().notNull(),
    method: fertilizationMethod().notNull(),
    amountPerApplication: real().notNull(),
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
    dateOfBirth: date({ mode: "date" }).notNull(),
    earTagId: uuid().references(() => earTags.id, { onDelete: "restrict" }),
    motherId: uuid(),
    fatherId: uuid(),
    dateOfDeath: date({ mode: "date" }),
    deathReason: deathReason(),
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

// Schema object for defineRelations (contains all tables)
const tables = {
  federalFarmPlots,
  profiles,
  farms,
  parcels,
  cropRotations,
  tillageEquipment,
  tillages,
  cropProtectionProducts,
  cropProtectionEquipment,
  cropProtectionApplications,
  plots,
  crops,
  harvestingMachinery,
  harvests,
  fertilizerSpreaders,
  fertilizers,
  fertilizerApplications,
  contacts,
  products,
  orders,
  orderItems,
  sponsorshipTypes,
  sponsorships,
  payments,
  earTags,
  animals,
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
    harvestingMachinery: r.many.harvestingMachinery(),
  },
  parcels: {
    farm: r.one.farms({
      from: r.parcels.farmId,
      to: r.farms.id,
      optional: false,
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
  },
  tillages: {
    equipment: r.one.tillageEquipment({
      from: r.tillages.equipmentId,
      to: r.tillageEquipment.id,
    }), // optional - equipmentId can be null
    plot: r.one.plots({
      from: r.tillages.plotId,
      to: r.plots.id,
      optional: false,
    }),
  },
  cropProtectionApplications: {
    equipment: r.one.cropProtectionEquipment({
      from: r.cropProtectionApplications.equipmentId,
      to: r.cropProtectionEquipment.id,
    }), // optional - equipmentId can be null
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
  harvestingMachinery: {
    farm: r.one.farms({
      from: r.harvestingMachinery.farmId,
      to: r.farms.id,
      optional: false,
    }),
    harvests: r.many.harvests(),
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
    machinery: r.one.harvestingMachinery({
      from: r.harvests.machineryId,
      to: r.harvestingMachinery.id,
    }), // optional - machineryId can be null
  },
  fertilizerSpreaders: {
    farm: r.one.farms({
      from: r.fertilizerSpreaders.farmId,
      to: r.farms.id,
      optional: false,
    }),
    fertilizerApplications: r.many.fertilizerApplications(),
  },
  fertilizers: {
    farm: r.one.farms({
      from: r.fertilizers.farmId,
      to: r.farms.id,
      optional: false,
    }),
    fertilizerApplications: r.many.fertilizerApplications(),
    defaultSpreader: r.one.fertilizerSpreaders({
      from: r.fertilizers.defaultSpreaderId,
      to: r.fertilizerSpreaders.id,
    }), // optional - defaultSpreaderId can be null
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
    spreader: r.one.fertilizerSpreaders({
      from: r.fertilizerApplications.spreaderId,
      to: r.fertilizerSpreaders.id,
    }), // optional - spreaderId can be null
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
  sponsorshipTypes: {
    farm: r.one.farms({
      from: r.sponsorshipTypes.farmId,
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
    sponsorshipType: r.one.sponsorshipTypes({
      from: r.sponsorships.sponsorshipTypeId,
      to: r.sponsorshipTypes.id,
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
export const tillageActionSchema = z.enum(tillageAction.enumValues);
export const tillageReasonSchema = z.enum(tillageReason.enumValues);

export const cropProtectionUnitSchema = z.enum(cropProtectionUnit.enumValues);

export const processingTypeEnumSchema = z.enum(processingType.enumValues);
export const conservationMethodEnumSchema = z.enum(
  conservationMethod.enumValues,
);

export const fertilizerUnitSchema = z.enum(fertilizerUnit.enumValues);
export const fertilizerTypeSchema = z.enum(fertilizerType.enumValues);
export const fertilizationMethodSchema = z.enum(fertilizationMethod.enumValues);

export const animalTypeSchema = z.enum(animalType.enumValues);
export const deathReasonSchema = z.enum(deathReason.enumValues);

export const preferredCommunicationSchema = z.enum(
  preferredCommunication.enumValues,
);

export const paymentMethodSchema = z.enum(paymentMethod.enumValues);

export const productCategorySchema = z.enum(productCategory.enumValues);
export const productUnitSchema = z.enum(productUnit.enumValues);
export const orderStatusSchema = z.enum(orderStatus.enumValues);

const selectFederalFarmPlotSchema = createSelectSchema(
  federalFarmPlots,
  {},
).shape;
