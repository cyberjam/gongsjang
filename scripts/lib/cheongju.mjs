// 공스장 — 청주·오송 생활권 시드 빌더 공용 유틸
// (Node ESM — 의존성 없이 동작)

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

// ─── 철봉 가능 기구 키워드 ─────────────────────────────────────────
// 운동기구명(exrcEqmtNm)이 다음 중 하나에 매치되면 시드 후보로 채택.
const PULLUP_PATTERNS = [
  /철\s*봉/,
  /턱\s*걸이/,
  /풀\s*업/,
  /현수/,
  /매달리기/,
  /pull[\s_-]?up/i,
  /chin[\s_-]?up/i,
];

export function matchesPullup(name) {
  if (!name || typeof name !== "string") return false;
  return PULLUP_PATTERNS.some((re) => re.test(name));
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
