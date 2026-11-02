import { vi } from "vitest";

/** Replace global fetch with a mock that returns the given responses in order. */
export function mockFetch(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Handler = Response | ((body: unknown) => Response);

/**
 * Route-based fetch mock for page tests. Keys look like "GET /api/tasks";
 * a request with no matching key fails the test loudly. Handlers may be
 * functions so responses can reflect state changed by earlier requests.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn((url: string, init?: { method?: string; body?: string }) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const handler = routes[key];
    if (!handler) return Promise.reject(new Error(`Unmocked request: ${key}`));
    const body: unknown = init?.body ? JSON.parse(init.body) : undefined;
    return Promise.resolve(typeof handler === "function" ? handler(body) : handler.clone());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
