// 공스장 — 시드 빌더
// raw 공공데이터 → 필터 → dedup → 이름 생성 → priority 분류 → seeds JSON + 리포트
//
// 사용: node --env-file=.env.local scripts/build-seeds.mjs
// 출력:
//   supabase/seeds/cheongju.json       (전체)
//   supabase/seeds/cheongju.p1.json    (priority 1 — 우선 동네 매치)
//   supabase/seeds/cheongju.p2.json    (priority 2 — 동네 매치 + 좋은 이름)
//   supabase/seeds/cheongju.etc.json   (그 외)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildName,
  distanceM,
  eqmtExternalId,
  extractDong,
  inCheongjuBbox,
  matchesPullup,
  priorityScore,
  PRIORITY_DONGS,
} from "./lib/cheongju.mjs";

const RAW_EQMT = "supabase/raw/cheongju-eqmt.json";
const RAW_PARKS = "supabase/raw/cheongju-parks.json";
const OUT_DIR = "supabase/seeds";

const DEDUP_RADIUS_M = 30;

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(`❌ ${path} 읽기 실패. 먼저 fetch-public-data.mjs 실행.`);
    process.exit(1);
  }
}

function asNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

// ─── 1. 공원 인덱스 ─────────────────────────────────────────────
const rawParks = loadJson(RAW_PARKS);
const parks = rawParks
  .map((p) => ({
    name: (p.parkNm || p.parkNmKor || "").trim(),
    lat: asNum(p.latitude),
    lng: asNum(p.longitude),
  }))
  .filter((p) => p.name && inCheongjuBbox(p.lat, p.lng));

// ─── 2. 운동기구 → 철봉 후보 필터 ─────────────────────────────
const rawEqmts = loadJson(RAW_EQMT);

const candidates = [];
const stats = {
  totalRaw: rawEqmts.length,
  skipKeyword: 0,
  skipCoord: 0,
  skipBbox: 0,
};

