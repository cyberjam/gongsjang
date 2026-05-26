// 공스장 — 시드 import (Supabase)
//
// 사용:
//   node --env-file=.env.local scripts/import-seeds.mjs            (기본: p1)
//   node --env-file=.env.local scripts/import-seeds.mjs p1
//   node --env-file=.env.local scripts/import-seeds.mjs p2
//   node --env-file=.env.local scripts/import-seeds.mjs all
//   node --env-file=.env.local scripts/import-seeds.mjs <path>
//
// 동작:
//   해당 시드 JSON 읽고 두 단계 dedup으로 안전 insert
//   1) (source, external_id) 매치 → 이미 import한 거 스킵
//   2) 30m 이내 기존 좌표 매치 → 다른 출처와의 위치 중복 스킵

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요.\n" +
      "   service role key는 Supabase Settings → API → 'service_role' 에서 복사.",
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

console.log(`📂 ${path}`);

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

let seeds;
try {
  seeds = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`❌ ${path} 읽기 실패: ${e.message}`);
  console.error("   먼저 npm run seed:build 실행하세요.");
  process.exit(1);
}
console.log(`시드 후보: ${seeds.length}건\n`);

let inserted = 0;
let skippedByExt = 0;
let skippedByGeo = 0;
let failed = 0;

for (const s of seeds) {
  // dedup 1: (source, external_id)
  if (s.source && s.external_id) {
    const { data: exist } = await supabase
      .from("locations")
      .select("id")
      .eq("source", s.source)
      .eq("external_id", s.external_id)
      .maybeSingle();
    if (exist) { skippedByExt++; continue; }
  }

  // dedup 2: 30m 이내 기존 좌표
  const { data: near, error: nearErr } = await supabase.rpc("locations_within", {
    in_lat: s.lat, in_lng: s.lng, in_meters: 30,
  });
  if (nearErr) {
    console.error(`  rpc 실패: ${s.name} — ${nearErr.message}`);
    failed++;
    continue;
  }
  if (near && near.length > 0) { skippedByGeo++; continue; }

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
    console.error(`  insert 실패: ${s.name} — ${error.message}`);
    failed++;
  } else {
    inserted++;
    console.log(`  ✓ ${s.name}`);
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  삽입             ${inserted}`);
console.log(`  외부ID 중복 스킵 ${skippedByExt}`);
console.log(`  좌표 중복 스킵   ${skippedByGeo}`);
console.log(`  실패             ${failed}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
