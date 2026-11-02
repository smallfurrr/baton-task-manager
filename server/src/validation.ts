import { z } from "zod";
import { ValidationError } from "./errors.js";

const POSTGRES_INT_MAX = 2_147_483_647;

/** A positive integer id as it appears in a URL path segment. */
const idSchema = z
  .string()
  .regex(/^\d+$/, "must be a positive integer")
  .transform(Number)
  .pipe(z.number().int().min(1).max(POSTGRES_INT_MAX));

export function parseId(value: unknown, name = "id"): number {
  const result = idSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid ${name}: must be a positive integer`);
  }
  return result.data;
}
