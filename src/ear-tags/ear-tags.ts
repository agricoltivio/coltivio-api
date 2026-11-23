import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { animals, earTags, farmIdColumnValue } from "../db/schema";
import { Animal } from "../animals/animals";
import { CodedError } from "../errors";

// Conflicting numbers listed in the error message; the rest is summarized as a count
const MAX_LISTED_CONFLICTS = 10;
// Largest range created at once; every number becomes a query parameter (Postgres allows 65535)
export const MAX_EAR_TAG_RANGE_SIZE = 1000;
// Ranges created before the size limit can be bigger; deleting looks them up in chunks of this size
const DELETE_RANGE_CHUNK_SIZE = 1000;
// Only bounds the numbers generated in memory when deleting a range
const MAX_EAR_TAG_DELETE_RANGE_SIZE = 100_000;

export type EarTag = typeof earTags.$inferSelect;
export type EarTagWithAssignment = EarTag & { animal: Animal | null };

// Start and end of a range as prefix + numbers. With a prefix (any text, e.g. "CH 120." or "DE01"), start and
// end are plain numbers. Without one, they carry an optional letter prefix themselves ("CH001"), as before.
// The numbers are zero padded to the start's length.
function parseEarTagRange(
  fromNumberInput: string,
  toNumberInput: string,
  prefixInput: string | undefined,
  maxSize: number
): { prefix: string; fromNum: number; toNum: number; padding: number } {
  let prefix: string;
  let fromNumStr: string;
  let toNumStr: string;
  if (prefixInput !== undefined && prefixInput !== "") {
    if (!/^\d+$/.test(fromNumberInput) || !/^\d+$/.test(toNumberInput)) {
      throw new CodedError("invalid_ear_tag_range", "With a prefix, start and end have to be numbers");
    }
    prefix = prefixInput;
    fromNumStr = fromNumberInput;
    toNumStr = toNumberInput;
  } else {
    const fromMatch = fromNumberInput.match(/^([A-Za-z]*)(\d+)$/);
    const toMatch = toNumberInput.match(/^([A-Za-z]*)(\d+)$/);
    if (!fromMatch || !toMatch) {
      throw new CodedError(
        "invalid_ear_tag_range",
        "Invalid ear tag format. Expected format: PREFIX + NUMBER (e.g., CH001)"
      );
    }
    if (fromMatch[1] !== toMatch[1]) {
      throw new CodedError("invalid_ear_tag_range", "Prefix must be the same for both range boundaries");
    }
    prefix = fromMatch[1];
    fromNumStr = fromMatch[2];
    toNumStr = toMatch[2];
  }

  const fromNum = parseInt(fromNumStr, 10);
  const toNum = parseInt(toNumStr, 10);
  if (fromNum > toNum) {
    throw new CodedError("invalid_ear_tag_range", "Start number must be less than or equal to end number");
  }
  if (toNum - fromNum + 1 > maxSize) {
    throw new CodedError("invalid_ear_tag_range", `A range can contain at most ${maxSize} ear tags`);
  }
  return { prefix, fromNum, toNum, padding: fromNumStr.length };
}

