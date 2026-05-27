// 공스장 — 실외운동기구 최소 동작 시드 (eqmt-demo)
// 철봉 판별 고도화/bbox/우선순위 전부 비활성화. 키워드만 완화 적용.
//
// 사용:   node --env-file=.env.local scripts/build-eqmt-demo.mjs
// 출력:   supabase/seeds/eqmt-demo.json
// import: node --env-file=.env.local scripts/import-seeds.mjs supabase/seeds/eqmt-demo.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { normalizeEqmt } from "./lib/cheongju.mjs";

const RAW = "supabase/raw/cheongju-eqmt.json";
const OUT = "supabase/seeds/eqmt-demo.json";
const LIMIT =
  process.env.EQMT_LIMIT && process.env.EQMT_LIMIT !== "all"
    ? Number(process.env.EQMT_LIMIT)
    : Infinity;

// 완화된 철봉 키워드 — sprtgdNm 전체 문자열에 포함되면 허용
const KEYWORDS = ["철봉", "턱걸이", "하늘타기", "가로하늘타기", "현수", "풀업", "매달리기"];

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
const seenId = new Set();
let skipKeyword = 0;
let skipCoord = 0;
let dupId = 0;

for (const r of raw) {
  const e = normalizeEqmt(r);

  const eqmtNm = (e.exrcEqmtNm || "").trim();
  if (!KEYWORDS.some((k) => eqmtNm.includes(k))) { skipKeyword++; continue; }

  const lat = asNum(e.latitude);
  const lng = asNum(e.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipCoord++; continue; }

  // 이름: 설치장소명 → fallback "철봉"
  const place = (e.instlPlaceNm || "").trim();
  const name = place && place !== "운동기구" ? `${place} 철봉` : "동네 철봉";

  const address = (e.rdnmadr || e.lnmadr || "").trim() || null;
  // description: sprtgdNm 그대로
  const description = eqmtNm.slice(0, 200);

  // external_id: 좌표+기구명 (build-seeds 의 eqmtExternalId 와 동일 규칙)
  let externalId = `eqmt:${lat.toFixed(5)},${lng.toFixed(5)}:${eqmtNm.replace(/\s+/g, "")}`;
  if (seenId.has(externalId)) {
    externalId = `eqmt:${lat.toFixed(6)},${lng.toFixed(6)}:${name}`;
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
console.log("  eqmt-demo 빌드 (실외운동기구 최소 시드)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  원본 운동기구    ${raw.length}`);
console.log(`  키워드 미스 제외 ${skipKeyword}`);
console.log(`  좌표 무효 제외   ${skipCoord}`);
console.log(`  ID 중복 제외     ${dupId}`);
console.log(`  생성 시드        ${seeds.length}  (limit ${LIMIT === Infinity ? "전체" : LIMIT})`);
console.log(`  키워드: ${KEYWORDS.join(", ")}`);
console.log(`  → ${OUT}`);

console.log("\n  샘플 5건:");
seeds.slice(0, 5).forEach((s) => {
  const line = `    ${s.name.padEnd(20)} ${s.lat},${s.lng}  ${s.description}`;
  console.log(line.slice(0, 100));
});

if (seeds.length === 0) {
  console.log(
    "\n  ⚠️  0건 — 키워드 매치 실패. 운동기구명 표본 확인:",
  );
  raw.slice(0, 10).forEach((r) => console.log(`    ${normalizeEqmt(r).exrcEqmtNm}`));
} else {
  console.log("\n  다음: npm run seed:import eqmt");
}
