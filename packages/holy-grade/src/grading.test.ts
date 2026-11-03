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
  ydsDanger,
  convertGrade,
  allScales,
  parseGrade,
  parseGradeWithDanger,
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

  it("includes 5.11a/b and 5.11b/c with unique ranks in YDS", () => {
    expect(yds.gradeMapping.has("5.11a/b")).toBe(true);
    expect(yds.gradeMapping.has("5.11b/c")).toBe(true);
    expect(yds.gradeMapping.get("5.11a")).toBe(69);
    expect(yds.gradeMapping.get("5.11a/b")).toBe(70);
    expect(yds.gradeMapping.get("5.11b")).toBe(71);
    expect(yds.gradeMapping.get("5.11b/c")).toBe(72);
    expect(yds.gradeMapping.get("5.11c")).toBe(73);
    expect(yds.gradeMapping.get("5.11c/d")).toBe(74);
    expect(yds.gradeMapping.get("5.11d")).toBe(75);
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

describe("UKAdj <-> YDSDanger", () => {
  it.each([
    ["D", "G"],
    ["VD", "G/PG"],
    ["HVS", "PG/PG-13"],
    ["E1", "PG-13"],
    ["E6", "R/X"],
    ["E9", "X"],
  ])("UKAdj %s <-> YDSDanger %s", (ukGrade, ydsDangerGrade) => {
    expect(convertGrade(ukGrade, ukAdj, ydsDanger)).toBe(ydsDangerGrade);
    expect(convertGrade(ydsDangerGrade, ydsDanger, ukAdj)).toBe(ukGrade);
  });

  it("handles alternate spellings for YDS Danger", () => {
    expect(convertGrade("PG13", ydsDanger, ukAdj)).toBe("E1");
    expect(convertGrade("RX", ydsDanger, ukAdj)).toBe("E6");
    expect(convertGrade("R-X", ydsDanger, ukAdj)).toBe("E6");
  });
});

describe("French <-> UK Technical", () => {
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
          const isYdsEquivalentPair = grades.every((g) => /5\.\d+[-+]?$/.test(g) || /5\.\d+[a-d](\/[a-d])?$/.test(g));
          expect(isYdsEquivalentPair).toBe(true);
        }
      }
    }
  });

  describe("parseGrade / parseGradeWithDanger", () => {
    it("parses UK trad grades with adjectival danger and technical difficulty", () => {
      expect(parseGrade("E1 5b")).toEqual({
        primary: { grade: "5b", scale: "UKTech" },
        danger: { grade: "E1", scale: "UKAdj" },
        raw: "E1 5b",
      });

      expect(parseGrade("5b E1")).toEqual({
        primary: { grade: "5b", scale: "UKTech" },
        danger: { grade: "E1", scale: "UKAdj" },
        raw: "5b E1",
      });

      expect(parseGrade("HVS 5a")).toEqual({
        primary: { grade: "5a", scale: "UKTech" },
        danger: { grade: "HVS", scale: "UKAdj" },
        raw: "HVS 5a",
      });

      expect(parseGrade("VS 4c")).toEqual({
        primary: { grade: "4c", scale: "UKTech" },
        danger: { grade: "VS", scale: "UKAdj" },
        raw: "VS 4c",
      });

      expect(parseGrade("E3 6a")).toEqual({
        primary: { grade: "6a", scale: "UKTech" },
        danger: { grade: "E3", scale: "UKAdj" },
        raw: "E3 6a",
      });

      expect(parseGrade("E1/5b")).toEqual({
        primary: { grade: "5b", scale: "UKTech" },
        danger: { grade: "E1", scale: "UKAdj" },
        raw: "E1/5b",
      });
    });

    it("parses YDS grades with protection/danger ratings", () => {
      expect(parseGrade("5.10a R")).toEqual({
        primary: { grade: "5.10a", scale: "YDS" },
        danger: { grade: "R", scale: "YDSDanger" },
        raw: "5.10a R",
      });

      expect(parseGrade("5.11b PG-13")).toEqual({
        primary: { grade: "5.11b", scale: "YDS" },
        danger: { grade: "PG-13", scale: "YDSDanger" },
        raw: "5.11b PG-13",
      });

      expect(parseGrade("5.11b PG13")).toEqual({
        primary: { grade: "5.11b", scale: "YDS" },
        danger: { grade: "PG-13", scale: "YDSDanger" },
        raw: "5.11b PG13",
      });

      expect(parseGrade("5.12c X")).toEqual({
        primary: { grade: "5.12c", scale: "YDS" },
        danger: { grade: "X", scale: "YDSDanger" },
        raw: "5.12c X",
      });

      expect(parseGrade("5.10d R/X")).toEqual({
        primary: { grade: "5.10d", scale: "YDS" },
        danger: { grade: "R/X", scale: "YDSDanger" },
        raw: "5.10d R/X",
      });

      expect(parseGrade("5.10a (PG-13)")).toEqual({
        primary: { grade: "5.10a", scale: "YDS" },
        danger: { grade: "PG-13", scale: "YDSDanger" },
        raw: "5.10a (PG-13)",
      });

      expect(parseGrade("5.10a, R")).toEqual({
        primary: { grade: "5.10a", scale: "YDS" },
        danger: { grade: "R", scale: "YDSDanger" },
        raw: "5.10a, R",
      });

      expect(parseGrade("5.10a/R")).toEqual({
        primary: { grade: "5.10a", scale: "YDS" },
        danger: { grade: "R", scale: "YDSDanger" },
        raw: "5.10a/R",
      });
    });

    it("parses bouldering and ice grades with danger ratings", () => {
      expect(parseGrade("V7 X")).toEqual({
        primary: { grade: "V7", scale: "Hueco" },
        danger: { grade: "X", scale: "YDSDanger" },
        raw: "V7 X",
      });

      expect(parseGrade("7A R")).toEqual({
        primary: { grade: "7A", scale: "FB" },
        danger: { grade: "R", scale: "YDSDanger" },
        raw: "7A R",
      });

      expect(parseGrade("WI5 R")).toEqual({
        primary: { grade: "WI5", scale: "WI" },
        danger: { grade: "R", scale: "YDSDanger" },
        raw: "WI5 R",
      });

      expect(parseGrade("M8 X")).toEqual({
        primary: { grade: "M8", scale: "Mixed" },
        danger: { grade: "X", scale: "YDSDanger" },
        raw: "M8 X",
      });
    });

    it("parses standalone danger and standalone primary grades", () => {
      expect(parseGrade("E2")).toEqual({
        danger: { grade: "E2", scale: "UKAdj" },
        raw: "E2",
      });

      expect(parseGrade("PG-13")).toEqual({
        danger: { grade: "PG-13", scale: "YDSDanger" },
        raw: "PG-13",
      });

      expect(parseGrade("6a")).toEqual({
        primary: { grade: "6a", scale: "French" },
        raw: "6a",
      });

      expect(parseGrade("5.10a")).toEqual({
        primary: { grade: "5.10a", scale: "YDS" },
        raw: "5.10a",
      });
    });

    it("supports scaleHint parameter", () => {
      expect(parseGrade("6a", "French")?.primary?.scale).toBe("French");
      expect(parseGrade("5b", "UKTech")?.primary?.scale).toBe("UKTech");
      expect(parseGrade("5b", "French")?.primary?.scale).toBe("French");
    });

    it("returns undefined for invalid strings", () => {
      expect(parseGrade("")).toBeUndefined();
      expect(parseGrade("not a grade")).toBeUndefined();
    });

    it("parseGradeWithDanger is an alias for parseGrade", () => {
      expect(parseGradeWithDanger("E1 5b")).toEqual(parseGrade("E1 5b"));
    });
  });
});
