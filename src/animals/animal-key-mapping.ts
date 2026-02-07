import { AnimalCategory, AnimalSex, AnimalType } from "./animals";

const animalKeyMapping: Record<
  AnimalType,
  {
    minAgeDays: number;
    maxAgeDays?: number;
    sex?: AnimalSex;
    onlyMilking?: boolean;
    key: AnimalCategory;
  }[]
> = {
  cow: [
    {
      minAgeDays: 365,
      sex: "female",
      key: "A3",
    },
    {
      minAgeDays: 161,
      maxAgeDays: 364,
      sex: "female",
      key: "A4",
    },
    {
      minAgeDays: 0,
      maxAgeDays: 160,
      sex: "female",
      key: "A5",
    },
    {
      minAgeDays: 730,
      sex: "male",
      key: "A6",
    },
    {
      minAgeDays: 366,
      maxAgeDays: 729,
      sex: "male",
      key: "A7",
    },
    {
      minAgeDays: 160,
      maxAgeDays: 365,
      sex: "male",
      key: "A8",
    },
  ],
  goat: [
    {
      minAgeDays: 365,
      sex: "female",
      key: "C1",
    },
    {
      minAgeDays: 365,
      sex: "male",
      key: "C2",
    },
  ],
  sheep: [],
  horse: [],
  donkey: [],
  deer: [],
  pig: [],
};

export function mapAnimaltoKey(aimalType: AnimalType, dateOfBirth: Date) {
  let age = new Date().getFullYear() - dateOfBirth.getFullYear();
}
