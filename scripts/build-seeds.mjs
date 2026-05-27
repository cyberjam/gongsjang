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
  normalizeEqmt,
  priorityScore,
  pullupTokens,
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

// ─── 0. 입력 검증 — 0건이면 의미 있는 에러 ─────────────────────
const rawEqmtsRaw = loadJson(RAW_EQMT);
const rawParksRaw = loadJson(RAW_PARKS);
if (!Array.isArray(rawEqmtsRaw) || rawEqmtsRaw.length === 0) {
  console.error(
    `❌ ${RAW_EQMT} 가 비어있습니다 (${rawEqmtsRaw?.length ?? 0}건).\n` +
      "   API returned 0 rows — likely invalid key or encoding issue\n" +
      "   npm run seed:fetch 다시 실행해서 에러 로그 확인.\n",
  );
  process.exit(2);
}

// ─── 0b. 필드명 진단 — 실제 응답 키가 기대와 다른지 즉시 확인 ──────
console.log("=== 원본 필드 진단 (실외운동기구 첫 항목) ===");
console.log("  keys:", Object.keys(rawEqmtsRaw[0]).join(", "));
console.log("  sample:", JSON.stringify(rawEqmtsRaw[0]).slice(0, 400));
console.log("\n  normalizeEqmt 매핑: sprtgdNm→운동기구명, lat/lot→좌표, lctnRoadNmAddr/lctnLotnoAddr→주소, instlPlcNm→설치장소");
console.log("  (표준 약어 latitude/longitude/exrcEqmtNm 도 fallback 처리)\n");

if (Array.isArray(rawParksRaw) && rawParksRaw[0]) {
  console.log("=== 원본 필드 진단 (도시공원 첫 항목) ===");
  console.log("  keys:", Object.keys(rawParksRaw[0]).join(", "));
  console.log("");
}

// ─── 0c. 시도(ctpvNm) 분포 진단 — 충북/청주가 실제로 들어왔는지 확인 ───
{
  const byCtpv = {};
  let chungbuk = 0;
  let cheongju = 0;
  for (const r of rawEqmtsRaw) {
    const c = r.ctpvNm ?? r.ctprvnNm ?? "(미상)";
    byCtpv[c] = (byCtpv[c] || 0) + 1;
    if (/충청북도|충북/.test(c)) chungbuk++;
    if (/청주/.test(r.sggNm ?? r.signguNm ?? "")) cheongju++;
  }
  console.log("=== 시도(ctpvNm) 분포 — 받은 raw 전체 ===");
  Object.entries(byCtpv)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${c.padEnd(12)} ${n}`));
  console.log(`\n  → 충청북도: ${chungbuk}건, 청주 sgg: ${cheongju}건`);
  if (chungbuk === 0) {
    console.log("  ⚠️  충북 데이터가 raw 에 없음 → fetch 가 충북 도달 전 중단됨.");
    console.log("     전국 데이터셋이 지역코드 순 정렬이라 fetch 완주 필요.");
    console.log("     seed:fetch 로그에서 '누적 N/totalCount' 확인 — N < totalCount 면 미완주.");
  }
  console.log("");
}

// ─── 1. 공원 인덱스 ─────────────────────────────────────────────
const rawParks = rawParksRaw;
const parks = rawParks
  .map((p) => ({
    name: (p.parkNm || p.parkNmKor || "").trim(),
    lat: asNum(p.latitude),
    lng: asNum(p.longitude),
  }))
  .filter((p) => p.name && inCheongjuBbox(p.lat, p.lng));

// ─── 2. 철봉 후보 필터 ──────────────────────────────────────────
const rawEqmts = rawEqmtsRaw;

const stats = {
  totalRaw: rawEqmts.length,
  skipKeyword: 0,
  skipCoord: 0,
  skipBbox: 0,
};
const candidates = [];

// 키워드 통과했지만 좌표/bbox에서 빠진 표본 (진단용)
const sampleKeywordPass = [];

for (const rawEqmt of rawEqmts) {
  const eqmt = normalizeEqmt(rawEqmt);
  if (!matchesPullup(eqmt.exrcEqmtNm)) { stats.skipKeyword++; continue; }
  if (sampleKeywordPass.length < 3) sampleKeywordPass.push(eqmt);
  const lat = asNum(eqmt.latitude);
  const lng = asNum(eqmt.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { stats.skipCoord++; continue; }
  if (!inCheongjuBbox(lat, lng)) { stats.skipBbox++; continue; }

  // description 은 철봉 관련 토큰만 추출 (비철봉 기구 노이즈 제거)
  const tokens = pullupTokens(eqmt.exrcEqmtNm);
  const eqmtLabel = tokens.length ? tokens.join(", ") : "철봉";

  candidates.push({
    raw: eqmt,
    lat, lng,
    address: eqmt.rdnmadr || eqmt.lnmadr || null,
    rdnmadr: eqmt.rdnmadr || null,
    lnmadr: eqmt.lnmadr || null,
    eqmtName: eqmtLabel,
    eqmtQty: Number(eqmt.exrcEqmtQty) || 1,
    instlPlaceNm: eqmt.instlPlaceNm,
    externalId: eqmtExternalId(eqmt),
  });
}

// 후보 0건 진단 — 어느 필터에서 다 빠졌는지 + 표본
if (candidates.length === 0) {
  console.error("\n❌ 철봉 후보 0건 — 어느 단계에서 전부 빠졌는지 확인:");
  console.error(`   키워드 미스 ${stats.skipKeyword} / 좌표무효 ${stats.skipCoord} / bbox밖 ${stats.skipBbox} (총 ${rawEqmts.length})`);
  if (stats.skipKeyword === rawEqmts.length) {
    console.error("\n   → 전부 '키워드 미스'. exrcEqmtNm 필드명이 다르거나 운동기구명 표기가 다름.");
    console.error("     첫 항목 운동기구명 후보 키 점검:");
    const k = rawEqmts[0];
    for (const key of Object.keys(k)) {
      const v = String(k[key] ?? "");
      if (/철|봉|걸이|운동|기구|풀|업|현수/.test(v)) {
        console.error(`       ${key} = ${v}`);
      }
    }
  } else if (stats.skipCoord > 0 && stats.skipCoord >= stats.skipBbox) {
    console.error("\n   → '좌표 무효' 비중 큼. latitude/longitude 필드명이 다를 수 있음.");
    if (sampleKeywordPass[0]) {
      console.error("     키워드 통과 표본 keys:", Object.keys(sampleKeywordPass[0]).join(", "));
      console.error("     표본:", JSON.stringify(sampleKeywordPass[0]).slice(0, 400));
    }
  } else if (stats.skipBbox === rawEqmts.length - stats.skipKeyword - stats.skipCoord) {
    console.error("\n   → 좌표는 유효하나 전부 'bbox 밖'. 좌표 필드 매핑은 맞지만 청주에 데이터가 없거나 lat/lng 가 뒤바뀜.");
    if (sampleKeywordPass[0]) {
      const s = sampleKeywordPass[0];
      console.error(`     표본 좌표: latitude=${s.latitude} longitude=${s.longitude}`);
      console.error(`     bbox: lat 36.45~36.80, lng 127.20~127.70`);
    }
  }
  console.error("");
  process.exit(3);
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
