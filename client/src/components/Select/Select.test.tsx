import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("renders a native select and passes props through", async () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Pick one" defaultValue="a" onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pick one" }), "B");

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(
      <Select aria-label="Locked" disabled>
        <option>A</option>
      </Select>,
    );

    expect(screen.getByRole("combobox", { name: "Locked" })).toBeDisabled();
  });
});
