import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, type InitialEntry } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useNavigationNotice } from "./navigationNotice";

function renderAt(route: InitialEntry) {
  return renderHook(() => ({ notice: useNavigationNotice(), state: useLocation().state as unknown }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    ),
  });
}

describe("useNavigationNotice", () => {
  it("returns the notice from router state", () => {
    const { result } = renderAt({ pathname: "/", state: { notice: "Task created" } });

    expect(result.current.notice).toBe("Task created");
  });

  it("keeps showing the notice after clearing it from history, so a reload does not repeat it", async () => {
    const { result } = renderAt({ pathname: "/", state: { notice: "Task created" } });

    await waitFor(() => expect(result.current.state).toBeNull());
    expect(result.current.notice).toBe("Task created");
  });

  it.each([
    ["no state", undefined],
    ["state without a notice", { other: 1 }],
    ["a notice that is not a string", { notice: 42 }],
  ])("returns nothing for %s", (_label, state) => {
    const { result } = renderAt({ pathname: "/", state });

    expect(result.current.notice).toBeUndefined();
  });
});
