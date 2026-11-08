# `packages/holy-grade` Agent Guidelines

`packages/holy-grade` is a zero-dependency climbing grade conversion and comparison library. It maps worldwide grading scales to continuous reference ranks to allow bidirectional conversions.

---

## 1. Core Architecture

### Reference Ranking System

- Each scale defines a `gradeMapping: Map<string, number>` pairing normalized grade strings to an integer reference rank.
- French sport grades and Fontainebleau boulder grades typically anchor the reference baseline.
- **Conversion Flow**:
  1. Retrieve reference rank from source scale using `scale.gradeMapping.get(grade)`.
  2. If exact rank is not present, interpolate between adjacent mapped grades.
  3. Locate the closest grade in target scale matching that reference rank.

### Supported Disciplines & Scales

| Discipline              | Scales                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Route**               | French (`french`), YDS (`yds`), Ewbank (`ewbank`), UIAA (`uiaa`), Saxon (`saxon`), Scandinavian (`scandinavian`), Polish (`polish`), UK Technical (`ukTech`) |
| **Bouldering**          | Fontainebleau (`fb`), Hueco / V-Scale (`hueco`)                                                                                                              |
| **Ice & Mixed**         | Water Ice (`wi`), Mixed (`mixed`), Dry Tooling (`dryTooling`)                                                                                                |
| **Aid**                 | Aid (`aid`)                                                                                                                                                  |
| **Danger / Protection** | YDS Danger (`ydsDanger`), UK Adjectival (`ukAdj`)                                                                                                            |

---

## 2. Uniqueness & Integrity Invariants

- **Strict Rank Ordering**: Within any single scale, distinct grades of different difficulty must never share identical ranks.
- **Test Invariant**: `src/grading.test.ts` validates that no scale contains duplicate ranks for non-equivalent grades. Run tests before committing modifications:
  ```bash
  bun test
  ```
- **Grade Parsing**: `parseGrade(text, scaleHint)` decomposes complex grade strings into primary grade, modifier, and danger ratings (e.g. `"5.11b R"` -> primary `"5.11b"`, danger `"R"`).

---

## 3. Scale Definition Pattern

When adding or tuning a scale:

1. Define the scale in `src/scales/<discipline>/<scale-name>.ts`.
2. Construct the scale using `createScale()` helper.
3. Export from `src/scales/index.ts` and root `src/index.ts`.
4. Add bidirectional unit tests in `src/grading.test.ts`.
5. Run `bun test` to guarantee monotonicity and unique rank constraints.
