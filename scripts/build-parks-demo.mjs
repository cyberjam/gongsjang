// 공스장 — 도시공원 시드 (전국)
// 공원은 철봉 판별 없이 장소(스테이지)로 그대로 시드. parkNm + 좌표만 사용.
//
// 좌표 예외 복구 (eqmt 와 동일 정책):
//   1) recoverCoords 스왑/범위 오프라인 교정 (한국 밖 제외)
//   2) 좌표 없으면 주소 → 카카오 지오코딩 (KAKAO_REST_API_KEY 있을 때)
// dedup: manageNo 우선(없으면 이름+주소 해시) → 좌표 무관 안정 external_id.
//
// 사용:   node --env-file=.env.local scripts/build-parks-demo.mjs
// 출력:   supabase/seeds/parks-demo.json
// import: node --env-file=.env.local scripts/import-seeds.mjs parks

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { recoverCoords } from "./lib/cheongju.mjs";
import { createGeocoder } from "./lib/geocode.mjs";

const RAW = "supabase/raw/cheongju-parks.json";
const OUT = "supabase/seeds/parks-demo.json";
const DROPPED = "supabase/raw/parks-dropped.json";
const LIMIT =
  process.env.PARKS_LIMIT && process.env.PARKS_LIMIT !== "all"
    ? Number(process.env.PARKS_LIMIT)
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
    "⚠️  KAKAO_REST_API_KEY 없음 — 좌표 없는 공원은 제외됩니다(parks-dropped.json).\n",
  );
}

const seeds = [];
const seenId = new Set();
let skipNoName = 0;
let dupId = 0;
let coordSwapped = 0;
let coordGeocoded = 0;
const dropped = [];

for (const p of raw) {
  const name = (p.parkNm || p.parkNmKor || "").trim();
  if (!name) {
    skipNoName++;
    continue;
  }

  const rdnmadr = (p.rdnmadr || "").trim() || null;
  const lnmadr = (p.lnmadr || "").trim() || null;
  const address = rdnmadr || lnmadr;

  // 좌표 복구 → 실패 시 지오코딩
  let coords = recoverCoords(p.latitude, p.longitude);
  if (coords?.fixed === "swap") coordSwapped++;
  if (!coords) {
    const geo = await geocoder.geocode(rdnmadr, lnmadr);
    if (geo) {
      coords = { lat: geo.lat, lng: geo.lng };
      coordGeocoded++;
    } else {
      dropped.push({
        reason: geocoder.enabled ? "no_coord_geocode_failed" : "no_coord_no_key",
        name,
        addr: address,
      });
      continue;
    }
  }

  const lat = Number(coords.lat.toFixed(6));
  const lng = Number(coords.lng.toFixed(6));

  // mvmFclty(운동시설) 있으면 description 에
  const mvm = (p.mvmFclty || "").trim();
  const description =
    mvm && mvm !== "없음" && mvm !== "-" ? `운동시설: ${mvm}`.slice(0, 200) : null;

  // 좌표 무관 안정 external_id: manageNo 우선, 없으면 이름+주소 해시
  let externalId;
  if (p.manageNo != null && String(p.manageNo).trim()) {
    externalId = `park:${String(p.manageNo).trim()}`;
  } else {
    const h = createHash("sha1")
      .update([name, rdnmadr, lnmadr].map((s) => s ?? "").join("|"))
      .digest("hex")
      .slice(0, 16);
    externalId = `park:h:${h}`;
  }
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
console.log("  parks-demo 빌드 (도시공원, 전국)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  원본 공원        ${raw.length}`);
console.log(`  이름 없음 제외   ${skipNoName}`);
console.log(`  좌표 스왑 교정   ${coordSwapped}`);
console.log(`  지오코딩 복구    ${coordGeocoded}  (캐시히트 ${gs.hits}/API성공 ${gs.apiOk}/실패 ${gs.apiMiss})`);
console.log(`  ID 중복 제외     ${dupId}`);
console.log(`  좌표 못 살림     ${dropped.length}  → ${DROPPED}`);
console.log(`  생성 시드        ${seeds.length}  (limit ${LIMIT === Infinity ? "전체" : LIMIT})`);
console.log(`  → ${OUT}`);

console.log("\n  샘플 5개:");
seeds.slice(0, 5).forEach((s) => {
  const line = `    ${s.name.padEnd(22)} ${s.lat},${s.lng}  ${s.description ?? ""}`;
  console.log(line.slice(0, 100));
});

console.log("\n  다음: npm run seed:import parks");
