// 칭호 매핑 단위 테스트 (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { titleForDays, nextTitle } from "../lib/titles.ts";

test("titleForDays: 방문일 구간별 칭호", () => {
  assert.equal(titleForDays(0), "철린이");
  assert.equal(titleForDays(6), "철린이");
  assert.equal(titleForDays(7), "동네 순찰자");
  assert.equal(titleForDays(29), "동네 순찰자");
  assert.equal(titleForDays(30), "철봉 헌터");
  assert.equal(titleForDays(99), "철봉 헌터");
  assert.equal(titleForDays(100), "청주시 철왕");
  assert.equal(titleForDays(9999), "청주시 철왕");
});

test("nextTitle: 다음 칭호까지 남은 방문일", () => {
  assert.deepEqual(nextTitle(0), { name: "동네 순찰자", remaining: 7 });
  assert.deepEqual(nextTitle(7), { name: "철봉 헌터", remaining: 23 });
  assert.equal(nextTitle(100), null);
});
