import assert from "node:assert/strict";
import test from "node:test";
import { cleanMoneyInput, formatMoneyInput, salePaymentSummary } from "../src/moneyInput.ts";

test("peso fields parse pasted currency, format thousands, and preserve partial decimal typing", () => {
  assert.equal(cleanMoneyInput("₱15,000.00"), "15000.00");
  assert.equal(cleanMoneyInput("15."), "15.");
  assert.equal(cleanMoneyInput(""), "");
  assert.equal(cleanMoneyInput("-5"), null);
  assert.equal(cleanMoneyInput("1e6"), null);
  assert.equal(cleanMoneyInput("1.001"), null);
  assert.equal(formatMoneyInput("15000"), "15,000.00");
});

test("live balance uses cents and rejects overpayment while allowing an unpaid or fully paid sale", () => {
  assert.deepEqual(salePaymentSummary("25000", "10000"), { valid: true, paymentError: "", balance: 15000 });
  assert.deepEqual(salePaymentSummary("0.30", "0.10"), { valid: true, paymentError: "", balance: .2 });
  assert.equal(salePaymentSummary("25000", "25000").balance, 0);
  assert.equal(salePaymentSummary("25000", "").balance, 25000);
  assert.equal(salePaymentSummary("25000", "25000.01").valid, false);
  assert.match(salePaymentSummary("25000", "25000.01").paymentError, /exceed/);
  assert.equal(salePaymentSummary("", "0").valid, false);
});
