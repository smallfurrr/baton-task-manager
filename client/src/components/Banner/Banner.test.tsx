import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "./Banner";

describe("Banner", () => {
  it("announces an error as an alert", () => {
    render(<Banner variant="error" message="Something broke" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });

  it("announces a notice as a status message", () => {
    render(<Banner variant="notice" message="Task created" />);

    expect(screen.getByRole("status")).toHaveTextContent("Task created");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
