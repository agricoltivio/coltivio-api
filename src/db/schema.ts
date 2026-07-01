import { defineRelations } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { z } from "zod";

const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value: Buffer | string) {
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from((value as string).replace(/^\\x/, ""), "hex");
  },
});

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

export const farmRoleEnum = pgEnum("farm_role", ["owner", "member"]);

export const farmPermissionFeatureEnum = pgEnum("farm_permission_feature", [
  "animals",
  "field_calendar",
  "commerce",
  "tasks",
]);

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "USER", "CONTRACTOR"]);

export const federalFarmPlots = pgTable(
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
    index("federal_farm_id_idx").using("gin", table.federalFarmId.op("gin_trgm_ops")),
  ]
);

export const profiles = pgTable("profiles", {
  id: uuid().primaryKey().notNull(),
  email: text().notNull().unique(),
  passwordHash: text(),
  fullName: text(),
  emailVerified: boolean().notNull().default(false),
  locale: text().notNull().default("de"),
  farmId: uuid().references(() => farms.id, { onDelete: "set null" }),
  farmRole: farmRoleEnum(),
});

export const farms = pgTable("farms", {
  id: uuid().primaryKey().defaultRandom(),
  federalId: text(),
  tvdId: text(),
  name: text().notNull(),
  address: text().notNull(),
  location: point(),
});

export const invoiceSettings = pgTable(
  "invoice_settings",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    name: text().notNull().default(""),
    senderName: text().notNull().default(""),
    street: text().notNull().default(""),
    zip: text().notNull().default(""),
    city: text().notNull().default(""),
    phone: text(),
    email: text(),
    website: text(),
    iban: text(),
    bankName: text(),
    paymentTermsDays: integer().notNull().default(30),
    introText: text(),
    closingText: text(),
    logoData: bytea(),
    logoMimeType: text(),
    updatedAt: timestamp({ mode: "date" }).defaultNow().notNull(),
  },
  (table) => [unique("invoice_settings_farm_name_unique").on(table.farmId, table.name)]
);

export const parcels = pgTable(
  "parcels",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    communalId: text().notNull(),
    gisId: integer(),
    geometry: polygon(),
    size: integer().notNull(),
  },
  (table) => [index("parcel_geometries_idx").using("gist", table.geometry), index("parcel_gisid_idx").on(table.gisId)]
);

export const cropRotations = pgTable("crop_rotations", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  plotId: uuid()
    .notNull()
    .references(() => plots.id, { onDelete: "cascade" }),
  cropId: uuid()
    .notNull()
    .references(() => crops.id),
  sowingDate: date({ mode: "date" }),
  fromDate: date({ mode: "date" }).notNull(),
  toDate: date({ mode: "date" }).notNull(),
});

export const frequency = pgEnum("frequency", ["weekly", "monthly", "yearly"]);

export const taskStatus = pgEnum("task_status", ["todo", "done"]);

export const taskLinkType = pgEnum("task_link_type", [
  "animal",
  "plot",
  "contact",
  "order",
  "wiki_entry",
  "treatment",
  "herd",
]);

export const weekday = pgEnum("weekday", ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

export const cropRotationYearlyRecurrences = pgTable("crop_rotation_yearly_recurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  cropRotationId: uuid("crop_rotation_id")
    .references(() => cropRotations.id, { onDelete: "cascade" })
    .notNull(),
  interval: integer("interval").default(1).notNull(),
  until: date({ mode: "date" }),
});

export const cropRotationDraftPlans = pgTable("crop_rotation_draft_plans", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const cropRotationDraftPlanPlots = pgTable("crop_rotation_draft_plan_plots", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  draftPlanId: uuid()
    .notNull()
    .references(() => cropRotationDraftPlans.id, { onDelete: "cascade" }),
  plotId: uuid()
    .notNull()
    .references(() => plots.id, { onDelete: "cascade" }),
});

