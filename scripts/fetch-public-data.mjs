// 공스장 — 청주·오송 공공데이터 수집기
// 사용:
//   1) .env.local 에 DATA_GO_KR_API_KEY=... 설정
//   2) node --env-file=.env.local scripts/fetch-public-data.mjs
//
// 출력:
//   supabase/raw/cheongju-eqmt.json   — 실외운동기구 전체 응답
//   supabase/raw/cheongju-parks.json  — 도시공원 전체 응답

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API_KEY = process.env.DATA_GO_KR_API_KEY;
if (!API_KEY) {
  console.error(
    "❌ DATA_GO_KR_API_KEY 환경변수가 없습니다.\n" +
      "   .env.local 에 추가한 뒤 `node --env-file=.env.local ...` 로 실행하세요.",
  );
  process.exit(1);
}

const BASE = "https://api.data.go.kr/openapi";
const REGION = { ctprvnNm: "충청북도", signguNm: "청주시" };
const PAGE_SIZE = 1000;

async function fetchAllPages(endpoint, params) {
  const all = [];
  let pageNo = 1;

  while (true) {
    const qs = new URLSearchParams({
      serviceKey: API_KEY,
      type: "json",
      pageNo: String(pageNo),
      numOfRows: String(PAGE_SIZE),
      ...params,
    });
    const url = `${BASE}/${endpoint}?${qs}`;
    process.stdout.write(`  ${endpoint} pageNo=${pageNo} ... `);

    let res, text;
    try {
      res = await fetch(url);
      text = await res.text();
    } catch (e) {
      console.error(`\n  network error: ${e.message}`);
      break;
    }
    if (!res.ok) {
      console.error(`\n  HTTP ${res.status}: ${text.slice(0, 300)}`);
      break;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // data.go.kr는 키 오류 등에서 XML로 응답하기도 함
      console.error(`\n  JSON parse 실패. 응답 앞 300자:\n${text.slice(0, 300)}`);
      break;
    }

    const body = json?.response?.body;
    if (!body) {
      console.error(
        `\n  unexpected response shape. 응답 앞 500자:\n${text.slice(0, 500)}`,
      );
      break;
    }

    const rawItems = body.items?.item ?? body.items ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    all.push(...items);

    const totalCount = Number(body.totalCount ?? 0);
    console.log(`+${items.length} (누적 ${all.length}/${totalCount})`);
    if (items.length === 0) break;
    if (all.length >= totalCount) break;
    pageNo++;
    if (pageNo > 100) {
      console.warn("  too many pages, stopping (안전장치)");
      break;
    }
  }

  return all;
}

async function main() {
  const outDir = resolve("supabase/raw");
  mkdirSync(outDir, { recursive: true });

  console.log("=== 실외운동기구 ===");
  const eqmts = await fetchAllPages(
    "tn_pubr_public_outdoor_exercise_eqmt_api",
    REGION,
  );
  writeFileSync(
    `${outDir}/cheongju-eqmt.json`,
    JSON.stringify(eqmts, null, 2),
  );
  console.log(`→ ${outDir}/cheongju-eqmt.json (${eqmts.length}건)`);

  console.log("\n=== 도시공원 ===");
  const parks = await fetchAllPages(
    "tn_pubr_public_cty_park_info_api",
    REGION,
  );
  writeFileSync(
    `${outDir}/cheongju-parks.json`,
    JSON.stringify(parks, null, 2),
  );
  console.log(`→ ${outDir}/cheongju-parks.json (${parks.length}건)`);

  console.log("\n다음: node --env-file=.env.local scripts/build-seeds.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
