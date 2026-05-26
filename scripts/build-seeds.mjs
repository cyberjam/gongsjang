// 공스장 — 시드 빌더
// raw 공공데이터 → 필터 → dedup → 이름 생성 → seeds JSON
//
// 사용: node --env-file=.env.local scripts/build-seeds.mjs
// 출력: supabase/seeds/cheongju.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildName,
  distanceM,
  eqmtExternalId,
  inCheongjuBbox,
  matchesPullup,
  priorityScore,
} from "./lib/cheongju.mjs";

const RAW_EQMT = "supabase/raw/cheongju-eqmt.json";
const RAW_PARKS = "supabase/raw/cheongju-parks.json";
const OUT = "supabase/seeds/cheongju.json";

const DEDUP_RADIUS_M = 30;

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`❌ ${path} 읽기 실패. 먼저 fetch-public-data.mjs 실행하세요.`);
    process.exit(1);
  }
}

function asNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

// ─── 1. 공원 인덱스 (이름 생성에 사용) ───────────────────────────
const rawParks = loadJson(RAW_PARKS);
const parks = rawParks
  .map((p) => ({
    name: (p.parkNm || p.parkNmKor || "").trim(),
    lat: asNum(p.latitude),
    lng: asNum(p.longitude),
  }))
  .filter((p) => p.name && inCheongjuBbox(p.lat, p.lng));

console.log(`도시공원 인덱스: ${parks.length}건`);

// ─── 2. 운동기구 필터 ────────────────────────────────────────────
const rawEqmts = loadJson(RAW_EQMT);
console.log(`운동기구 원본: ${rawEqmts.length}건`);

const candidates = [];
let skipKeyword = 0;
let skipBbox = 0;
let skipCoord = 0;

for (const eqmt of rawEqmts) {
  if (!matchesPullup(eqmt.exrcEqmtNm)) {
    skipKeyword++;
    continue;
  }
  const lat = asNum(eqmt.latitude);
  const lng = asNum(eqmt.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    skipCoord++;
    continue;
  }
  if (!inCheongjuBbox(lat, lng)) {
    skipBbox++;
    continue;
  }

  candidates.push({
    raw: eqmt,
    lat,
    lng,
    address: eqmt.rdnmadr || eqmt.lnmadr || null,
    eqmtName: eqmt.exrcEqmtNm,
    eqmtQty: Number(eqmt.exrcEqmtQty) || 1,
    instlPlaceNm: eqmt.instlPlaceNm,
    externalId: eqmtExternalId(eqmt),
  });
}

console.log(
  `철봉 필터 통과: ${candidates.length}건  ` +
    `(키워드 미스 ${skipKeyword}, 좌표 무효 ${skipCoord}, bbox 밖 ${skipBbox})`,
);

// ─── 3. 좌표 dedup (같은 곳의 다중 기구 통합) ─────────────────────
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
console.log(`좌표 dedup 후 (${DEDUP_RADIUS_M}m): ${deduped.length}건`);

// ─── 4. 이름 + 설명 + 우선순위 ────────────────────────────────────
const seeds = deduped.map((c) => {
  const name = buildName({
    instlPlaceNm: c.instlPlaceNm,
    rdnmadr: c.address,
    lnmadr: null,
    lat: c.lat,
    lng: c.lng,
    parks,
  });
  const eqmtList = c.eqmtNames ? c.eqmtNames.join(", ") : c.eqmtName;
  const description = `${eqmtList} · ${c.eqmtQtyTotal}대`;
  return {
    external_id: c.externalId,
    source: "public_data",
    name,
    address: c.address,
    description,
    lat: Number(c.lat.toFixed(6)),
    lng: Number(c.lng.toFixed(6)),
    priority: priorityScore(c.address, name), // 우선 동네 매치 점수
    verified: false, // 큐레이션 전
  };
});

// 우선순위 동네가 위로 오게 정렬
seeds.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

// ─── 5. 출력 ──────────────────────────────────────────────────────
mkdirSync("supabase/seeds", { recursive: true });
writeFileSync(OUT, JSON.stringify(seeds, null, 2));
console.log(`→ ${OUT} (${seeds.length}건)`);

// 우선 동네 매치 분포
const buckets = {};
for (const s of seeds) {
  const key = s.priority > 0 ? `priority=${s.priority}` : "기타";
  buckets[key] = (buckets[key] || 0) + 1;
}
console.log("\n=== 우선 동네 매치 분포 ===");
console.log(buckets);

// 처음 10건 미리보기
console.log("\n=== 미리보기 (priority 높은 순 10건) ===");
seeds.slice(0, 10).forEach((s) => {
  console.log(
    `  ${s.priority > 0 ? "★" + s.priority : "  "}  ${s.name.padEnd(28)}` +
      ` ${s.lat.toFixed(4)},${s.lng.toFixed(4)}  ${s.address || ""}`,
  );
});

console.log(
  "\n다음:\n" +
    "  1. supabase/seeds/cheongju.json 열어 동네별로 솎아내기 (도장 밀도 우선)\n" +
    "  2. name/description 톤 보정 (도장스럽게)\n" +
    '  3. node --env-file=.env.local scripts/import-seeds.mjs',
);
