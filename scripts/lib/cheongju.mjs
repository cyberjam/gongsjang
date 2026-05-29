// 공스장 — 청주·오송 생활권 시드 빌더 공용 유틸
// (Node ESM — 의존성 없이 동작)

import { createHash } from "node:crypto";

// ─── 대한민국 전체 bbox (전국 시드 좌표 검증용) ────────────────────
// 본토 + 제주 + 울릉/독도까지 넉넉히. 좌표 스왑·범위이탈 판정에 사용.
export const KOREA_BBOX = {
  minLat: 33.0,
  maxLat: 39.5,
  minLng: 124.5,
  maxLng: 132.0,
};

export function inKorea(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KOREA_BBOX.minLat &&
    lat <= KOREA_BBOX.maxLat &&
    lng >= KOREA_BBOX.minLng &&
    lng <= KOREA_BBOX.maxLng
  );
}

// 좌표 복구 — data.go.kr 표준데이터의 흔한 예외를 오프라인으로 교정.
//   1) 정상: (lat,lng) 가 한국 bbox 안 → 그대로
//   2) 스왑: lat/lng 가 뒤바뀜(위도 칸에 경도값) → 자동 교환
//   3) 그 외(0,0 / 범위이탈 / 결측): null → 호출측에서 지오코딩 또는 제외
// 반환: { lat, lng, fixed: "ok"|"swap" } | null
export function recoverCoords(latRaw, lngRaw) {
  const la = parseFloat(latRaw);
  const lo = parseFloat(lngRaw);
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    if (inKorea(la, lo)) return { lat: la, lng: lo, fixed: "ok" };
    if (inKorea(lo, la)) return { lat: lo, lng: la, fixed: "swap" };
  }
  return null;
}

// ─── 청주·오송 생활권 bbox (오송/오창/청주 4구 포괄) ───────────────
export const CHEONGJU_BBOX = {
  minLat: 36.45,
  maxLat: 36.80,
  minLng: 127.20,
  maxLng: 127.70,
};

export function inCheongjuBbox(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= CHEONGJU_BBOX.minLat &&
    lat <= CHEONGJU_BBOX.maxLat &&
    lng >= CHEONGJU_BBOX.minLng &&
    lng <= CHEONGJU_BBOX.maxLng
  );
}

// ─── 실외운동기구 raw → 내부 표준 형태 normalize ───────────────────
// data.go.kr 실외운동기구 표준데이터(15139207) 실제 필드명:
//   instlPlcNm(설치장소명) / sprtgdNm(운동기구명) / sprtgdQty(수량)
//   lat(위도) / lot(경도) / lctnRoadNmAddr(도로명) / lctnLotnoAddr(지번)
// 다른 지자체/버전이 표준 약어를 쓸 수도 있어 fallback 도 둔다.
export function normalizeEqmt(raw) {
  return {
    exrcEqmtNm: raw.sprtgdNm ?? raw.exrcEqmtNm ?? raw.exercNm ?? null,
    exrcEqmtQty: raw.sprtgdQty ?? raw.exrcEqmtQty ?? null,
    latitude: raw.lat ?? raw.latitude ?? raw.la ?? null,
    longitude: raw.lot ?? raw.longitude ?? raw.lo ?? null,
    rdnmadr: raw.lctnRoadNmAddr ?? raw.rdnmadr ?? null,
    lnmadr: raw.lctnLotnoAddr ?? raw.lnmadr ?? null,
    instlPlaceNm: raw.instlPlcNm ?? raw.instlPlaceNm ?? null,
  };
}

// ─── 철봉 가능 기구 키워드 ─────────────────────────────────────────
// 운동기구명이 "허리돌리기+사이클+거꾸로매달리기" 처럼 + 로 묶이므로
// 토큰 단위로 검사. "거꾸로매달리기"(거꾸리)는 철봉 아님 → 제외.
const PULLUP_PATTERNS = [
  /철\s*봉/,
  /턱\s*걸이/,
  /풀\s*업/,
  /친\s*업/,
  /현수/,
  /매달리기/,
  /pull[\s_-]?up/i,
  /chin[\s_-]?up/i,
];
const EXCLUDE_TOKEN = /거꾸로|거꾸리|역기|허리|사이클|스텝|윗몸|복근|하늘|노젓기|온몸|어깨|발/;

export function matchesPullup(name) {
  if (!name || typeof name !== "string") return false;
  const tokens = name.split(/[+,/·]/).map((t) => t.trim()).filter(Boolean);
  return tokens.some((tok) => {
    if (EXCLUDE_TOKEN.test(tok)) return false; // 비철봉 기구 토큰 제외
    return PULLUP_PATTERNS.some((re) => re.test(tok));
  });
}

// 운동기구명에서 철봉 관련 토큰만 추출 (description 정리용)
export function pullupTokens(name) {
  if (!name || typeof name !== "string") return [];
  return name
    .split(/[+,/·]/)
    .map((t) => t.trim())
    .filter((tok) => !EXCLUDE_TOKEN.test(tok) && PULLUP_PATTERNS.some((re) => re.test(tok)));
}

// ─── 우선 동네 (도장 밀도 큐레이션 시 참고) ────────────────────────
// 큐레이션 단계에서 verified=true로 마킹할 후보를 판별하는 데 쓸 수 있음.
export const PRIORITY_DONGS = [
  "지북동",
  "율량동",
  "가경동",
  "복대동",
  "오송",
  "오창",
  "무심천",
  "율량천",
];

export function priorityScore(address, name) {
  const blob = `${address ?? ""} ${name ?? ""}`;
  return PRIORITY_DONGS.filter((d) => blob.includes(d)).length;
}

