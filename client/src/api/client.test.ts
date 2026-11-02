import { describe, expect, it } from "vitest";
import { jsonResponse, mockFetch } from "../test/fetch";
import { ApiError, request } from "./client";

describe("request", () => {
  it("calls the path under /api and returns the parsed body", async () => {
    const fetchMock = mockFetch(jsonResponse([{ id: 1, name: "Frontend" }]));

    const result = await request("/skills");

    expect(result).toEqual([{ id: 1, name: "Frontend" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/skills", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
  });

  it("sends a JSON body with a content-type header", async () => {
    const fetchMock = mockFetch(jsonResponse({}, 201));

    await request("/tasks", { method: "POST", body: { title: "t" } });

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"t"}',
    });
  });

  it("turns an API error body into an ApiError with status, code, message and details", async () => {
    const details = { missingSkills: [{ id: 2, name: "Backend" }] };
    mockFetch(
      jsonResponse({ error: { code: "SKILL_MISMATCH", message: "Alice cannot be assigned", details } }, 409),
    );

    const error = await request("/tasks/1", { method: "PATCH", body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "SKILL_MISMATCH",
      message: "Alice cannot be assigned",
      details,
    });
  });

  it("falls back to a generic error when the error response is not JSON", async () => {
    mockFetch(new Response("<html>Bad gateway</html>", { status: 502 }));

    const error = await request("/tasks").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, code: "HTTP_ERROR", message: "Request failed (502)" });
  });

  it("falls back to a generic error when the JSON does not match the error shape", async () => {
    mockFetch(jsonResponse({ message: "nope" }, 500));

    const error = await request("/tasks").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 500, code: "HTTP_ERROR" });
  });

  it("reports a network failure as an ApiError with status 0", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    const error = await request("/tasks").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR", message: "Could not reach the server" });
  });
});
