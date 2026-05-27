// 공스장 — 최소 동작 시드 (도시공원 그대로)
// 철봉 판별/bbox/우선순위/큐레이션 전부 비활성화.
// parkNm + latitude + longitude 만으로 locations seed 생성.
//
// 사용:   node --env-file=.env.local scripts/build-parks-demo.mjs
// 출력:   supabase/seeds/parks-demo.json
// import: node --env-file=.env.local scripts/import-seeds.mjs supabase/seeds/parks-demo.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const RAW = "supabase/raw/cheongju-parks.json";
const OUT = "supabase/seeds/parks-demo.json";
// limit: 기본 전국 전체. PARKS_LIMIT 환경변수로 조절 (예: PARKS_LIMIT=500)
const LIMIT =
  process.env.PARKS_LIMIT && process.env.PARKS_LIMIT !== "all"
    ? Number(process.env.PARKS_LIMIT)
    : Infinity;

const asNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

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

const seeds = [];
let skipNoName = 0;
let skipNoCoord = 0;
let dupId = 0;
const seenId = new Set();

for (const p of raw) {
  const name = (p.parkNm || p.parkNmKor || "").trim();
  if (!name) { skipNoName++; continue; }

  const lat = asNum(p.latitude);
  const lng = asNum(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipNoCoord++; continue; }

  // mvmFclty(운동시설) 있으면 description 에
  const mvm = (p.mvmFclty || "").trim();
  const description =
    mvm && mvm !== "없음" && mvm !== "-"
      ? `운동시설: ${mvm}`.slice(0, 200)
      : null;

  const address = (p.rdnmadr || p.lnmadr || "").trim() || null;
  let externalId = p.manageNo
    ? `park:${p.manageNo}`
    : `park:${lat.toFixed(5)},${lng.toFixed(5)}`;

  // external_id 중복 제거 — 충돌 시 좌표+이름으로 고유화, 그래도 충돌이면 스킵
  if (seenId.has(externalId)) {
    externalId = `park:${lat.toFixed(6)},${lng.toFixed(6)}:${name}`;
    if (seenId.has(externalId)) { dupId++; continue; }
  }
  seenId.add(externalId);

  seeds.push({
    external_id: externalId,
    source: "public_data",
    name,
    address,
    description,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    verified: false,
  });

  if (seeds.length >= LIMIT) break;
}

mkdirSync("supabase/seeds", { recursive: true });
writeFileSync(OUT, JSON.stringify(seeds, null, 2));

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  parks-demo 빌드 (최소 동작 시드)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  원본 공원        ${raw.length}`);
console.log(`  이름 없음 제외   ${skipNoName}`);
console.log(`  좌표 무효 제외   ${skipNoCoord}`);
console.log(`  ID 중복 제외     ${dupId}`);
console.log(`  생성 시드        ${seeds.length}  (limit ${LIMIT === Infinity ? "전체" : LIMIT})`);
console.log(`  → ${OUT}`);

console.log("\n  샘플 5개:");
seeds.slice(0, 5).forEach((s) => {
  const line = `    ${s.name.padEnd(22)} ${s.lat},${s.lng}  ${s.description ?? ""}`;
  console.log(line.slice(0, 100));
});

console.log(
  `\n  import 예상: 최대 ${seeds.length}건 ` +
    `(이미 들어간 external_id / 30m 이내 좌표는 자동 스킵)`,
);
console.log("\n  다음: npm run seed:import:parks");
