import { Prisma } from "@zenstackhq/runtime/models";
import { randomUUID } from "crypto";
import _ from "lodash";
import { DeepPartial } from "./utility-types";

export function aUser(
  user: DeepPartial<Prisma.UserCreateInput> = {}
): Prisma.UserCreateInput {
  const defaultUser: Prisma.UserCreateInput = {
    name: "Someone",
    email: "someone@bla.ch",
    username: "someone",
  };
  return _.merge(defaultUser, user);
}

export function aFarmForUser(
  userId: string,
  farm: DeepPartial<Prisma.FarmCreateInput> = {}
): Prisma.FarmCreateInput {
  const defaultFarm: Prisma.FarmCreateInput = {
    name: "Agri Miadi",
    slug: "agri-miadi",
    tvdNumber: "107102",
    federalId: "123/571/1",
    members: {
      create: {
        userId: userId,
        role: "ADMIN",
      },
    },
  };
  return _.merge(defaultFarm, farm);
}

export function someArea(
  farmId: string,
  land: DeepPartial<Prisma.AreaCreateInput> = {},
  parcelNumber: string = randomUUID()
): Prisma.AreaCreateInput {
  const defaultLand: Prisma.AreaCreateInput = {
    name: "Sot Miadi",
    parcel: {
      connectOrCreate: {
        create: { parcelNumber: parcelNumber, farmId: farmId },
        where: { parcelNumber: parcelNumber },
      },
    },
    sizeInSquareMeters: 45,
  };
  return _.merge(defaultLand, land);
}

export function aParcelOwner(
  farmId: string,
  parcelOwner: DeepPartial<Prisma.ParcelOwnerCreateInput> = {}
): Prisma.ParcelOwnerCreateInput {
  const defaultContact: Prisma.ParcelOwnerCreateInput = {
    farm: {
      connect: {
        id: farmId,
      },
    },
    firstName: "Henry",
    lastName: "Giacomelli",
    phoneNumber: "123456789",
    email: "henry@bla.ch",
    street: "Stabbio",
    zip: "6544",
    city: "Braggio",
  };
  return _.merge(defaultContact, parcelOwner);
}
