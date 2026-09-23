import { describe, it, expect } from "vitest";
import { french, yds, fb, hueco, uiaa, saxon, convertGrade } from "./index";

describe("French <-> YDS", () => {
  // These four are exact, given equivalences — ground truth.
  it.each([
    ["6a", "5.10a"],
    ["7a", "5.11a"],
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
    ["8C", "V15"],
  ])("FB %s <-> Hueco %s", (fbGrade, huecoGrade) => {
    expect(convertGrade(fbGrade, fb, hueco)).toBe(huecoGrade);
    expect(convertGrade(huecoGrade, hueco, fb)).toBe(fbGrade);
  });
});

describe("French <-> UIAA / Saxon (best-effort — see equivalences.ts)", () => {
  // Less rigorously verified than the pairs above: these follow a commonly-cited comparison
  // chart, but conventions vary between sources, especially at harder grades.
  it.each([
    ["6a", "6-"],
    ["7a", "7"],
  ])("French %s <-> UIAA %s", (frenchGrade, uiaaGrade) => {
    expect(convertGrade(frenchGrade, french, uiaa)).toBe(uiaaGrade);
    expect(convertGrade(uiaaGrade, uiaa, french)).toBe(frenchGrade);
  });

  it.each([
    ["6a", "VIIb"],
    ["7a", "IXa"],
  ])("French %s <-> Saxon %s", (frenchGrade, saxonGrade) => {
    expect(convertGrade(frenchGrade, french, saxon)).toBe(saxonGrade);
    expect(convertGrade(saxonGrade, saxon, french)).toBe(frenchGrade);
  });
});
