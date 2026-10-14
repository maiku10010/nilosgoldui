import assert from "node:assert/strict";
import test from "node:test";
import { approvalChanges, approvalFieldLabel, approvalValue } from "../src/approvalDiff.ts";

test("turns database keys into readable field labels", () => {
  assert.equal(approvalFieldLabel("quotedPrice"), "Quoted Price");
  assert.equal(approvalFieldLabel("isFullyPaid"), "Fully Paid");
  assert.equal(approvalFieldLabel("service_type"), "Service Type");
});

test("returns only requested fields whose values changed", () => {
  assert.deepEqual(
    approvalChanges(
      { details: "Test", quotedPrice: 5000, isFullyPaid: false, untouched: "keep" },
      { details: "Test Edit", quotedPrice: 5000, isFullyPaid: true },
    ),
    [
      { key: "details", label: "Details", initialValue: "Test", editedValue: "Test Edit" },
      { key: "isFullyPaid", label: "Fully Paid", initialValue: false, editedValue: true },
    ],
  );
});

test("formats approval values for people instead of dumping JSON", () => {
  assert.equal(approvalValue("Test"), "“Test”");
  assert.equal(approvalValue(false), "No");
  assert.equal(approvalValue(null), "Not set");
  assert.equal(approvalValue(["Gold", "Silver"]), "“Gold”, “Silver”");
});
