import test from "node:test";
import assert from "node:assert/strict";
import { calculateProgress, evaluateIndicatorFormula } from "./indicator-calculation.js";

test("calculates child weighted formula", () => {
  assert.equal(
    evaluateIndicatorFormula("child_1 * 0.9 + child_2 * 0.1", [
      { value: 80 },
      { value: 100 },
    ]),
    82,
  );
});

test("calculates sum(children)", () => {
  assert.equal(
    evaluateIndicatorFormula("sum(children)", [
      { value: 10 },
      { value: 20 },
      { value: 30 },
    ]),
    60,
  );
});

test("calculates avg(children)", () => {
  assert.equal(
    evaluateIndicatorFormula("avg(children)", [
      { value: 10 },
      { value: 20 },
      { value: 30 },
    ]),
    20,
  );
});

test("uses child weights when formula is empty", () => {
  assert.equal(
    evaluateIndicatorFormula(null, [
      { value: 50, weight: 0.7 },
      { value: 100, weight: 0.3 },
    ]),
    65,
  );
});

test("returns null when a child value is missing", () => {
  assert.equal(
    evaluateIndicatorFormula("sum(children)", [
      { value: 10 },
      { value: null },
    ]),
    null,
  );
});

test("does not treat explicit zero as missing", () => {
  assert.equal(
    evaluateIndicatorFormula("sum(children)", [
      { value: 0 },
      { value: 5 },
    ]),
    5,
  );
});

test("returns null progress for zero or missing target", () => {
  assert.equal(calculateProgress(100, 0), null);
  assert.equal(calculateProgress(100, null), null);
});
