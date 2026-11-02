/** An error response from the API, or a failure to reach it (status 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => undefined);
  if (isErrorBody(body)) {
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return new ApiError(res.status, "HTTP_ERROR", `Request failed (${res.status})`);
}

/**
 * Call the API. Paths are relative to `/api`, which is proxied to the server
 * in both Docker (nginx) and local dev (Vite).
 *
 * The response body is trusted to match `T`; there is no runtime validation.
 */
export async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
