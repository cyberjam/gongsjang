// 공스장 — 시드 import (Supabase)
//
// 사용:
//   node --env-file=.env.local scripts/import-seeds.mjs            (기본: p1)
//   node --env-file=.env.local scripts/import-seeds.mjs p1
//   node --env-file=.env.local scripts/import-seeds.mjs p2
//   node --env-file=.env.local scripts/import-seeds.mjs all
//   node --env-file=.env.local scripts/import-seeds.mjs <path>
//
// 두 단계 dedup:
//   1) (source, external_id) 매치 → 이미 import한 거 스킵
//   2) 30m 이내 기존 좌표 매치 → 다른 출처와의 위치 중복 스킵

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요.\n" +
      "   service role key는 Supabase Settings → API → 'service_role'.",
  );
  process.exit(1);
}

const arg = (process.argv[2] || "p1").trim();
let path;
if (arg === "p1") path = "supabase/seeds/cheongju.p1.json";
else if (arg === "p2") path = "supabase/seeds/cheongju.p2.json";
else if (arg === "all") path = "supabase/seeds/cheongju.json";
else if (arg === "etc") path = "supabase/seeds/cheongju.etc.json";
else path = arg;

console.log(`📂 ${path}\n`);

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

let seeds;
try {
  seeds = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`❌ ${path} 읽기 실패: ${e.message}`);
  console.error("   먼저 npm run seed:build 실행.");
  process.exit(1);
}
console.log(`시드 후보: ${seeds.length}건`);

let inserted = 0;
let skippedByExt = 0;
let skippedByGeo = 0;
let failed = 0;
const insertedByDong = {};

// ─── 대용량(>500): 배치 upsert (행마다 select/rpc 없이 빠르게) ───
// (source, external_id) 유니크 인덱스로 중복은 무시. 좌표 dedup 은 생략.
const BATCH_THRESHOLD = 500;
const BATCH_SIZE = 500;

if (seeds.length > BATCH_THRESHOLD) {
  console.log(`대용량 → 배치 insert 모드 (${BATCH_SIZE}건씩, 좌표 dedup 생략)`);

  // 재실행 시 중복 방지: 이미 들어간 external_id 미리 조회해서 제외
  const existing = new Set();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("locations")
        .select("external_id")
        .eq("source", "public_data")
        .not("external_id", "is", null)
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) existing.add(r.external_id);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  if (existing.size > 0) {
    console.log(`  기존 external_id ${existing.size}건 → 제외 후 insert`);
  }

  const fresh = seeds.filter(
    (s) => !(s.external_id && existing.has(s.external_id)),
  );
  console.log(`  신규 ${fresh.length}건 insert 시작\n`);

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const chunk = fresh.slice(i, i + BATCH_SIZE).map((s) => ({
      name: s.name,
      address: s.address || null,
      description: s.description || null,
      lat: s.lat,
      lng: s.lng,
      source: s.source ?? null,
      external_id: s.external_id ?? null,
      verified: s.verified ?? false,
    }));
    const { error } = await supabase.from("locations").insert(chunk);
    if (error) {
      console.error(`  ✗ batch ${i}~${i + chunk.length} 실패: ${error.message}`);
      failed += chunk.length;
    } else {
      inserted += chunk.length;
      console.log(`  ✓ ${i + chunk.length}/${fresh.length}`);
    }
  }
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  삽입 완료         ${inserted}`);
  console.log(`  기존 중복 스킵    ${seeds.length - fresh.length}`);
  console.log(`  실패              ${failed}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n→ 지도(/) 접속해서 마커 확인.");
  process.exit(failed > 0 ? 1 : 0);
}

// ─── 소량(≤500): 행마다 dedup (정밀) ───
// locations_within RPC 가 없으면 좌표 dedup 비활성화 (external_id 만으로 중복 방지)
let geoDedup = true;

for (const s of seeds) {
  if (s.source && s.external_id) {
    const { data: exist } = await supabase
      .from("locations")
      .select("id")
      .eq("source", s.source)
      .eq("external_id", s.external_id)
      .maybeSingle();
    if (exist) { skippedByExt++; continue; }
  }

  if (geoDedup) {
    const { data: near, error: nearErr } = await supabase.rpc("locations_within", {
      in_lat: s.lat, in_lng: s.lng, in_meters: 30,
    });
    if (nearErr) {
      // 함수 미존재 등 → 좌표 dedup 비활성화하고 계속 (external_id 만으로 중복 방지)
      console.warn(
        `  ⚠️  locations_within RPC 없음 — 좌표 dedup 끄고 진행 ` +
          `(권장: supabase/schema.sql 의 함수 정의 실행)`,
      );
      geoDedup = false;
    } else if (near && near.length > 0) {
      skippedByGeo++;
      continue;
    }
  }

  const { error } = await supabase.from("locations").insert({
    name: s.name,
    address: s.address || null,
    description: s.description || null,
    lat: s.lat,
    lng: s.lng,
    source: s.source ?? null,
    external_id: s.external_id ?? null,
    verified: s.verified ?? false,
  });

  if (error) {
    console.error(`  ✗ insert 실패: ${s.name} — ${error.message}`);
    failed++;
  } else {
    inserted++;
    console.log(`  ✓ ${s.name}`);
    const d = s._meta?.dong ?? "기타";
    insertedByDong[d] = (insertedByDong[d] || 0) + 1;
  }
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  삽입 완료         ${inserted}`);
console.log(`  외부ID 중복 스킵  ${skippedByExt}`);
console.log(`  좌표 중복 스킵    ${skippedByGeo}`);
console.log(`  실패              ${failed}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

if (inserted > 0) {
  console.log("\n  동네별 import 분포:");
  Object.entries(insertedByDong)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log(`    ${d.padEnd(12)} ${n}`));
  console.log("\n→ 지도(/) 접속해서 마커 확인하세요.");
}
