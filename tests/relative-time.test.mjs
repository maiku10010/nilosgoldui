import assert from "node:assert/strict";
import test from "node:test";
import { relativeTime } from "../src/relativeTime.ts";

test("relative time uses singular and plural units, including dates older than a week", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  const ago = seconds => new Date(now - seconds * 1000).toISOString();
  for (const [seconds, label] of [[0, "Just now"], [60, "1 minute ago"], [120, "2 minutes ago"], [3600, "1 hour ago"], [7200, "2 hours ago"], [86400, "1 day ago"], [172800, "2 days ago"], [864000, "10 days ago"]]) {
    assert.equal(relativeTime(ago(seconds), now), label);
  }
  assert.equal(relativeTime("invalid", now), "—");
});
