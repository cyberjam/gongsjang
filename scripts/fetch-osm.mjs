// 공스장 — OpenStreetMap 청주·오송 야외운동시설 수집기
// 공공데이터 15139207 에 청주 철봉이 0건이라 OSM 으로 보완.
//
// 사용: node scripts/fetch-osm.mjs
// 출력: supabase/seeds/cheongju.osm.json  (import 바로 가능한 형태)
// import: node --env-file=.env.local scripts/import-seeds.mjs supabase/seeds/cheongju.osm.json

import { mkdirSync, writeFileSync } from "node:fs";
import { extractDong, inCheongjuBbox } from "./lib/cheongju.mjs";

// 청주·오송 생활권 bbox (S,W,N,E) — cheongju.mjs 와 동일 범위
const BBOX = "36.45,127.20,36.80,127.70";

// leisure=fitness_station (야외 운동기구존) + 철봉류 세부 태그
const QUERY = `[out:json][timeout:60];
(
  node["leisure"="fitness_station"](${BBOX});
  way["leisure"="fitness_station"](${BBOX});
  node["fitness_station"="horizontal_bar"](${BBOX});
  way["fitness_station"="horizontal_bar"](${BBOX});
  node["sport"="fitness"]["leisure"](${BBOX});
);
out center tags;`;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function queryOverpass() {
  for (const ep of ENDPOINTS) {
    process.stdout.write(`→ ${ep} ... `);
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(QUERY),
      });
      if (!res.ok) {
        console.log(`HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      console.log(`OK (${json.elements?.length ?? 0} elements)`);
      return json;
    } catch (e) {
      console.log(`실패: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  console.log("=== OSM 청주·오송 야외운동시설 조회 ===\n");
  const data = await queryOverpass();
  if (!data) {
    console.error("\n❌ 모든 Overpass 엔드포인트 실패. 네트워크 확인 후 재시도.");
    process.exit(1);
  }

  const seeds = [];
  let skipped = 0;

  for (const el of data.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) { skipped++; continue; }
    if (!inCheongjuBbox(lat, lng)) { skipped++; continue; }

    const tags = el.tags ?? {};
    const osmName = tags.name || tags["name:ko"] || null;
    const addr =
      tags["addr:full"] ||
      [tags["addr:city"], tags["addr:district"], tags["addr:street"]]
        .filter(Boolean)
        .join(" ") ||
      null;
    const dong = extractDong(addr);

    // 이름: OSM name → 동네명 → 좌표 기반
    const name = osmName
      ? (/철봉|운동|공원/.test(osmName) ? osmName : `${osmName} 철봉`)
      : dong
        ? `${dong} 철봉`
        : `청주 철봉 (${lat.toFixed(4)},${lng.toFixed(4)})`;

    seeds.push({
      external_id: `osm:${el.type}:${el.id}`,
      source: "osm",
      name,
      address: addr,
      description: "OSM 등록 야외 운동시설",
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      verified: false,
      _meta: { dong, osmName, tags: Object.keys(tags) },
    });
  }

  mkdirSync("supabase/seeds", { recursive: true });
  const OUT = "supabase/seeds/cheongju.osm.json";
  writeFileSync(OUT, JSON.stringify(seeds, null, 2));

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  OSM 조회 결과`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  raw elements    ${data.elements?.length ?? 0}`);
  console.log(`  bbox 내 채택    ${seeds.length}`);
  console.log(`  제외(좌표/범위) ${skipped}`);
  console.log(`  → ${OUT}`);

  if (seeds.length > 0) {
    console.log(`\n  미리보기:`);
    seeds.slice(0, 10).forEach((s) =>
      console.log(`    ${s.name.padEnd(28)} ${s.lat},${s.lng}`),
    );
    console.log(
      `\n  import:\n` +
        `    node --env-file=.env.local scripts/import-seeds.mjs ${OUT}`,
    );
  } else {
    console.log(
      `\n  ⚠️  청주 bbox 내 OSM 야외운동시설 0건.\n` +
        `     OSM 청주 커버리지가 얕음. 수동 시드(아래) 권장:\n` +
        `     supabase/seeds/cheongju.manual.json 직접 작성 후 import.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
