// 공스장 — 실외운동기구 → 철봉 시드 (전국)
//
// 정책 (Q&A 확정):
//   - 철봉 판별: 엄격(정밀도 우선). matchesPullup 토큰 매칭으로
//     철봉/턱걸이/풀업/친업/현수/매달리기만, 거꾸리·하늘타기·윗몸·사이클 등 제외.
//   - 좌표 예외 복구:
//       1) recoverCoords 로 스왑/범위 오프라인 교정 (한국 밖은 제외)
//       2) 그래도 좌표 없으면 주소 → 카카오 지오코딩 (KAKAO_REST_API_KEY 있을 때)
//   - dedup: 좌표 무관 안정 external_id(eqmtStableId) → 재실행/갱신 시 중복 방지.
//   - 제외된 행은 supabase/raw/eqmt-dropped.json 에 사유와 함께 기록(감사용).
//
// 사용:   node --env-file=.env.local scripts/build-eqmt-demo.mjs
// 출력:   supabase/seeds/eqmt-demo.json
// import: node --env-file=.env.local scripts/import-seeds.mjs eqmt

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  normalizeEqmt,
  matchesPullup,
  recoverCoords,
  eqmtStableId,
} from "./lib/cheongju.mjs";
import { createGeocoder } from "./lib/geocode.mjs";

const RAW = "supabase/raw/cheongju-eqmt.json";
const OUT = "supabase/seeds/eqmt-demo.json";
const DROPPED = "supabase/raw/eqmt-dropped.json";
const LIMIT =
  process.env.EQMT_LIMIT && process.env.EQMT_LIMIT !== "all"
    ? Number(process.env.EQMT_LIMIT)
    : Infinity;

let raw;
try {
  raw = JSON.parse(readFileSync(RAW, "utf8"));
} catch {
  console.error(`❌ ${RAW} 없음. 먼저 'npm run seed:fetch' 실행.`);
  process.exit(1);
}
if (!Array.isArray(raw) || raw.length === 0) {
  console.error(`❌ ${RAW} 비어있음 (${raw?.length ?? 0}건).`);
  process.exit(2);
}

const geocoder = createGeocoder({ restKey: process.env.KAKAO_REST_API_KEY });
if (!geocoder.enabled) {
  console.warn(
    "⚠️  KAKAO_REST_API_KEY 없음 — 주소 지오코딩 비활성화.\n" +
      "    좌표 결측/범위이탈 행은 제외됩니다(eqmt-dropped.json 에 기록).\n" +
      "    전부 살리려면 .env.local 에 KAKAO_REST_API_KEY(REST 키) 추가 후 재실행.\n",
  );
}

const seeds = [];
const seenId = new Set();
let skipKeyword = 0;
let dupId = 0;
let coordSwapped = 0;
let coordGeocoded = 0;
const dropped = []; // { reason, name, eqmt, addr }

for (const r of raw) {
  const e = normalizeEqmt(r);
  const eqmtNm = (e.exrcEqmtNm || "").trim();

  // 1) 엄격 철봉 매칭
  if (!matchesPullup(eqmtNm)) {
    skipKeyword++;
    continue;
  }

  const address = (e.rdnmadr || e.lnmadr || "").trim() || null;

  // 2) 좌표 복구 — 오프라인(스왑/범위) → 실패 시 지오코딩
  let coords = recoverCoords(e.latitude, e.longitude);
  if (coords?.fixed === "swap") coordSwapped++;
  if (!coords) {
    const geo = await geocoder.geocode(e.rdnmadr, e.lnmadr);
    if (geo) {
      coords = { lat: geo.lat, lng: geo.lng, fixed: "geocode" };
      coordGeocoded++;
    } else {
      dropped.push({
        reason: geocoder.enabled ? "no_coord_geocode_failed" : "no_coord_no_key",
        name: eqmtNm,
        addr: address,
      });
      continue;
    }
  }

  const lat = Number(coords.lat.toFixed(6));
  const lng = Number(coords.lng.toFixed(6));

  // 3) 이름: 설치장소명 → fallback "동네 철봉"
  const place = (e.instlPlaceNm || "").trim();
  const name = place && place !== "운동기구" ? `${place} 철봉` : "동네 철봉";
  const description = eqmtNm.slice(0, 200);

  // 4) 좌표 무관 안정 external_id
  const externalId = eqmtStableId(r, e);
  if (seenId.has(externalId)) {
    dupId++;
    continue;
  }
  seenId.add(externalId);

  seeds.push({
    external_id: externalId,
    source: "public_data",
    name,
    address,
    description,
    lat,
    lng,
    verified: false,
  });

  if (seeds.length >= LIMIT) break;
}

geocoder.flush();

mkdirSync("supabase/seeds", { recursive: true });
writeFileSync(OUT, JSON.stringify(seeds, null, 2));
writeFileSync(DROPPED, JSON.stringify(dropped, null, 2));

const gs = geocoder.stats();
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  eqmt-demo 빌드 (실외운동기구 → 철봉, 전국)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  원본 운동기구    ${raw.length}`);
console.log(`  철봉 아님 제외   ${skipKeyword}  (엄격 matchesPullup)`);
console.log(`  좌표 스왑 교정   ${coordSwapped}`);
console.log(`  지오코딩 복구    ${coordGeocoded}  (캐시히트 ${gs.hits}/API성공 ${gs.apiOk}/실패 ${gs.apiMiss})`);
console.log(`  ID 중복 제외     ${dupId}`);
console.log(`  좌표 못 살림     ${dropped.length}  → ${DROPPED}`);
console.log(`  생성 시드        ${seeds.length}  (limit ${LIMIT === Infinity ? "전체" : LIMIT})`);
console.log(`  → ${OUT}`);

console.log("\n  샘플 5건:");
seeds.slice(0, 5).forEach((s) => {
  const line = `    ${s.name.padEnd(20)} ${s.lat},${s.lng}  ${s.description}`;
  console.log(line.slice(0, 100));
});

if (seeds.length === 0) {
  console.log("\n  ⚠️  0건 — 철봉 매칭 실패. 운동기구명 표본 확인:");
  raw.slice(0, 10).forEach((r) => console.log(`    ${normalizeEqmt(r).exrcEqmtNm}`));
} else {
  console.log("\n  다음: npm run seed:import eqmt");
}
