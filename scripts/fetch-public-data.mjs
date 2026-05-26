// 공스장 — 청주·오송 공공데이터 수집기 (data.go.kr 표준데이터)
//
// 사용:
//   1) .env.local 에 DATA_GO_KR_API_KEY=<디코딩된 원본 키>
//   2) node --env-file=.env.local scripts/fetch-public-data.mjs
//
// 출력:
//   supabase/raw/cheongju-eqmt.json   — 실외운동기구 (15139207)
//   supabase/raw/cheongju-parks.json  — 도시공원   (15012890)
//
// 주의:
//   - data.go.kr 는 "decoded 키"를 받아 서버에서 한 번 decode 함.
//   - .env 에 인코딩된 키(예: %2B 포함)를 넣고 URLSearchParams 가 또 인코딩하면
//     서버 측에서 결과가 어긋나 INVALID_REQUEST_PARAMETER_ERROR.
//   - 본 스크립트는 .env 키가 인코딩돼있어도 자동 normalize 함.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW_KEY = process.env.DATA_GO_KR_API_KEY;

if (!RAW_KEY) {
  console.error(
    "❌ DATA_GO_KR_API_KEY 환경변수 없음.\n" +
      "   .env.local 에 추가 후 `node --env-file=.env.local ...` 로 실행.\n\n" +
      ".env.local 예시:\n" +
      "  DATA_GO_KR_API_KEY=<디코딩된원본키>            # NEXT_PUBLIC_ 접두사 금지\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=<service_role_key>  # 브라우저 노출 금지\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n",
  );
  process.exit(1);
}

// 키 normalize — 인코딩된 형태("%2B" 등)면 한 번 decode 해서 항상 raw 상태로 통일
const looksEncoded = /%[0-9A-Fa-f]{2}/.test(RAW_KEY);
const DECODED_KEY = looksEncoded ? decodeURIComponent(RAW_KEY) : RAW_KEY;

if (looksEncoded) {
  console.warn(
    "⚠️  DATA_GO_KR_API_KEY 가 URL-encoded 같아 자동 decode 후 사용합니다.\n" +
      "    원칙: .env.local 에는 '디코딩된 원본 키'를 넣고, 인코딩은 클라이언트가 한 번만 수행.\n",
  );
}

function maskKey(k) {
  if (!k) return "(empty)";
  return k.length <= 8 ? `${k.slice(0, 4)}***` : `${k.slice(0, 8)}***`;
}

const BASE = "https://api.data.go.kr/openapi";
// data.go.kr 예시 URL이 보여주는 정식 패턴: serviceKey + pageNo + numOfRows + type 만.
// ctprvnNm/signguNm 같은 region 필터를 추가하면 endpoint가 'INVALID_REQUEST_PARAMETER_ERROR' 로
// 거부하므로 전국 raw 를 받아 build-seeds 의 inCheongjuBbox 로 로컬 필터한다.
const PAGE_SIZE = 1000;
const START_PAGE = 1;
const MAX_PAGES = 200; // 안전장치 (총 20만건까지)

function buildUrl(endpoint, paramsObj) {
  // serviceKey 외 파라미터는 URLSearchParams 가 자동 encode (한글 등 정상 처리)
  const otherQs = new URLSearchParams(paramsObj).toString();
  // serviceKey 는 우리가 직접 한 번만 encode (decoded 키 기준)
  const sk = encodeURIComponent(DECODED_KEY);
  return `${BASE}/${endpoint}?serviceKey=${sk}&${otherQs}`;
}

function buildMaskedUrl(endpoint, paramsObj) {
  const otherQs = new URLSearchParams(paramsObj).toString();
  return `${BASE}/${endpoint}?serviceKey=${maskKey(DECODED_KEY)}&${otherQs}`;
}

async function fetchPage(endpoint, pageNo) {
  // data.go.kr 예시 URL 패턴 정확히 일치: serviceKey + pageNo + numOfRows + type
  const paramsObj = {
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  };
  const url = buildUrl(endpoint, paramsObj);
  const maskedUrl = buildMaskedUrl(endpoint, paramsObj);

  console.log(`→ ${maskedUrl}`);

  let res, text;
  try {
    res = await fetch(url);
    text = await res.text();
  } catch (e) {
    return { error: `network: ${e.message}` };
  }

  const ctype = res.headers.get("content-type") || "";
  if (!res.ok) {
    return {
      error: `HTTP ${res.status}`,
      status: res.status,
      ctype,
      preview: text.slice(0, 1000),
    };
  }

  // data.go.kr 가 키 오류 등에서 XML(error) 로 응답하기도 함
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      error: "json parse failed",
      status: res.status,
      ctype,
      preview: text.slice(0, 1000),
    };
  }

  // header.resultCode 검사 — "00" 이 아니면 에러
  const header = json?.response?.header;
  if (header && header.resultCode && header.resultCode !== "00") {
    return {
      error: `data.go.kr ${header.resultCode}: ${header.resultMsg}`,
      status: res.status,
      ctype,
      preview: text.slice(0, 1000),
      resultCode: header.resultCode,
    };
  }

  const body = json?.response?.body;
  if (!body) {
    return {
      error: "no body in response",
      status: res.status,
      ctype,
      preview: text.slice(0, 1000),
    };
  }

  // body.items 가 객체이거나 배열이거나 단일 item 인 케이스 모두 처리
  const rawItems = body.items?.item ?? body.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const totalCount = Number(body.totalCount ?? 0);
  return { items, totalCount };
}

