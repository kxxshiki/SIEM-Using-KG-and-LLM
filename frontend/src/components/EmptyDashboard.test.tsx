import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EmptyDashboard from "./EmptyDashboard";

const renderIt = (state: "checking" | "empty" | "failed") =>
  render(
    <MemoryRouter>
      <EmptyDashboard state={state} />
    </MemoryRouter>
  );

describe("EmptyDashboard", () => {
  it("shows dashes and no numbers while checking", () => {
    renderIt("checking");
    expect(screen.getAllByText("—")).toHaveLength(5);
    expect(screen.queryByText(/^\d+$/)).toBeNull();
    expect(screen.queryByText("No logs yet")).toBeNull();
  });

  it("explains the empty state and links to the upload page", () => {
    renderIt("empty");
    expect(screen.getByText("No logs yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload logs/i })).toHaveAttribute("href", "/sources");
  });
});