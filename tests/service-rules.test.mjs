import test from "node:test";
import assert from "node:assert/strict";
import { SERVICE_RULES, validateServiceFields, getAllowedFields, stripDisallowedFields, getInquiryServiceType } from "../src/lib/serviceRules.ts";
import { costingSummary } from "../src/goldStock.ts";
for (const [type, expected] of Object.entries({ Repair: [true, true, true, true, 11100], Custom: [true, true, true, true, 11100], Resize: [true, false, true, true, 10600], Cleaning: [false, false, false, true, 1000] })) {
  test(`${type} fields and live summary follow the service contract`, () => {
    assert.deepEqual(Object.values(SERVICE_RULES[type]), expected.slice(0, 4));
    const [gold, stone, scrap, labor] = expected;
    const payload = { ...(gold ? { goldSourceId: "G", goldUsed: "1", goldCostPerG: 8000 } : {}), ...(stone ? { stoneCost: 500 } : {}), ...(scrap ? { goldScrap: ".2" } : {}), ...(labor ? { laborCost: 1000 } : {}) };
    assert.doesNotThrow(() => validateServiceFields(type, payload));
    const summary = costingSummary("1", ".2", "8000", "500", "1000", "15000", type);
    assert.equal(summary.total, expected[4]);
    assert.equal(summary.profit, 15000 - expected[4]);
  });
}

const expectedAllowed = {
  Repair: ['goldSourceId', 'goldUsed', 'goldCostPerG', 'goldScrap', 'stoneCost', 'laborCost', 'laborCharge'],
  Custom: ['goldSourceId', 'goldUsed', 'goldCostPerG', 'goldScrap', 'stoneCost', 'laborCost', 'laborCharge'],
  Resize: ['goldSourceId', 'goldUsed', 'goldCostPerG', 'goldScrap', 'laborCost', 'laborCharge'],
  Cleaning: ['laborCost', 'laborCharge'],
};
for (const [type, allowed] of Object.entries(expectedAllowed)) {
  test(`${type} lists allowed fields and clears only disabled fields without mutating the payload`, () => {
    const original = Object.freeze({ goldSourceId: 'GOLD-18K', goldUsed: '1.2', goldCostPerG: 8000, goldScrap: '0.2', stoneCost: 0, laborCost: 1000, laborCharge: 1500, sellingPrice: 15000, clientName: 'Mia' });
    assert.deepEqual(getAllowedFields(type).sort(), [...allowed].sort());
    const stripped = stripDisallowedFields(type, original);
    assert.notEqual(stripped, original);
    for (const key of expectedAllowed.Custom) assert.equal(stripped[key], allowed.includes(key) ? original[key] : null);
    assert.equal(stripped.sellingPrice, original.sellingPrice);
    assert.equal(stripped.clientName, original.clientName);
    assert.equal(original.goldUsed, '1.2');
    assert.deepEqual(stripDisallowedFields(type, stripped), stripped);
    const empty = stripDisallowedFields(type, {});
    for (const key of expectedAllowed.Custom) assert.equal(Object.hasOwn(empty, key), !allowed.includes(key));
    assert.deepEqual(getAllowedFields(type).sort(), [...allowed].sort());
  });
}
test('helpers reject unknown services instead of silently allowing fields', () => {
  for (const type of ['Other', '__proto__', undefined]) {
    assert.throws(() => getAllowedFields(type), error => error.statusCode === 400);
    assert.throws(() => stripDisallowedFields(type, {}), error => error.statusCode === 400);
  }
});

test('disallowed fields accept null or omission, but reject zero and every other supplied value', () => {
  for (const value of [0, "0", "", false, 100]) assert.throws(() => validateServiceFields("Cleaning", { stoneCost: value }), error => error.statusCode === 400);
  assert.doesNotThrow(() => validateServiceFields("Cleaning", { stoneCost: null, goldUsed: null, goldScrap: null, goldCostPerG: null, goldSourceId: null }));
});

test("inquiry API service type takes precedence over the legacy category name", () => {
  assert.equal(getInquiryServiceType({ serviceType: "Cleaning", category: "Custom" }), "Cleaning");
  assert.equal(getInquiryServiceType({ category: " resize " }), "Resize");
  assert.equal(getInquiryServiceType({ category: "Unknown" }), null);
});