export const cropRotationDraftPlanEntries = pgTable("crop_rotation_draft_plan_entries", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  draftPlanPlotId: uuid()
    .notNull()
    .references(() => cropRotationDraftPlanPlots.id, { onDelete: "cascade" }),
  cropId: uuid()
    .notNull()
    .references(() => crops.id),
  sowingDate: date({ mode: "date" }),
  fromDate: date({ mode: "date" }).notNull(),
  toDate: date({ mode: "date" }).notNull(),
  recurrenceInterval: integer(),
  recurrenceUntil: date({ mode: "date" }),
});

export const tillageReason = pgEnum("tillage_reason", ["weed_control", "soil_loosening", "other"]);

export const tillageAction = pgEnum("tillage_action", [
  "plowing",
  "tilling",
  "harrowing",
  "rolling",
  "rotavating",
  "weed_harrowing",
  "hoeing",
  "flame_weeding",
  "custom",
]);

export const tillagePresets = pgTable("tillage_presets", {
  id: uuid().defaultRandom().primaryKey(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  reason: tillageReason(),
  action: tillageAction().notNull(),
  customAction: text(),
});

export const tillages = pgTable("tillages", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
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
});

export const cropProtectionUnit = pgEnum("crop_protection_unit", ["ml", "l", "g", "kg"]);

export const cropProtectionProducts = pgTable("crop_protection_products", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  unit: cropProtectionUnit().notNull(),
  description: text(),
});

export const cropProtectionApplicationMethod = pgEnum("crop_protection_application_method", [
  "spraying",
  "misting",
  "broadcasting",
  "injecting",
  "other",
]);

export const cropProtectionApplicationUnit = pgEnum("crop_protection_application_unit", [
  "load",
  "bag",
  "total_amount",
  "amount_per_hectare",
  "other",
]);

export const cropProtectionApplicationPresets = pgTable("crop_protection_application_presets", {
  id: uuid().defaultRandom().primaryKey(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  method: cropProtectionApplicationMethod(),
  unit: cropProtectionApplicationUnit().notNull(),
  customUnit: text(),
  amountPerUnit: real().notNull(),
});

export const cropProtectionApplications = pgTable("crop_protection_applications", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
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
});

export const plots = pgTable(
  "plots",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    name: text().notNull(),
    localId: text(),
    usage: integer(),
    cuttingDate: date({ mode: "date" }),
    geometry: polygon().notNull(),
    size: integer().notNull(),
    additionalNotes: text(),
  },
  (table) => [index("plot_geometries_idx").using("gist", table.geometry)]
);

export const conservationMethod = pgEnum("conservation_method", ["dried", "silage", "haylage", "other", "none"]);

export const cropCategory = pgEnum("crop_category", ["grass", "grain", "vegetable", "fruit", "other"]);

export const cropFamilies = pgTable("crop_families", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  waitingTimeInYears: integer().notNull().default(0),
  additionalNotes: text(),
});

export const crops = pgTable("crops", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  category: cropCategory().notNull(),
  familyId: uuid().references(() => cropFamilies.id, { onDelete: "set null" }),
  variety: text(),
  waitingTimeInYears: integer(),
  usageCodes: integer().array().notNull().default([]),
  additionalNotes: text(),
});

export const harvestUnits = pgEnum("harvest_unit", [
  "load",
  "square_bale",
  "round_bale",
  "crate",
  "total_amount",
  "other",
]);

export const harvestPresets = pgTable("harvest_presets", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  unit: harvestUnits().notNull(),
  kilosPerUnit: real().notNull(),
  conservationMethod: conservationMethod(),
});

export const harvests = pgTable("harvests", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
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
});

export const fertilizerUnit = pgEnum("fertilizer_unit", ["l", "kg", "dt", "t"]);

export const animalSex = pgEnum("animal_sex", ["male", "female"]);

export const animalType = pgEnum("animal_type", ["goat", "sheep", "cow", "horse", "donkey", "pig", "deer"]);

export const deathReason = pgEnum("death_reason", ["died", "slaughtered"]);

export const productCategory = pgEnum("product_category", ["meat", "vegetables", "dairy", "eggs", "other"]);

export const productUnit = pgEnum("product_unit", ["kg", "g", "piece", "bunch", "liter"]);

export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "fulfilled", "cancelled"]);

export const preferredCommunication = pgEnum("preferred_communication", ["email", "phone", "whatsapp"]);

