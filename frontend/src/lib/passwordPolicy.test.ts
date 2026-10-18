export const PASSWORD_RULES_MESSAGE = "Password does not match the password rules.";

import { describe, expect, it } from "vitest";
import { evaluatePassword } from "./passwordPolicy";

describe("evaluatePassword", () => {
  it("accepts a strong password", () => {
    expect(evaluatePassword("Str0ng!Passphrase#42").allMet).toBe(true);
  });

  it.each([
    ["Sh0rt!Ab", "length"],
    ["alllowercase123!", "upper"],
    ["ALLUPPERCASE123!", "lower"],
    ["NoDigitsHere!!Abc", "digit"],
    ["NoSpecialChars1234Abc", "special"],
  ])("flags %s as failing the %s rule", (pw, id) => {
    const r = evaluatePassword(pw);
    expect(r.allMet).toBe(false);
    expect(r.results.find((x) => x.id === id)?.met).toBe(false);
  });

  it("checks the username rule only when a username is supplied", () => {
    expect(evaluatePassword("Alice#Strong99xyz").results.some((r) => r.id === "username")).toBe(false);
    expect(evaluatePassword("Alice#Strong99xyz", "alice").allMet).toBe(false);
  });
});