export function earTagsApi(rlsDb: RlsDb) {
  return {
    async getEarTagsForFarm(farmId: string): Promise<EarTagWithAssignment[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.earTags.findMany({
          where: { farmId },
          with: {
            animal: {
              with: {
                earTag: true,
              },
            },
          },
        });
      });
    },

    // Get only unassigned ear tags
    async getAvailableEarTagsForFarm(farmId: string): Promise<EarTag[]> {
      return rlsDb.rls(async (tx) => {
        // Get IDs of ear tags that are assigned to animals
        const assignedTagIds = tx
          .select({ earTagId: animals.earTagId })
          .from(animals)
          .where(and(eq(animals.farmId, farmId), isNotNull(animals.earTagId)));

        // Get ear tags that are not in the assigned list
        const tags = await tx
          .select()
          .from(earTags)
          .where(and(eq(earTags.farmId, farmId), notInArray(earTags.id, assignedTagIds)));
        return tags;
      });
    },

    // Create a range of ear tag numbers (e.g., from "CH001" to "CH010", or prefix "CH 120." with 1 to 10)
    async createEarTagRange(fromNumber: string, toNumber: string, prefix?: string): Promise<EarTag[]> {
      return rlsDb.rls(async (tx) => {
        const range = parseEarTagRange(fromNumber, toNumber, prefix, MAX_EAR_TAG_RANGE_SIZE);
        const tagsToCreate: { number: string }[] = [];
        for (let i = range.fromNum; i <= range.toNum; i++) {
          tagsToCreate.push({ number: `${range.prefix}${i.toString().padStart(range.padding, "0")}` });
        }

        // A range overlapping existing tags is rejected as a whole, so no duplicates are created
        const conflictingTags = await tx
          .select({ number: earTags.number })
          .from(earTags)
          .where(
            inArray(
              earTags.number,
              tagsToCreate.map((tag) => tag.number)
            )
          )
          .orderBy(earTags.number);
        if (conflictingTags.length > 0) {
          const listedNumbers = conflictingTags.slice(0, MAX_LISTED_CONFLICTS).map((tag) => tag.number);
          const remainingCount = conflictingTags.length - listedNumbers.length;
          throw new CodedError(
            "ear_tag_range_conflict",
            `These ear tags already exist: ${listedNumbers.join(", ")}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}`
          );
        }

        // A concurrent request (double tap, web and app at once) can create the same numbers between the check
        // above and this insert. The unique constraint skips them; throwing rolls back the whole range.
        const createdTags = await tx
          .insert(earTags)
          .values(
            tagsToCreate.map((tag) => ({
              ...farmIdColumnValue,
              ...tag,
            }))
          )
          .onConflictDoNothing()
          .returning();
        if (createdTags.length < tagsToCreate.length) {
          throw new CodedError("ear_tag_range_conflict", "Some ear tags of the range were created at the same time");
        }

        return createdTags;
      });
    },

    // Delete a range of ear tag numbers (only unassigned ones)
    async deleteEarTagRange(
      farmId: string,
      fromNumber: string,
      toNumber: string,
      prefix?: string
    ): Promise<{ deletedCount: number; skippedAssigned: string[] }> {
      return rlsDb.rls(async (tx) => {
        const range = parseEarTagRange(fromNumber, toNumber, prefix, MAX_EAR_TAG_DELETE_RANGE_SIZE);
        const numbersInRange: string[] = [];
        for (let i = range.fromNum; i <= range.toNum; i++) {
          numbersInRange.push(`${range.prefix}${i.toString().padStart(range.padding, "0")}`);
        }

        // Find all ear tags in range with their assignment status and delete the unassigned ones, chunked so
        // the number of query parameters stays bounded
        const assignedNumbers: string[] = [];
        let deletedCount = 0;
        for (let offset = 0; offset < numbersInRange.length; offset += DELETE_RANGE_CHUNK_SIZE) {
          const numbersChunk = numbersInRange.slice(offset, offset + DELETE_RANGE_CHUNK_SIZE);
          const tagsInChunk = await tx
            .select({
              id: earTags.id,
              number: earTags.number,
              animalId: animals.id,
            })
            .from(earTags)
            .leftJoin(animals, eq(animals.earTagId, earTags.id))
            .where(and(eq(earTags.farmId, farmId), inArray(earTags.number, numbersChunk)));

          const unassignedTagIds: string[] = [];
          for (const tag of tagsInChunk) {
            if (tag.animalId) {
              assignedNumbers.push(tag.number);
            } else {
              unassignedTagIds.push(tag.id);
            }
          }
          if (unassignedTagIds.length > 0) {
            await tx.delete(earTags).where(inArray(earTags.id, unassignedTagIds));
            deletedCount += unassignedTagIds.length;
          }
        }

        return {
          deletedCount,
          skippedAssigned: assignedNumbers,
        };
      });
    },

    // Changes the number of one ear tag (e.g. a typo, or a format the range didn't cover). Assigned tags can be
    // renamed too, the animal keeps the tag. Returns undefined when the tag isn't visible to the caller.
    async updateEarTagNumber(id: string, number: string): Promise<EarTag | undefined> {
      return rlsDb.rls(async (tx) => {
        const earTag = await tx.query.earTags.findFirst({ where: { id } });
        if (!earTag) return undefined;
        if (earTag.number === number) return earTag;
        const taken = await tx.query.earTags.findFirst({ where: { number }, columns: { id: true } });
        if (taken) {
          throw new CodedError("ear_tag_number_taken", "Another ear tag already has this number");
        }
        const [updated] = await tx.update(earTags).set({ number }).where(eq(earTags.id, id)).returning();
        return updated;
      });
    },

    // Deletes one ear tag by id, whatever its number looks like (imported numbers don't follow the
    // range format). Returns false when the tag isn't visible to the caller.
    async deleteEarTag(id: string): Promise<boolean> {
      return rlsDb.rls(async (tx) => {
        const earTag = await tx.query.earTags.findFirst({ where: { id }, columns: { id: true } });
        if (!earTag) return false;
        const assignedAnimal = await tx.query.animals.findFirst({ where: { earTagId: id }, columns: { id: true } });
        if (assignedAnimal) {
          throw new CodedError("ear_tag_assigned", "The ear tag is assigned to an animal");
        }
        await tx.delete(earTags).where(eq(earTags.id, id));
        return true;
      });
    },

    async getEarTagById(id: string): Promise<EarTagWithAssignment | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.earTags.findFirst({
          where: { id },
          with: {
            animal: {
              with: {
                earTag: true,
              },
            },
          },
        });
      });
    },
  };
}