// ─── Haversine 거리 (미터) ─────────────────────────────────────────
const R_EARTH = 6_371_000;
const toRad = (d) => (d * Math.PI) / 180;

export function distanceM(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 *
      Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat));
  return R_EARTH * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── 동/도로명 추출 ─────────────────────────────────────────────────
// 도로명에는 동이 없는 경우가 많음 (예: "율량로 100").
// rdnmadr → lnmadr 순으로 시도해 ○○동/읍/면을 찾는다.
const DONG_RE = /([가-힣]+(?:동|읍|면))(?:\b|[^가-힣])/;

export function extractDong(...addresses) {
  for (const addr of addresses) {
    if (!addr) continue;
    const m = addr.match(DONG_RE);
    if (m) return m[1];
  }
  return null;
}

// ─── 장소명 생성 규칙 ──────────────────────────────────────────────
// 결과: { name, source, generic, original }
//   source: 'park' | 'place' | 'dong' | null
//   generic: true면 큐레이션 필요 (이름이 무미건조)
//   original: 자동 생성 전 instlPlaceNm (before/after 비교용)
//
// 우선순위:
//   1) 120m 이내 도시공원이 있으면 → "○○공원 철봉" (generic: false)
//   2) 설치장소명이 의미 키워드 포함 → "{설치장소명} 철봉" (generic: false)
//   3) 설치장소명 있지만 generic blocklist → 동 fallback으로 (generic: true)
//   4) 도로명 동 → "{○○동} 철봉" (generic: true)
//   5) 이름 못 만들면 null (시드 제외)
//
// 의도: "체육시설 1번" "야외운동기구" 같은 무미건조한 이름을
//        대신 공원·산책로·동 단위로 재명명. 그래도 큐레이션은 사용자 몫.

const PLACE_KEYWORDS = /(공원|광장|체육관|놀이터|호수|쉼터|마당|문화|광장|산책로|둘레길|체력단련장)/;

// 너무 generic해서 그대로 쓰면 안 되는 설치장소명 (rename 대상)
const GENERIC_PLACE_BLOCKLIST = [
  /^운동기구$/,
  /^체육시설$/,
  /^야외운동기구$/,
  /^근린운동기구$/,
  /^운동시설$/,
  /^체육관$/,
  /^주민운동시설$/,
  /^야외체육시설$/,
  /^운동장$/,
  /^생활체육시설$/,
  /^야외생활체육시설$/,
];

function isGenericPlace(name) {
  return GENERIC_PLACE_BLOCKLIST.some((re) => re.test(name));
}

export function buildName({ instlPlaceNm, rdnmadr, lnmadr, lat, lng, parks }) {
  const original = (instlPlaceNm ?? "").trim() || null;

  // 1) 가까운 공원
  if (parks?.length) {
    let best = null;
    let bestD = Infinity;
    for (const p of parks) {
      const d = distanceM({ lat, lng }, p);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best && bestD <= 120) {
      return {
        name: /철봉/.test(best.name) ? best.name : `${best.name} 철봉`,
        source: "park",
        generic: false,
        original,
      };
    }
  }

  // 2) 설치장소명 (의미 키워드 + non-generic)
  if (original && original.length > 1 && !isGenericPlace(original)) {
    if (PLACE_KEYWORDS.test(original)) {
      const name = /철봉/.test(original) ? original : `${original} 철봉`;
      return { name, source: "place", generic: false, original };
    }
    // 의미 키워드 없는 자유 입력 — 일단 채택하되 generic 표시 (검토 권장)
    return { name: `${original} 철봉`, source: "place", generic: true, original };
  }

  // 3+4) 동 fallback (도로명 → 지번 순차 시도)
  const dong = extractDong(rdnmadr, lnmadr);
  if (dong) {
    return { name: `${dong} 철봉`, source: "dong", generic: true, original };
  }

  // 5) 시드 제외
  return { name: null, source: null, generic: true, original };
}

// ─── 외부 ID 생성 ──────────────────────────────────────────────────
// 같은 source(=public_data) 안에서 unique. 재실행 시 같은 행은 같은 ID.

export function eqmtExternalId(eqmt) {
  // 위·경도 + 운동기구명 조합 (4자리 좌표면 약 11m 정밀도)
  const lat = Number(eqmt.latitude).toFixed(5);
  const lng = Number(eqmt.longitude).toFixed(5);
  const nm = (eqmt.exrcEqmtNm ?? "").replace(/\s+/g, "");
  return `eqmt:${lat},${lng}:${nm}`;
}

// 좌표에 의존하지 않는 안정적 external_id.
// 좌표는 스왑 보정·지오코딩으로 재실행마다 달라질 수 있으므로, 중복 방지(dedup)
// 키는 원본의 불변 식별 정보로 만든다.
//   1순위: 표준데이터 관리번호 필드(있으면)
//   2순위: 기구명|도로명|지번|설치장소명 의 sha1 해시
// 같은 장소·같은 기구는 항상 같은 ID → import 시 (source, external_id) 유니크로 dedup.
const MANAGE_NO_FIELDS = ["manageNo", "mngNo", "manage_no", "MGT_NO", "mgtNo"];

export function eqmtStableId(raw, norm) {
  for (const f of MANAGE_NO_FIELDS) {
    const v = raw?.[f];
    if (v != null && String(v).trim()) return `eqmt:mng:${String(v).trim()}`;
  }
  const parts = [norm.exrcEqmtNm, norm.rdnmadr, norm.lnmadr, norm.instlPlaceNm]
    .map((s) => (s ?? "").toString().trim())
    .join("|");
  const h = createHash("sha1").update(parts).digest("hex").slice(0, 16);
  return `eqmt:h:${h}`;
}