export const contacts = pgTable("contacts", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  firstName: text().notNull(),
  lastName: text().notNull(),
  street: text(),
  city: text(),
  zip: text(),
  phone: text(),
  email: text(),
  preferredCommunication: preferredCommunication(),
  labels: text().array().notNull().default([]),
});

export const products = pgTable("products", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  category: productCategory().notNull(),
  unit: productUnit().notNull(),
  pricePerUnit: real().notNull(),
  description: text(),
  active: boolean().notNull().default(true),
});

export const orders = pgTable("orders", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  contactId: uuid()
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  status: orderStatus().notNull().default("pending"),
  orderDate: date({ mode: "date" }).notNull(),
  shippingDate: date({ mode: "date" }),
  notes: text(),
});

export const orderItems = pgTable("order_items", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid()
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: real().notNull(),
  unitPrice: real().notNull(),
});

export const paymentMethod = pgEnum("payment_method", ["cash", "bank_transfer", "twint", "card", "other"]);

export const sponsorshipPrograms = pgTable("sponsorship_programs", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  yearlyCost: real().notNull(),
});

export const sponsorships = pgTable("sponsorships", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  contactId: uuid()
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  animalId: uuid()
    .notNull()
    .references(() => animals.id, { onDelete: "cascade" }),
  sponsorshipProgramId: uuid()
    .notNull()
    .references(() => sponsorshipPrograms.id, { onDelete: "restrict" }),
  startDate: date({ mode: "date" }).notNull(),
  endDate: date({ mode: "date" }),
  notes: text(),
  preferredCommunication: preferredCommunication(),
});

export const payments = pgTable("payments", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  contactId: uuid()
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  sponsorshipId: uuid().references(() => sponsorships.id, { onDelete: "set null" }),
  orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
  date: date({ mode: "date" }).notNull(),
  amount: real().notNull(),
  currency: text().notNull().default("CHF"),
  method: paymentMethod().notNull(),
  notes: text(),
});

export const fertilizerType = pgEnum("fertilizer_type", ["mineral", "organic"]);
export const fertilizationMethod = pgEnum("fertilization_method", ["spray", "spread", "other"]);

export const fertilizers = pgTable("fertilizers", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  type: fertilizerType().notNull(),
  unit: fertilizerUnit().notNull(),
});

export const fertilizerApplicationUnit = pgEnum("fertilizer_application_unit", [
  "load",
  "bag",
  "total_amount",
  "amount_per_hectare",
  "other",
]);

export const fertilizerApplicationPresets = pgTable("fertilizer_application_presets", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  fertilizerId: uuid()
    .notNull()
    .references(() => fertilizers.id, { onDelete: "cascade" }),
  unit: fertilizerApplicationUnit().notNull(),
  method: fertilizationMethod(),
  amountPerUnit: real().notNull(),
});

export const fertilizerApplications = pgTable("fertilizer_applications", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
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
});

export const earTags = pgTable("ear_tags", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  number: text().notNull(),
});

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

export const animals = pgTable(
  "animals",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: animalType().notNull(),
    usage: animalUsage().notNull(),
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
  ]
);

export const herds = pgTable("herds", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
});

export const herdMemberships = pgTable(
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
    toDate: date({ mode: "date" }),
  },
  (table) => [
    index("herd_memberships_animal_id_idx").on(table.animalId),
    index("herd_memberships_herd_id_idx").on(table.herdId),
  ]
);

export const customOutdoorJournalCategories = pgTable(
  "custom_outdoor_journal_categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    startDate: date({ mode: "date" }).notNull(),
    endDate: date({ mode: "date" }),
    category: animalCategory().notNull(),
  },
  (table) => [index("custom_outdoor_journal_categories_animal_id_idx").on(table.animalId)]
);

export const outdoorScheduleType = pgEnum("outdoor_schedule_type", ["pasture", "exercise_yard"]);

export const outdoorSchedules = pgTable("outdoor_shedules", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  herdId: uuid()
    .notNull()
    .references(() => herds.id, { onDelete: "cascade" }),
  startDate: date({ mode: "date" }).notNull(),
  endDate: date({ mode: "date" }),
  type: outdoorScheduleType().notNull(),
  notes: text(),
});

