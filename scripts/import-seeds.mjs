// 공스장 — 시드 import (Supabase)
// 사용:
//   .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 설정
//   node --env-file=.env.local scripts/import-seeds.mjs
//
// 동작:
//   supabase/seeds/cheongju.json 읽고 두 단계 dedup으로 안전 insert
//   1) (source, external_id) 매치 — 이미 import한 거 스킵
//   2) 30m 이내 기존 location 매치 — 다른 출처와의 위치 중복 스킵

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요.\n" +
      "   service role key는 Supabase Settings → API → 'service_role' 에서 복사.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const seeds = JSON.parse(readFileSync("supabase/seeds/cheongju.json", "utf8"));
console.log(`시드 후보: ${seeds.length}건`);

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
    if (exist) {
      skippedByExt++;
      continue;
    }
  }

  // dedup 2: 30m 이내 기존 좌표 (다른 source 포함)
  const { data: near, error: nearErr } = await supabase.rpc(
    "locations_within",
    { in_lat: s.lat, in_lng: s.lng, in_meters: 30 },
  );
  if (nearErr) {
    console.error(`  rpc 실패: ${s.name} — ${nearErr.message}`);
    failed++;
    continue;
  }
  if (near && near.length > 0) {
    skippedByGeo++;
    continue;
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
    console.error(`  insert 실패: ${s.name} — ${error.message}`);
    failed++;
  } else {
    inserted++;
  }
}

console.log(`\n=== 결과 ===`);
console.log(`삽입             ${inserted}`);
console.log(`외부ID 중복 스킵 ${skippedByExt}`);
console.log(`좌표 중복 스킵   ${skippedByGeo}`);
console.log(`실패             ${failed}`);
