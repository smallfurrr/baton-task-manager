import { z } from "zod";
import { ValidationError } from "./errors.js";

const POSTGRES_INT_MAX = 2_147_483_647;

/** A positive integer that fits in a Postgres `integer` column, so it can never cause a database range error. */
export const idNumberSchema = z.number().int().min(1).max(POSTGRES_INT_MAX);

/** The same id as it appears in a URL path segment. */
const idSchema = z.string().regex(/^\d+$/, "must be a positive integer").transform(Number).pipe(idNumberSchema);

export function parseId(value: unknown, name = "id"): number {
  const result = idSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid ${name}: must be a positive integer`);
  }
  return result.data;
}

/** Parse a request body against a zod schema, turning failures into a 400. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new ValidationError("Invalid request body", details);
  }
  return result.data;
}