export const outdoorScheduleRecurrences = pgTable("outdoor_schedule_recurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  outdoorScheduleId: uuid("outdoor_schedule_id")
    .references(() => outdoorSchedules.id, { onDelete: "cascade" })
    .notNull(),
  frequency: frequency("frequency").notNull(),
  interval: integer("interval").default(1).notNull(),
  byWeekday: weekday("by_weekday").array(),
  byMonthDay: integer("by_month_day"),
  until: date("until"),
  count: integer("count"),
});

export const drugs = pgTable("drugs", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  isAntibiotic: boolean().notNull().default(false),
  criticalAntibiotic: boolean().notNull(),
  receivedFrom: text().notNull(),
  notes: text(),
});

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

export const drugDosePerUnit = pgEnum("dose_per_unit", ["kg", "animal", "day", "total_amount"]);

export const drugTreatment = pgTable(
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
    unique("drug_treatment_drug_animal_unique").on(table.drugId, table.animalType),
  ]
);

export const treatments = pgTable(
  "treatments",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    drugId: uuid().references(() => drugs.id, { onDelete: "restrict" }),
    startDate: date({ mode: "date" }).notNull(),
    endDate: date({ mode: "date" }).notNull(),
    name: text().notNull(),
    notes: text(),
    drugDoseUnit: drugDoseUnit(),
    drugDoseValue: real(),
    drugDosePerUnit: drugDosePerUnit(),
    drugReceivedFrom: text(),
    isAntibiotic: boolean().notNull().default(false),
    criticalAntibiotic: boolean().notNull(),
    antibiogramAvailable: boolean().notNull(),
    milkUsableDate: date("milk_usable_date", { mode: "date" }),
    meatUsableDate: date("meat_usable_date", { mode: "date" }),
    organsUsableDate: date("organs_usable_date", { mode: "date" }),
    createdAt: timestamp().notNull().defaultNow(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
  },
  (table) => [index("treatments_drug_id_idx").on(table.drugId), index("treatments_date_idx").on(table.startDate)]
);

export const animalTreatments = pgTable(
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
  ]
);

// Wiki — private farm knowledge base (no public/community features)

export const wikiEntryStatus = pgEnum("wiki_entry_status", ["draft", "published"]);

export const wikiLocale = pgEnum("wiki_locale", ["de", "en", "it", "fr"]);

export const wikiCategories = pgTable("wiki_categories", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const wikiCategoryTranslations = pgTable(
  "wiki_category_translations",
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => wikiCategories.id, { onDelete: "cascade" }),
    locale: wikiLocale().notNull(),
    name: text().notNull(),
  },
  (table) => [
    unique("wiki_category_translations_unique").on(table.categoryId, table.locale),
    index("wiki_category_translations_category_id_idx").on(table.categoryId),
  ]
);

export const wikiEntries = pgTable(
  "wiki_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    status: wikiEntryStatus().notNull().default("draft"),
    createdBy: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => wikiCategories.id, { onDelete: "restrict" }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("wiki_entries_status_idx").on(table.status)]
);

export const wikiTags = pgTable("wiki_tags", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  slug: text().notNull().unique(),
  createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp().notNull().defaultNow(),
});

export const wikiEntryTags = pgTable(
  "wiki_entry_tags",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => wikiEntries.id, { onDelete: "cascade" }),
    tagId: uuid()
      .notNull()
      .references(() => wikiTags.id, { onDelete: "cascade" }),
  },
  (table) => [unique("wiki_entry_tags_unique").on(table.entryId, table.tagId)]
);

export const wikiEntryTranslations = pgTable(
  "wiki_entry_translations",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => wikiEntries.id, { onDelete: "cascade" }),
    locale: wikiLocale().notNull(),
    title: text().notNull(),
    body: text().notNull().default(""),
    updatedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    unique("wiki_entry_translations_entry_locale_unique").on(table.entryId, table.locale),
    index("wiki_entry_translations_entry_id_idx").on(table.entryId),
  ]
);

