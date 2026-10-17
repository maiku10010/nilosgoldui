import test from "node:test";
import assert from "node:assert/strict";
import { SERVICE_RULES, validateServiceFields } from "../src/lib/serviceRules.ts";
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
