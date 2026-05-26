// 공스장 — 시드 빌더
// raw 공공데이터 → 필터 → dedup → curated rename → priority 분류 → seeds JSON + 리포트
//
// 사용: node --env-file=.env.local scripts/build-seeds.mjs
// 출력:
//   supabase/seeds/cheongju.json       (전체)
//   supabase/seeds/cheongju.p1.json    (★ 우선 동네 + 좋은 이름)
//   supabase/seeds/cheongju.p2.json    (· 우선 동네, 이름 검토 필요)
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

const loadJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(`❌ ${path} 읽기 실패. 먼저 'npm run seed:fetch' 실행.`);
    process.exit(1);
  }
};
const asNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

// ─── 1. 공원 인덱스 ─────────────────────────────────────────────
const rawParks = loadJson(RAW_PARKS);
const parks = rawParks
  .map((p) => ({
    name: (p.parkNm || p.parkNmKor || "").trim(),
    lat: asNum(p.latitude),
    lng: asNum(p.longitude),
  }))
  .filter((p) => p.name && inCheongjuBbox(p.lat, p.lng));

// ─── 2. 철봉 후보 필터 ──────────────────────────────────────────
const rawEqmts = loadJson(RAW_EQMT);

const stats = {
  totalRaw: rawEqmts.length,
  skipKeyword: 0,
  skipCoord: 0,
  skipBbox: 0,
};
const candidates = [];

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
    rdnmadr: eqmt.rdnmadr || null,
    lnmadr: eqmt.lnmadr || null,
    eqmtName: eqmt.exrcEqmtNm,
    eqmtQty: Number(eqmt.exrcEqmtQty) || 1,
    instlPlaceNm: eqmt.instlPlaceNm,
    externalId: eqmtExternalId(eqmt),
  });
}

// ─── 3. 30m dedup (같은 장소의 다중 기구 통합) ─────────────────
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

// ─── 4. curated rename + priority ──────────────────────────────
const seeds = [];
const renamePairs = []; // { from, to } — generic 이름이 의미 있는 이름으로 변환된 경우
let droppedNoName = 0;

for (const c of deduped) {
  const built = buildName({
    instlPlaceNm: c.instlPlaceNm,
    rdnmadr: c.rdnmadr,
    lnmadr: c.lnmadr,
    lat: c.lat,
    lng: c.lng,
    parks,
  });

  if (!built.name) { droppedNoName++; continue; }

  // before/after rename 추적
  if (built.original && built.original !== built.name && !built.generic) {
    renamePairs.push({ from: built.original, to: built.name, source: built.source });
  }

  const eqmtList = c.eqmtNames ? c.eqmtNames.join(", ") : c.eqmtName;
  const description = `${eqmtList} · ${c.eqmtQtyTotal}대`;
  // priority/dong 매칭은 도로명·지번 양쪽 모두에서 ○○동 탐색
  const matchBlob = `${c.rdnmadr ?? ""} ${c.lnmadr ?? ""} ${built.name}`;
  const pri = priorityScore(matchBlob, "");
  const dong = extractDong(c.rdnmadr, c.lnmadr);

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
    _meta: {
      priorityScore: pri,
      tier,
      nameSource: built.source,
      generic: built.generic,
      dong,
    },
  });
}

const TIER_ORDER = { p1: 0, p2: 1, etc: 2 };
seeds.sort((a, b) => {
  const tt = TIER_ORDER[a._meta.tier] - TIER_ORDER[b._meta.tier];
  if (tt !== 0) return tt;
  return a.name.localeCompare(b.name);
});

// ─── 5. 출력 ──────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const p1 = seeds.filter((s) => s._meta.tier === "p1");
const p2 = seeds.filter((s) => s._meta.tier === "p2");
const etc = seeds.filter((s) => s._meta.tier === "etc");

writeFileSync(`${OUT_DIR}/cheongju.json`, JSON.stringify(seeds, null, 2));
writeFileSync(`${OUT_DIR}/cheongju.p1.json`, JSON.stringify(p1, null, 2));
writeFileSync(`${OUT_DIR}/cheongju.p2.json`, JSON.stringify(p2, null, 2));
writeFileSync(`${OUT_DIR}/cheongju.etc.json`, JSON.stringify(etc, null, 2));

