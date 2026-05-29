// 공스장 — 카카오 주소→좌표 지오코딩 (디스크 캐시 + 레이트리밋)
// (Node ESM — 의존성 없이 동작)
//
// 용도: data.go.kr 표준데이터에서 좌표가 비었거나(0,0/결측) 범위이탈이라
//       recoverCoords 로 살릴 수 없는 행을, 주소 텍스트로 좌표 복구.
//
// 키:   KAKAO_REST_API_KEY (REST API 키 — JS SDK 키와 다름)
//       https://dapi.kakao.com/v2/local/search/address.json
//
// 캐시: supabase/cache/geocode.json
//   - 주소→{lat,lng} 또는 null(known-miss) 저장.
//   - 재실행/추후 갱신 시 같은 주소는 API 재호출 없이 캐시 사용 → 쿼터 절약 + 중복 방지.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { inKorea } from "./cheongju.mjs";

const CACHE_DIR = "supabase/cache";
const CACHE_PATH = `${CACHE_DIR}/geocode.json`;
const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/address.json";

async function callKakao(query, restKey, { retries = 3, timeoutMs = 10000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const url = `${KAKAO_URL}?query=${encodeURIComponent(query)}&size=1`;
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${restKey}` },
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      // 레이트리밋/일시 오류 → 백오프 재시도
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) return null;
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      if (!res.ok) return null; // 401/403 등 → 즉시 포기 (키 문제)

      const json = await res.json();
      const doc = json?.documents?.[0];
      if (!doc) return null;
      const lat = parseFloat(doc.y);
      const lng = parseFloat(doc.x);
      if (!inKorea(lat, lng)) return null;
      return { lat, lng };
    } catch {
      clearTimeout(timer);
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  return null;
}

// 지오코더 생성. restKey 없으면 enabled=false → geocode() 는 캐시만 보고 항상 null
// (빌드가 키 없이도 오프라인으로 끝까지 돌도록).
export function createGeocoder({ restKey, minIntervalMs = 100 } = {}) {
  let cache = {};
  if (existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    } catch {
      cache = {};
    }
  }
  const enabled = Boolean(restKey);
  let dirty = false;
  let lastCall = 0;
  const stats = { hits: 0, apiOk: 0, apiMiss: 0 };

  function flush() {
    if (!dirty) return;
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache));
    dirty = false;
  }

  // 여러 주소 후보를 순서대로 시도 (도로명 → 지번). 첫 성공 좌표 반환.
  async function geocode(...addresses) {
    const queries = addresses
      .map((a) => (a ?? "").toString().trim())
      .filter(Boolean);
    if (queries.length === 0) return null;

    for (const q of queries) {
      if (q in cache) {
        stats.hits++;
        if (cache[q]) return cache[q];
        continue; // known-miss → 다음 후보
      }
      if (!enabled) continue; // 키 없음 → API 호출 불가

      const wait = minIntervalMs - (Date.now() - lastCall);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();

      const result = await callKakao(q, restKey);
      cache[q] = result;
      dirty = true;
      if (result) {
        stats.apiOk++;
        if (stats.apiOk % 50 === 0) flush();
        return result;
      }
      stats.apiMiss++;
    }
    return null;
  }

  return {
    geocode,
    flush,
    enabled,
    stats: () => ({ ...stats, cached: Object.keys(cache).length }),
  };
}