for (const eqmt of rawEqmts) {
  if (!matchesPullup(eqmt.exrcEqmtNm)) { stats.skipKeyword++; continue; }
  const lat = asNum(eqmt.latitude);
  const lng = asNum(eqmt.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { stats.skipCoord++; continue; }
  if (!inCheongjuBbox(lat, lng)) { stats.skipBbox++; continue; }

  candidates.push({
    raw: eqmt,
    lat, lng,
    address: eqmt.rdnmadr || eqmt.lnmadr || null,
    eqmtName: eqmt.exrcEqmtNm,
    eqmtQty: Number(eqmt.exrcEqmtQty) || 1,
    instlPlaceNm: eqmt.instlPlaceNm,
    externalId: eqmtExternalId(eqmt),
  });
}

// ─── 3. 30m dedup ────────────────────────────────────────────
const deduped = [];
for (const c of candidates) {
  const dup = deduped.find(
    (d) => distanceM({ lat: c.lat, lng: c.lng }, { lat: d.lat, lng: d.lng }) <= DEDUP_RADIUS_M,
  );
  if (dup) {
    dup.eqmtNames = dup.eqmtNames || [dup.eqmtName];
    if (!dup.eqmtNames.includes(c.eqmtName)) dup.eqmtNames.push(c.eqmtName);
    dup.eqmtQtyTotal = (dup.eqmtQtyTotal || dup.eqmtQty) + c.eqmtQty;
  } else {
    deduped.push({ ...c, eqmtQtyTotal: c.eqmtQty });
  }
}

// ─── 4. 이름 + 우선순위 ─────────────────────────────────────
const seeds = [];
let droppedNoName = 0;

for (const c of deduped) {
  const built = buildName({
    instlPlaceNm: c.instlPlaceNm,
    rdnmadr: c.address,
    lnmadr: null,
    lat: c.lat,
    lng: c.lng,
    parks,
  });

  if (!built.name) { droppedNoName++; continue; }

  const eqmtList = c.eqmtNames ? c.eqmtNames.join(", ") : c.eqmtName;
  const description = `${eqmtList} · ${c.eqmtQtyTotal}대`;
  const pri = priorityScore(c.address, built.name);
  const dong = extractDong(c.address);

  // priority tier:
  //   1 = 우선 동네 매치
  //   2 = 우선 동네 + 좋은 이름(공원/장소 기반, generic 아님)
  let tier;
  if (pri > 0 && !built.generic) tier = "p1";
  else if (pri > 0) tier = "p2";
  else tier = "etc";

  seeds.push({
    external_id: c.externalId,
    source: "public_data",
    name: built.name,
    address: c.address,
    description,
    lat: Number(c.lat.toFixed(6)),
    lng: Number(c.lng.toFixed(6)),
    verified: false,
    // 메타 (import 시 무시되는 보조 필드)
    _meta: {
      priorityScore: pri,
      tier,
      nameSource: built.source,
      generic: built.generic,
      dong,
    },
  });
}

// 우선순위 → 동네 → 이름 순 정렬
const TIER_ORDER = { p1: 0, p2: 1, etc: 2 };
seeds.sort((a, b) => {
  const tt = TIER_ORDER[a._meta.tier] - TIER_ORDER[b._meta.tier];
  if (tt !== 0) return tt;
  return a.name.localeCompare(b.name);
});

// ─── 5. 출력 ─────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

const p1 = seeds.filter((s) => s._meta.tier === "p1");
const p2 = seeds.filter((s) => s._meta.tier === "p2");
const etc = seeds.filter((s) => s._meta.tier === "etc");

writeFileSync(`${OUT_DIR}/cheongju.json`, JSON.stringify(seeds, null, 2));
writeFileSync(`${OUT_DIR}/cheongju.p1.json`, JSON.stringify(p1, null, 2));
writeFileSync(`${OUT_DIR}/cheongju.p2.json`, JSON.stringify(p2, null, 2));
writeFileSync(`${OUT_DIR}/cheongju.etc.json`, JSON.stringify(etc, null, 2));

// ─── 6. 리포트 ───────────────────────────────────────────────
const genericCount = seeds.filter((s) => s._meta.generic).length;
const dongCount = {};
for (const s of seeds) {
  const k = s._meta.dong ?? "(미상)";
  dongCount[k] = (dongCount[k] || 0) + 1;
}
const priorityDongCount = {};
for (const d of PRIORITY_DONGS) priorityDongCount[d] = 0;
for (const s of seeds) {
  for (const d of PRIORITY_DONGS) {
    if ((s.address || "").includes(d) || s.name.includes(d)) priorityDongCount[d]++;
  }
}

const expectedImport = p1.length + p2.length;

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  공스장 시드 빌드 리포트 — 청주·오송");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  원본 운동기구           ${stats.totalRaw.toLocaleString()}건`);
console.log(`  └ 키워드 미스          ${stats.skipKeyword.toLocaleString()}`);
console.log(`  └ 좌표 무효            ${stats.skipCoord.toLocaleString()}`);
console.log(`  └ bbox 밖              ${stats.skipBbox.toLocaleString()}`);
console.log(`  철봉 후보              ${candidates.length.toLocaleString()}건`);
console.log(`  └ 30m dedup 후         ${deduped.length.toLocaleString()}건  (감소: ${candidates.length - deduped.length}건)`);
console.log(`  └ 이름 생성 실패 제외  ${droppedNoName}건`);
console.log(`  최종 시드              ${seeds.length.toLocaleString()}건`);
console.log("");
console.log(`  priority 1 (★)         ${p1.length}건  ← 우선 동네 + 좋은 이름`);
console.log(`  priority 2 (·)         ${p2.length}건  ← 우선 동네, 이름 검토 필요`);
console.log(`  기타                   ${etc.length}건`);
console.log("");
console.log(`  generic 이름 비율      ${genericCount} / ${seeds.length}` +
  `  (${seeds.length ? Math.round((genericCount / seeds.length) * 100) : 0}%)`);
console.log(`  실제 import 예상 개수  ${expectedImport}건  (p1 + p2)`);
console.log("");
console.log("  ── 우선 동네별 분포 ──");
for (const [d, n] of Object.entries(priorityDongCount)) {
  console.log(`    ${d.padEnd(10)}  ${"█".repeat(Math.min(n, 30))} ${n}`);
}
console.log("");
console.log("  ── 전체 동/읍/면 분포 (상위 15) ──");
Object.entries(dongCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([d, n]) => console.log(`    ${d.padEnd(12)} ${n}`));
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

console.log("\n출력:");
console.log(`  ${OUT_DIR}/cheongju.json       (${seeds.length}건)`);
console.log(`  ${OUT_DIR}/cheongju.p1.json    (${p1.length}건)  ← 큐레이션 우선`);
console.log(`  ${OUT_DIR}/cheongju.p2.json    (${p2.length}건)`);
console.log(`  ${OUT_DIR}/cheongju.etc.json   (${etc.length}건)  ← 시드 제외 권장`);
console.log("\n다음:");
console.log("  1. cheongju.p1.json 열어 이름/설명 톤 손보기 (verified: true 로)");
console.log("  2. p2 중 동네별 3~10개만 골라 p1으로 승급");
console.log("  3. node --env-file=.env.local scripts/import-seeds.mjs");