async function fetchAllPages(endpoint) {
  const all = [];
  let pageNo = START_PAGE;

  while (true) {
    const result = await fetchPage(endpoint, pageNo);
    if (result.error) {
      console.error(`❌ ${result.error}`);
      if (result.status) console.error(`   HTTP ${result.status}  content-type=${result.ctype}`);
      if (result.preview)
        console.error(`   body[:1000]:\n${result.preview.replace(/^/gm, "     ")}`);
      diagnose(result);
      break;
    }

    all.push(...result.items);
    console.log(`  +${result.items.length} (누적 ${all.length}/${result.totalCount})\n`);

    if (result.items.length === 0) break;
    if (all.length >= result.totalCount) break;
    pageNo++;
    if (pageNo > MAX_PAGES) {
      console.warn(`  too many pages (>${MAX_PAGES}), stopping (안전장치)`);
      break;
    }
  }

  return all;
}

function diagnose(result) {
  console.error("\n🔍 진단:");
  if (result.resultCode === "10") {
    console.error("   resultCode 10 = INVALID_REQUEST_PARAMETER_ERROR");
    console.error("   가장 흔한 원인 (순서대로 체크):");
    console.error("     1. .env.local 의 DATA_GO_KR_API_KEY 에 인코딩된 키를 넣었음");
    console.error("        → '디코딩(decoded) 키'로 교체 (data.go.kr 마이페이지 → 활용신청 상세 → '일반 인증키 Decoding')");
    console.error("     2. 활용신청 승인 직후 — 5~10분 후 재시도");
    console.error("     3. 알 수 없는 query 파라미터 — 본 스크립트는 region 필터 안 보냄");
  } else if (result.resultCode === "30" || result.resultCode === "22") {
    console.error("   서비스 키 등록되지 않음 — 활용신청 상태 확인");
  } else if (result.resultCode === "31") {
    console.error("   서비스 키 활용기간 만료 — 연장 신청");
  } else if (result.resultCode === "32") {
    console.error("   등록되지 않은 IP — data.go.kr 마이페이지에서 IP 제한 해제");
  } else if (result.resultCode === "33") {
    console.error("   서명되지 않은 호출 — 서비스 키 누락");
  }
}

async function main() {
  const outDir = resolve("supabase/raw");
  mkdirSync(outDir, { recursive: true });

  console.log("=== 키 확인 ===");
  console.log(`  env raw     : ${maskKey(RAW_KEY)}  ${looksEncoded ? "(URL-encoded로 감지됨)" : "(decoded로 간주)"}`);
  console.log(`  실제 사용   : ${maskKey(DECODED_KEY)}  → 요청 시 1회 encode\n`);

  console.log("=== 1. 실외운동기구 (data.go.kr/data/15139207, 전국) ===");
  console.log("   ※ region 필터 없음 — build 단계에서 청주·오송 bbox 로 추림\n");
  const eqmts = await fetchAllPages("tn_pubr_public_outdoor_exercise_eqmt_api");
  // 파일명은 'cheongju' 유지하되 실제론 전국 raw. build 단계가 bbox 필터.
  writeFileSync(`${outDir}/cheongju-eqmt.json`, JSON.stringify(eqmts, null, 2));
  console.log(`→ ${outDir}/cheongju-eqmt.json  (${eqmts.length}건, 전국 raw)\n`);

  console.log("=== 2. 도시공원 (data.go.kr/data/15012890, 전국) ===");
  const parks = await fetchAllPages("tn_pubr_public_cty_park_info_api");
  writeFileSync(`${outDir}/cheongju-parks.json`, JSON.stringify(parks, null, 2));
  console.log(`→ ${outDir}/cheongju-parks.json  (${parks.length}건, 전국 raw)\n`);

  // 0건 명시적 경고
  if (eqmts.length === 0 || parks.length === 0) {
    console.error(
      "⚠️  API returned 0 rows — likely invalid key or encoding issue\n" +
        "    실외운동기구=" + eqmts.length + ", 도시공원=" + parks.length + "\n" +
        "    위 로그의 HTTP/resultCode/응답 본문 확인.\n",
    );
    if (eqmts.length === 0 && parks.length === 0) {
      console.error("    두 API 모두 0건 → 키 또는 활용신청 문제 가능성 99%.\n");
      process.exit(2);
    }
  }

  console.log("다음: npm run seed:build");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