// ─── 6. 리포트 (사용자가 요청한 7개 항목) ──────────────────────
const genericCount = seeds.filter((s) => s._meta.generic).length;
const dongCount = {};
for (const s of seeds) {
  const k = s._meta.dong ?? "(미상)";
  dongCount[k] = (dongCount[k] || 0) + 1;
}
const priorityDongCount = Object.fromEntries(PRIORITY_DONGS.map((d) => [d, 0]));
for (const s of seeds) {
  // 도로명에 없으면 지번에 있을 수도 있으므로 dong meta + address 모두 검사
  const blob = `${s.address ?? ""} ${s.name} ${s._meta.dong ?? ""}`;
  for (const d of PRIORITY_DONGS) {
    if (blob.includes(d)) priorityDongCount[d]++;
  }
}

const expectedImport = p1.length + p2.length;

const log = (l = "") => console.log(l);
log();
log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
log("  공스장 시드 빌드 리포트 — 청주·오송");
log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
log();
log("  ◇ 1. 원본 API 데이터");
log(`     실외운동기구 raw          ${stats.totalRaw.toLocaleString()}건`);
log(`     도시공원 raw              ${rawParks.length.toLocaleString()}건  (인덱스: ${parks.length}건)`);
log();
log("  ◇ 2. 철봉 필터 통과");
log(`     키워드 미스               ${stats.skipKeyword.toLocaleString()}건 제외`);
log(`     좌표 무효                 ${stats.skipCoord.toLocaleString()}건 제외`);
log(`     bbox 밖 (청주·오송 외)    ${stats.skipBbox.toLocaleString()}건 제외`);
log(`     → 철봉 후보               ${candidates.length.toLocaleString()}건`);
log();
log("  ◇ 3. dedup 후 최종");
log(`     30m dedup 통합            ${(candidates.length - deduped.length).toLocaleString()}건 통합`);
log(`     이름 생성 실패 제외       ${droppedNoName}건`);
log(`     → 최종 시드               ${seeds.length.toLocaleString()}건`);
log();
log("  ◇ 4. 실제 import 예상");
log(`     priority 1 (★)            ${p1.length}건  ← 우선 동네 + 좋은 이름`);
log(`     priority 2 (·)            ${p2.length}건  ← 우선 동네, 이름 검토 필요`);
log(`     기타                      ${etc.length}건`);
log(`     → import 예상 (p1+p2)     ${expectedImport}건`);
log();
log("  ◇ 5. 우선 동네별 분포");
for (const [d, n] of Object.entries(priorityDongCount)) {
  log(`     ${d.padEnd(10)}  ${"█".repeat(Math.min(n, 40))} ${n}`);
}
log();
log("  ◇ 6. generic 이름 — 자동 rename 예시");
log(`     generic 비율: ${genericCount}/${seeds.length} (${seeds.length ? Math.round((genericCount / seeds.length) * 100) : 0}%)`);
const samples = renamePairs.slice(0, 10);
if (samples.length === 0) {
  log(`     (자동 rename 케이스 없음 — 모두 원래 이름 사용)`);
} else {
  for (const { from, to, source } of samples) {
    log(`     ${from.padEnd(20)} → ${to}  [${source}]`);
  }
}
log();
log("  ◇ 7. 지도에서 실제 확인 가능한 대표 장소 (우선 동네별 1~2개)");
const byDongP1 = {};
for (const s of [...p1, ...p2]) {
  const k = s._meta.dong || "기타";
  if (!byDongP1[k]) byDongP1[k] = [];
  byDongP1[k].push(s);
}
for (const d of PRIORITY_DONGS) {
  const list = Object.entries(byDongP1).filter(([k]) => k.includes(d)).flatMap(([, v]) => v);
  if (list.length === 0) continue;
  log(`     ${d}`);
  list.slice(0, 2).forEach((s) => {
    log(`       • ${s.name.padEnd(28)}  ${s.lat.toFixed(4)},${s.lng.toFixed(4)}`);
  });
}
log();
log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
log();
log("출력 파일:");
log(`  ${OUT_DIR}/cheongju.json       (${seeds.length}건, 전체)`);
log(`  ${OUT_DIR}/cheongju.p1.json    (${p1.length}건)  ← 큐레이션 우선`);
log(`  ${OUT_DIR}/cheongju.p2.json    (${p2.length}건)`);
log(`  ${OUT_DIR}/cheongju.etc.json   (${etc.length}건)  ← 시드 제외 권장`);
log();
log("다음 단계:");
log("  1. cheongju.p1.json 열어 이름/설명 톤 보정 (verified: true 마킹)");
log("  2. p2 중 동네별 3~10개만 p1으로 승급 (도장 밀도 우선)");
log("  3. npm run seed:import     ← 기본은 p1만");
log("     npm run seed:import p2  ← 큐레이션 후 p2도 추가");