export const wikiEntryImages = pgTable(
  "wiki_entry_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid().notNull(),
    storagePath: text().notNull(),
    altText: text(),
    uploadedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("wiki_entry_images_entry_id_idx").on(table.entryId)]
);

export const tasks = pgTable("tasks", {
  id: uuid().primaryKey().defaultRandom(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  labels: text().array().notNull().default([]),
  status: taskStatus().notNull().default("todo"),
  pinned: boolean().notNull().default(false),
  assigneeId: uuid().references(() => profiles.id, { onDelete: "set null" }),
  dueDate: date({ mode: "date" }),
  createdAt: timestamp().notNull().defaultNow(),
  createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
});

export const taskRecurrences = pgTable("task_recurrences", {
  id: uuid().defaultRandom().primaryKey(),
  farmId: uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  taskId: uuid()
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  frequency: frequency("frequency").notNull(),
  interval: integer("interval").default(1).notNull(),
  byWeekday: weekday("by_weekday").array(),
  byMonthDay: integer("by_month_day"),
  until: date("until", { mode: "date" }),
  count: integer("count"),
});

export const taskLinks = pgTable(
  "task_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    taskId: uuid()
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    linkType: taskLinkType().notNull(),
    linkedId: uuid().notNull(),
  },
  (table) => [
    unique("task_links_unique").on(table.taskId, table.linkType, table.linkedId),
    index("task_links_task_id_idx").on(table.taskId),
  ]
);

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    taskId: uuid()
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    name: text().notNull(),
    position: integer().notNull().default(0),
    dueDate: date({ mode: "date" }),
    done: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("task_checklist_items_task_id_idx").on(table.taskId)]
);

export const farmMemberPermissions = pgTable(
  "farm_member_permissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    feature: farmPermissionFeatureEnum().notNull(),
    access: text().$type<"none" | "read" | "write">().notNull().default("none"),
  },
  (table) => [unique("farm_member_permissions_user_feature_unique").on(table.userId, table.feature)]
);

export const plotJournalEntries = pgTable(
  "plot_journal_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    plotId: uuid()
      .notNull()
      .references(() => plots.id, { onDelete: "cascade" }),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    title: text().notNull(),
    date: date({ mode: "date" }).notNull(),
    content: text(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("plot_journal_entries_plot_id_idx").on(table.plotId)]
);

export const plotJournalImages = pgTable(
  "plot_journal_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    journalEntryId: uuid().notNull(),
    storagePath: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("plot_journal_images_entry_id_idx").on(table.journalEntryId)]
);

export const animalJournalEntries = pgTable(
  "animal_journal_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    farmId: uuid()
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    title: text().notNull(),
    date: date({ mode: "date" }).notNull(),
    content: text(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("animal_journal_entries_animal_id_idx").on(table.animalId)]
);

export const animalJournalImages = pgTable(
  "animal_journal_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    journalEntryId: uuid().notNull(),
    storagePath: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("animal_journal_images_entry_id_idx").on(table.journalEntryId)]
);

// Schema object for defineRelations
const tables = {
  federalFarmPlots,
  profiles,
  farms,
  parcels,
  cropRotations,
  cropRotationRecurrences: cropRotationYearlyRecurrences,
  cropRotationDraftPlans,
  cropRotationDraftPlanPlots,
  cropRotationDraftPlanEntries,
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
  customOutdoorJournalCategories,
  outdoorSchedules,
  outdoorScheduleRecurrences,
  wikiCategories,
  wikiCategoryTranslations,
  wikiEntries,
  wikiTags,
  wikiEntryTags,
  wikiEntryTranslations,
  wikiEntryImages,
  tasks,
  taskRecurrences,
  taskLinks,
  taskChecklistItems,
  farmMemberPermissions,
  plotJournalEntries,
  plotJournalImages,
  animalJournalEntries,
  animalJournalImages,
  invoiceSettings,
};

