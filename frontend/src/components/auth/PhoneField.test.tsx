import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PhoneField from "./PhoneField";
import type { CountryCode } from "@/lib/countries";

function Harness() {
  const [country, setCountry] = useState<CountryCode>("IN");
  const [national, setNational] = useState("");
  return (
    <PhoneField id="phone" country={country} national={national}
      onCountryChange={setCountry} onNationalChange={setNational} />
  );
}

const countryButton = () => screen.getByRole("button", { name: /^Country code:/ });

describe("PhoneField", () => {
  it("defaults to India (+91)", () => {
    render(<Harness />);
    expect(countryButton()).toHaveAccessibleName(/India \+91/);
  });

  it("accepts digits only", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText("Phone number"), "98a76-5");
    expect(screen.getByLabelText("Phone number")).toHaveValue("98765");
  });

  it("picks a country by searching its name, then focuses the number box", async () => {
    render(<Harness />);
    await userEvent.click(countryButton());
    await userEvent.type(screen.getByRole("combobox", { name: "Search countries" }), "united states");
    await userEvent.click(screen.getByRole("option", { name: /^United States \+1$/ }));
    expect(countryButton()).toHaveAccessibleName(/United States \+1/);
    expect(screen.getByLabelText("Phone number")).toHaveFocus();
  });

  it("finds countries by dial code", async () => {
    render(<Harness />);
    await userEvent.click(countryButton());
    await userEvent.type(screen.getByRole("combobox", { name: "Search countries" }), "+44");
    expect(screen.getByRole("option", { name: /^United Kingdom \+44$/ })).toBeInTheDocument();
  });

  it("selects with the keyboard and closes with Escape", async () => {
    render(<Harness />);
    await userEvent.click(countryButton());
    const search = screen.getByRole("combobox", { name: "Search countries" });
    await userEvent.type(search, "germany{Enter}");
    expect(countryButton()).toHaveAccessibleName(/Germany \+49/);

    await userEvent.click(countryButton());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("switches country when a full international number is pasted", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Phone number"));
    await userEvent.paste("+49 1512 3456789");
    expect(countryButton()).toHaveAccessibleName(/Germany \+49/);
    expect(screen.getByLabelText("Phone number")).toHaveValue("15123456789");
  });
});