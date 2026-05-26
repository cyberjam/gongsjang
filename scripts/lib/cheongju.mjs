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
const DONG_RE = /([가-힣]+(?:동|읍|면))/;

export function extractDong(address) {
  if (!address) return null;
  return address.match(DONG_RE)?.[1] ?? null;
}

// ─── 장소명 생성 규칙 ──────────────────────────────────────────────
// 우선순위:
//   1) 100m 이내 도시공원이 있으면 → "○○공원 철봉"
//   2) 설치장소명에 의미 있는 키워드(공원/광장/체육 등)가 있으면 → "{설치장소명} 철봉"
//   3) 도로명 주소에서 동 추출 → "{○○동} 철봉"
//   4) fallback → "동네 철봉"
//
// 의도: 자동으로 "○○동 야외운동기구 1번" 같은 무미건조한 이름을 피하고
// "도장스러운" 이름을 생성. 그래도 마지막엔 사용자 수동 큐레이션 필요.

const PLACE_KEYWORDS = /(공원|광장|체육|운동|놀이터|호수|광장|쉼터|마당)/;

export function buildName({ instlPlaceNm, rdnmadr, lnmadr, lat, lng, parks }) {
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
      return `${best.name} 철봉`;
    }
  }

  // 2) 설치장소명
  const place = (instlPlaceNm ?? "").trim();
  if (place && place.length > 1 && place !== "운동기구") {
    if (PLACE_KEYWORDS.test(place)) {
      // 이미 의미 있는 장소명 → 철봉 접미사
      return /철봉/.test(place) ? place : `${place} 철봉`;
    }
    return `${place} 철봉`;
  }

  // 3) 동
  const dong = extractDong(rdnmadr ?? lnmadr);
  if (dong) return `${dong} 철봉`;

  // 4) fallback
  return "동네 철봉";
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
