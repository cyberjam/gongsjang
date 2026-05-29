// 칭호 매핑 단위 테스트 (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { titleForDays, nextTitle } from "../lib/titles.ts";

test("titleForDays: 방문일 구간별 칭호", () => {
  assert.equal(titleForDays(0), "수련생");
  assert.equal(titleForDays(6), "수련생");
  assert.equal(titleForDays(7), "입문무사");
  assert.equal(titleForDays(29), "입문무사");
  assert.equal(titleForDays(30), "하급고수");
  assert.equal(titleForDays(90), "절정고수");
  assert.equal(titleForDays(180), "무림지존");
  assert.equal(titleForDays(9999), "무림지존");
});

test("nextTitle: 다음 칭호까지 남은 방문일", () => {
  assert.deepEqual(nextTitle(0), { name: "입문무사", remaining: 7 });
  assert.deepEqual(nextTitle(7), { name: "하급고수", remaining: 23 });
  assert.equal(nextTitle(180), null);
});