export const relations = defineRelations(tables, (r) => ({
  profiles: {
    farm: r.one.farms({
      from: r.profiles.farmId,
      to: r.farms.id,
    }),
  },
  farms: {
    users: r.many.profiles(),
    parcels: r.many.parcels(),
    plots: r.many.plots(),
    harvests: r.many.harvests(),
    fertilizerApplications: r.many.fertilizerApplications(),
  },
  farmMemberPermissions: {
    farm: r.one.farms({
      from: r.farmMemberPermissions.farmId,
      to: r.farms.id,
      optional: false,
    }),
    user: r.one.profiles({
      from: r.farmMemberPermissions.userId,
      to: r.profiles.id,
      optional: false,
    }),
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
  cropRotationDraftPlans: {
    plots: r.many.cropRotationDraftPlanPlots(),
  },
  cropRotationDraftPlanPlots: {
    draftPlan: r.one.cropRotationDraftPlans({
      from: r.cropRotationDraftPlanPlots.draftPlanId,
      to: r.cropRotationDraftPlans.id,
      optional: false,
    }),
    plot: r.one.plots({
      from: r.cropRotationDraftPlanPlots.plotId,
      to: r.plots.id,
      optional: false,
    }),
    entries: r.many.cropRotationDraftPlanEntries(),
  },
  cropRotationDraftPlanEntries: {
    draftPlanPlot: r.one.cropRotationDraftPlanPlots({
      from: r.cropRotationDraftPlanEntries.draftPlanPlotId,
      to: r.cropRotationDraftPlanPlots.id,
      optional: false,
    }),
    crop: r.one.crops({
      from: r.cropRotationDraftPlanEntries.cropId,
      to: r.crops.id,
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
    journalEntries: r.many.plotJournalEntries(),
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
    }),
    order: r.one.orders({
      from: r.payments.orderId,
      to: r.orders.id,
    }),
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
    }),
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
    }),
    mother: r.one.animals({
      from: r.animals.motherId,
      to: r.animals.id,
      alias: "mother",
    }),
    father: r.one.animals({
      from: r.animals.fatherId,
      to: r.animals.id,
      alias: "father",
    }),
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
    customOutdoorJournalCategories: r.many.customOutdoorJournalCategories(),
    journalEntries: r.many.animalJournalEntries(),
  },
  customOutdoorJournalCategories: {
    farm: r.one.farms({
      from: r.customOutdoorJournalCategories.farmId,
      to: r.farms.id,
      optional: false,
    }),
    animal: r.one.animals({
      from: r.customOutdoorJournalCategories.animalId,
      to: r.animals.id,
      optional: false,
    }),
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
    }),
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
  wikiCategories: {
    translations: r.many.wikiCategoryTranslations(),
    entries: r.many.wikiEntries(),
  },
  wikiCategoryTranslations: {
    category: r.one.wikiCategories({
      from: r.wikiCategoryTranslations.categoryId,
      to: r.wikiCategories.id,
      optional: false,
    }),
  },
  wikiEntries: {
    creator: r.one.profiles({
      from: r.wikiEntries.createdBy,
      to: r.profiles.id,
      optional: false,
    }),
    farm: r.one.farms({
      from: r.wikiEntries.farmId,
      to: r.farms.id,
    }),
    category: r.one.wikiCategories({
      from: r.wikiEntries.categoryId,
      to: r.wikiCategories.id,
      optional: false,
    }),
    translations: r.many.wikiEntryTranslations(),
    images: r.many.wikiEntryImages(),
    tags: r.many.wikiEntryTags(),
  },
  wikiTags: {
    creator: r.one.profiles({
      from: r.wikiTags.createdBy,
      to: r.profiles.id,
    }),
    entries: r.many.wikiEntryTags(),
  },
  wikiEntryTags: {
    entry: r.one.wikiEntries({
      from: r.wikiEntryTags.entryId,
      to: r.wikiEntries.id,
      optional: false,
    }),
    tag: r.one.wikiTags({
      from: r.wikiEntryTags.tagId,
      to: r.wikiTags.id,
      optional: false,
    }),
  },
  wikiEntryTranslations: {
    entry: r.one.wikiEntries({
      from: r.wikiEntryTranslations.entryId,
      to: r.wikiEntries.id,
      optional: false,
    }),
  },
  wikiEntryImages: {
    entry: r.one.wikiEntries({
      from: r.wikiEntryImages.entryId,
      to: r.wikiEntries.id,
      optional: false,
    }),
  },
  tasks: {
    farm: r.one.farms({
      from: r.tasks.farmId,
      to: r.farms.id,
      optional: false,
    }),
    assignee: r.one.profiles({
      from: r.tasks.assigneeId,
      to: r.profiles.id,
    }),
    createdByProfile: r.one.profiles({
      from: r.tasks.createdBy,
      to: r.profiles.id,
    }),
    recurrence: r.one.taskRecurrences(),
    links: r.many.taskLinks(),
    checklistItems: r.many.taskChecklistItems(),
  },
  taskRecurrences: {
    task: r.one.tasks({
      from: r.taskRecurrences.taskId,
      to: r.tasks.id,
      optional: false,
    }),
  },
  taskLinks: {
    task: r.one.tasks({
      from: r.taskLinks.taskId,
      to: r.tasks.id,
      optional: false,
    }),
  },
  taskChecklistItems: {
    task: r.one.tasks({
      from: r.taskChecklistItems.taskId,
      to: r.tasks.id,
      optional: false,
    }),
  },
  plotJournalEntries: {
    plot: r.one.plots({
      from: r.plotJournalEntries.plotId,
      to: r.plots.id,
      optional: false,
    }),
    farm: r.one.farms({
      from: r.plotJournalEntries.farmId,
      to: r.farms.id,
      optional: false,
    }),
    images: r.many.plotJournalImages(),
  },
  plotJournalImages: {
    journalEntry: r.one.plotJournalEntries({
      from: r.plotJournalImages.journalEntryId,
      to: r.plotJournalEntries.id,
      optional: false,
    }),
  },
  animalJournalEntries: {
    animal: r.one.animals({
      from: r.animalJournalEntries.animalId,
      to: r.animals.id,
      optional: false,
    }),
    farm: r.one.farms({
      from: r.animalJournalEntries.farmId,
      to: r.farms.id,
      optional: false,
    }),
    images: r.many.animalJournalImages(),
  },
  animalJournalImages: {
    journalEntry: r.one.animalJournalEntries({
      from: r.animalJournalImages.journalEntryId,
      to: r.animalJournalEntries.id,
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
export const cropProtectionApplicationUnitSchema = z.enum(cropProtectionApplicationUnit.enumValues);
export const cropProtectionApplicationMethodSchema = z.enum(cropProtectionApplicationMethod.enumValues);
export const tillageActionSchema = z.enum(tillageAction.enumValues);
export const tillageReasonSchema = z.enum(tillageReason.enumValues);

export const cropProtectionUnitSchema = z.enum(cropProtectionUnit.enumValues);

export const harvestUnitsSchema = z.enum(harvestUnits.enumValues);
export const conservationMethodEnumSchema = z.enum(conservationMethod.enumValues);

export const fertilizerApplicationUnitSchema = z.enum(fertilizerApplicationUnit.enumValues);
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

export const preferredCommunicationSchema = z.enum(preferredCommunication.enumValues);

export const frequencySchema = z.enum(frequency.enumValues);
export const weekdaySchema = z.enum(weekday.enumValues);

export const paymentMethodSchema = z.enum(paymentMethod.enumValues);

export const productCategorySchema = z.enum(productCategory.enumValues);
export const productUnitSchema = z.enum(productUnit.enumValues);
export const orderStatusSchema = z.enum(orderStatus.enumValues);

export const farmPermissionFeatureSchema = z.enum(farmPermissionFeatureEnum.enumValues);
export type FarmPermissionFeature = z.infer<typeof farmPermissionFeatureSchema>;

export const wikiCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  createdAt: z.string().or(z.date()),
  translations: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string(),
      locale: z.enum(["de", "en", "it", "fr"]),
      name: z.string(),
    })
  ),
});

export const wikiEntryStatusSchema = z.enum(wikiEntryStatus.enumValues);
export const wikiLocaleSchema = z.enum(wikiLocale.enumValues);

export const taskStatusSchema = z.enum(taskStatus.enumValues);
export const taskLinkTypeSchema = z.enum(taskLinkType.enumValues);
