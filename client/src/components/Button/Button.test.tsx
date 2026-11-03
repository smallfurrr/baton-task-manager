import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a native button that passes props through", async () => {
    const onClick = vi.fn();
    render(
      <Button type="button" onClick={onClick}>
        Add subtask
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add subtask" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button type="button" disabled onClick={onClick}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a caller's class alongside its own", () => {
    render(
      <Button type="button" className="extra">
        Go
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("extra");
  });
});
