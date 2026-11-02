import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, NotFoundError } from "../errors.js";

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route not found: ${req.method} ${req.path}`);
};

/** Body-parser errors carry a `type`; malformed JSON and oversized bodies are client errors. */
function bodyParserErrorType(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "type" in err && typeof err.type === "string"
    ? err.type
    : undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  const parserError = bodyParserErrorType(err);
  if (parserError === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
    return;
  }
  if (parserError === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};
