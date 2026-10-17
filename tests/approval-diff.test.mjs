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

test("treats empty and not-set values as unchanged", () => {
  assert.deepEqual(approvalChanges({ email: null }, { email: "Not set", contact: null }), []);
});

test("reads sale client before-values from the included client snapshot", () => {
  const changes = approvalChanges(
    { invoiceId: "SALE-1", client: { clientName: "Mia Santos", contactNum: "09123456789", email: "mia@example.com" } },
    { clientName: "Mia Cruz", contactNum: "09987654321", email: "mia@example.com" },
  );
  assert.deepEqual(changes.map(({ key, initialValue }) => [key, initialValue]), [
    ["clientName", "Mia Santos"],
    ["contactNum", "09123456789"],
  ]);
});

test("formats approval values for people instead of dumping JSON", () => {
  assert.equal(approvalValue("Test"), "Test");
  assert.equal(approvalValue(false), "No");
  assert.equal(approvalValue(null), "—");
  assert.equal(approvalValue(undefined), "—");
  assert.equal(approvalValue(["Gold", "Silver"]), "Gold, Silver");
  assert.equal(approvalValue(6105, "quotedPrice"), "₱6,105.00");
  assert.equal(approvalValue("6100", "quotedPrice"), "₱6,100.00");
  assert.equal(approvalValue("2026-10-10T00:00:00.000Z", "expDate"), "Oct 10, 2026");
});
