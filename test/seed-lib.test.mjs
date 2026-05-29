// 공스장 — 시드 라이브러리 단위 테스트 (Node 내장 test runner, 의존성 0)
// 실행:  npm test   (= node --test)

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  recoverCoords,
  matchesPullup,
  eqmtStableId,
  normalizeEqmt,
  inKorea,
} from "../scripts/lib/cheongju.mjs";
import { createGeocoder } from "../scripts/lib/geocode.mjs";

test("recoverCoords: 정상 좌표는 그대로", () => {
  assert.deepEqual(recoverCoords("36.64", "127.48"), {
    lat: 36.64,
    lng: 127.48,
    fixed: "ok",
  });
});

test("recoverCoords: lat/lng 뒤바뀐 행은 스왑 교정", () => {
  // 위도 칸에 경도값(127.48), 경도 칸에 위도값(36.64)
  assert.deepEqual(recoverCoords("127.48", "36.64"), {
    lat: 36.64,
    lng: 127.48,
    fixed: "swap",
  });
});

test("recoverCoords: 0,0 / 결측 / 범위이탈은 null", () => {
  assert.equal(recoverCoords("0", "0"), null);
  assert.equal(recoverCoords("", ""), null);
  assert.equal(recoverCoords("99", "200"), null);
});

test("inKorea: 한국 bbox 판정", () => {
  assert.equal(inKorea(36.64, 127.48), true); // 청주
  assert.equal(inKorea(33.5, 126.5), true); // 제주
  assert.equal(inKorea(40, 127), false); // 북측 범위 밖
});

test("matchesPullup: 철봉류는 통과", () => {
  for (const n of ["철봉", "철봉 및 평행봉", "턱걸이", "친업", "허리돌리기+사이클+철봉"]) {
    assert.equal(matchesPullup(n), true, n);
  }
});

test("matchesPullup: 비철봉은 엄격 제외", () => {
  // 실제 data.go.kr 표본 포함: "허리돌리기+사이클+거꾸로매달리기"
  for (const n of [
    "허리돌리기+사이클+거꾸로매달리기",
    "거꾸로매달리기",
    "가로하늘타기",
    "윗몸일으키기",
    "사이클",
  ]) {
    assert.equal(matchesPullup(n), false, n);
  }
});

test("eqmtStableId: 좌표가 달라도 동일 장소면 같은 ID (지오코딩 안정성)", () => {
  const base = {
    sprtgdNm: "철봉",
    lctnRoadNmAddr: "충북 청주시 A로 1",
    instlPlcNm: "가경공원",
  };
  const a = { ...base, lat: "36.6", lot: "127.4" };
  const b = { ...base, lat: "99", lot: "99" }; // 좌표만 다름(지오코딩 전후)
  assert.equal(eqmtStableId(a, normalizeEqmt(a)), eqmtStableId(b, normalizeEqmt(b)));
});

test("eqmtStableId: 관리번호 있으면 우선 사용", () => {
  const r = { sprtgdNm: "철봉", manageNo: "ABC-123" };
  assert.equal(eqmtStableId(r, normalizeEqmt(r)), "eqmt:mng:ABC-123");
});

test("createGeocoder: REST 키 없으면 비활성·null (오프라인 안전)", async () => {
  const g = createGeocoder({});
  assert.equal(g.enabled, false);
  assert.equal(await g.geocode("충북 청주시 어딘가"), null);
});
