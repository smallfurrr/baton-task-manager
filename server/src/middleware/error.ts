import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, NotFoundError } from "../errors.js";

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route not found: ${req.method} ${req.path}`);
};

/** Body-parser errors carry a status and a `type`; malformed JSON is a client error. */
function isMalformedJson(err: unknown): boolean {
  return err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed";
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  if (isMalformedJson(err)) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};
