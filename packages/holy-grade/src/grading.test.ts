import { describe, it, expect } from "vitest";
import { french, yds, fb, hueco, uiaa, saxon, convertGrade } from "./index";
import { ewbank } from "./scales/route/ewbank";

describe("French <-> YDS", () => {
  // These four are exact, given equivalences — ground truth.
  it.each([
    ["6a", "5.10a"],
    ["7a", "5.11d"],
    ["7c", "5.12d"],
    ["8a", "5.13b"],
    ["8b+", "5.14a"],
    ["9a", "5.14d"],
  ])("French %s <-> YDS %s", (frenchGrade, ydsGrade) => {
    expect(convertGrade(frenchGrade, french, yds)).toBe(ydsGrade);
    expect(convertGrade(ydsGrade, yds, french)).toBe(frenchGrade);
  });
});

describe("Fontainebleau (FB) <-> Hueco (V-scale)", () => {
  // These two are exact, given equivalences — ground truth.
  it.each([
    ["7C", "V9"],
    ["8A", "V11"],
    ["8C", "V15"],
    ["9A", "V17"],
  ])("FB %s <-> Hueco %s", (fbGrade, huecoGrade) => {
    expect(convertGrade(fbGrade, fb, hueco)).toBe(huecoGrade);
    expect(convertGrade(huecoGrade, hueco, fb)).toBe(fbGrade);
  });
});

describe("Ewbank <-> French", () => {
  // These two are exact, given equivalences — ground truth.
  it.each([
    ["18", "6a"],
    ["22", "7a"],
  ])("Ewbank %s <-> French %s", (ewbankGrade, frenchGrade) => {
    expect(convertGrade(ewbankGrade, ewbank, french)).toBe(frenchGrade);
    expect(convertGrade(frenchGrade, french, ewbank)).toBe(ewbankGrade);
  });
});
