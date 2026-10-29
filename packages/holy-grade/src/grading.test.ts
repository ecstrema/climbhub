import { describe, it, expect } from "vitest";
import {
  french,
  yds,
  fb,
  hueco,
  uiaa,
  saxon,
  ewbank,
  scandinavian,
  polish,
  ukTech,
  ukAdj,
  frenchBritish,
  convertGrade,
  allScales,
} from "./index";

describe("French <-> YDS", () => {
  // Ground truth equivalences across the difficulty spectrum.
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

  it("handles equivalent +/- notations in YDS", () => {
    expect(convertGrade("5.12+", yds, french)).toBe("7b+/c");
    expect(convertGrade("5.12c/d", yds, french)).toBe("7b+/c");
    expect(convertGrade("5.12+", yds, yds)).toBe("5.12c/d");
  });
});

describe("Fontainebleau (FB) <-> Hueco (V-scale)", () => {
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
  it.each([
    ["18", "6a"],
    ["22", "7a"],
    ["27", "7c"],
    ["29", "8a"],
    ["32", "8b+"],
    ["35", "9a"],
  ])("Ewbank %s <-> French %s", (ewbankGrade, frenchGrade) => {
    expect(convertGrade(ewbankGrade, ewbank, french)).toBe(frenchGrade);
    expect(convertGrade(frenchGrade, french, ewbank)).toBe(ewbankGrade);
  });
});

describe("French <-> UIAA", () => {
  it.each([
    ["6a", "6-"],
    ["7a", "7"],
    ["7c", "8+"],
    ["8a", "9"],
    ["8b+", "10"],
    ["9a", "11"],
  ])("French %s <-> UIAA %s", (frenchGrade, uiaaGrade) => {
    expect(convertGrade(frenchGrade, french, uiaa)).toBe(uiaaGrade);
    expect(convertGrade(uiaaGrade, uiaa, french)).toBe(frenchGrade);
  });

  it("handles Roman numerals via alternate names", () => {
    expect(convertGrade("VI-", uiaa, french)).toBe("6a");
    expect(convertGrade("VII", uiaa, french)).toBe("7a");
    expect(convertGrade("XI", uiaa, french)).toBe("9a");
  });
});

describe("French <-> Saxon", () => {
  it.each([
    ["6a", "VIIb"],
    ["7a", "IXa"],
    ["7c", "Xb"],
    ["8a", "XIa"],
    ["8b+", "XIc"],
    ["9a", "XIIc"],
  ])("French %s <-> Saxon %s", (frenchGrade, saxonGrade) => {
    expect(convertGrade(frenchGrade, french, saxon)).toBe(saxonGrade);
    expect(convertGrade(saxonGrade, saxon, french)).toBe(frenchGrade);
  });
});

describe("French <-> Scandinavian", () => {
  it.each([
    ["6a", "6-"],
    ["7a", "7+"],
    ["7c", "8+"],
    ["8a", "9-"],
    ["8b+", "9+"],
    ["9a", "10"],
  ])("French %s <-> Scandinavian %s", (frenchGrade, scandGrade) => {
    expect(convertGrade(frenchGrade, french, scandinavian)).toBe(scandGrade);
    expect(convertGrade(scandGrade, scandinavian, french)).toBe(frenchGrade);
  });
});

describe("French <-> Polish", () => {
  it.each([
    ["6a", "VI-"],
    ["7a", "VI.3"],
    ["7c", "VI.4+"],
    ["8a", "VI.5+"],
    ["8b+", "VI.6+"],
    ["9a", "VI.8"],
  ])("French %s <-> Polish %s", (frenchGrade, polishGrade) => {
    expect(convertGrade(frenchGrade, french, polish)).toBe(polishGrade);
    expect(convertGrade(polishGrade, polish, french)).toBe(frenchGrade);
  });
});

describe("French <-> FrenchBritish", () => {
  it.each([
    ["6a", "6a"],
    ["7a", "7a"],
    ["7c", "7c"],
    ["8a", "8a"],
    ["8b+", "8b+"],
    ["9a", "9a"],
  ])("French %s <-> FrenchBritish %s", (frenchGrade, fbGrade) => {
    expect(convertGrade(frenchGrade, french, frenchBritish)).toBe(fbGrade);
    expect(convertGrade(fbGrade, frenchBritish, french)).toBe(frenchGrade);
  });
});

describe("French <-> UK Technical / Adjectival", () => {
  it.each([
    ["6a+", "5b"],
    ["6b+", "5c"],
    ["7a", "6a"],
    ["7b", "6b"],
    ["7c+", "6c"],
    ["8a+", "7a"],
    ["8c", "7b"],
  ])("French %s <-> UKTech %s", (frenchGrade, ukTechGrade) => {
    expect(convertGrade(frenchGrade, french, ukTech)).toBe(ukTechGrade);
    expect(convertGrade(ukTechGrade, ukTech, french)).toBe(frenchGrade);
  });

  it.each([
    ["6a", "E1"],
    ["6b", "E2"],
    ["6c", "E3"],
    ["7a", "E4"],
    ["7c", "E6"],
    ["8a", "E7"],
    ["9a", "E10"],
  ])("French %s <-> UKAdj %s", (frenchGrade, ukAdjGrade) => {
    expect(convertGrade(frenchGrade, french, ukAdj)).toBe(ukAdjGrade);
    expect(convertGrade(ukAdjGrade, ukAdj, french)).toBe(frenchGrade);
  });
});

describe("Grade mapping uniqueness rule", () => {
  it("ensures no non-equivalent grades share the same rank in any scale", () => {
    for (const scale of allScales) {
      const rankToGrades = new Map<number, string[]>();
      for (const [grade, rank] of scale.gradeMapping) {
        if (!rankToGrades.has(rank)) rankToGrades.set(rank, []);
        rankToGrades.get(rank)!.push(grade);
      }
      for (const [rank, grades] of rankToGrades) {
        if (grades.length > 1) {
          // If grades share a rank, they MUST be equivalent notations in YDS
          expect(scale.id).toBe("YDS");
          const isYdsEquivalentPair = grades.every(
            (g) =>
              /5\.\d+[-+]?$/.test(g) ||
              /5\.\d+[a-d](\/[a-d])?$/.test(g)
          );
          expect(isYdsEquivalentPair).toBe(true);
        }
      }
    }
  });
});
