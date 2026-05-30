"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { titleForDays } from "@/lib/titles";
import type { ClanStat, LocationWithStats } from "@/lib/types";

const MY_CLAN_KEY = "gongsjang_clan"; // 체크인 시 저장한 소속 문파 id
const MY_NICK_KEY = "gongsjang_nickname"; // 체크인/기록 시 저장한 닉네임

// 선택 장소의 점령 현황 (마커 클릭 시 on-demand 집계)
type Occupation = {
  recent: number; // 최근 14일 방문 수
  share: number; // 우세 문파 점령률 %
  guardian: string | null; // 이 구역 최다 방문자(관장)
  lastDaysAgo: number | null; // 최근 활동(며칠 전)
  since: string | null; // 점령 시작일
  takeovers: number; // 탈환 횟수(이전 점령자가 있던 점령 변경)
};

declare global {
  interface Window {
    kakao: any;
  }
}

function maskKey(k: string) {
  if (k.length <= 8) return k;
  return `${k.slice(0, 4)}…${k.slice(-4)} (len=${k.length})`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function loadKakaoScript(appKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => resolve());
      return;
    }
    const existing = document.getElementById("kakao-map-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () =>
        window.kakao.maps.load(() => resolve()),
      );
      return;
    }
    const src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    const script = document.createElement("script");
    script.id = "kakao-map-sdk";
    script.async = true;
    script.src = src;
    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) {
        reject(
          new Error(
            `Kakao SDK 응답은 받았지만 초기화 실패. ` +
              `origin=${window.location.origin} key=${maskKey(appKey)}`,
          ),
        );
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = () => {
      reject(
        new Error(
          `Kakao SDK 로드 실패. ` +
            `origin=${window.location.origin} key=${maskKey(appKey)}`,
        ),
      );
    };
    document.head.appendChild(script);
  });
}

// 무주공산(점령 안 된 장소) 기본색 — arcade-muted 회색
const VACANT_COLOR = "#888fa0";

// 연속 방문일 (최신일 기준 역산, 오늘/어제 끊기면 0)
function streakOf(daySet: Set<string>): number {
  if (daySet.size === 0) return 0;
  const dayMs = 86_400_000;
  const epochs = [...daySet].map((s) => new Date(`${s}T00:00:00Z`).getTime());
  const latest = Math.max(...epochs);
  const today = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) + "T00:00:00Z",
  ).getTime();
  if (today - latest > dayMs) return 0;
  let streak = 0;
  let cur = latest;
  while (daySet.has(new Date(cur).toISOString().slice(0, 10))) {
    streak++;
    cur -= dayMs;
  }
  return streak;
}

// "#rrggbb" → "r, g, b" (마커 CSS 변수 --tier-rgb 용). 실패 시 회색.
function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return "136, 143, 160";
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

function tierOf(count: number) {
  if (count >= 3) return "hot" as const;
  if (count > 0) return "active" as const;
  return "new" as const;
}

const PULLUP_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="6" x2="6" y2="22"/><line x1="18" y1="6" x2="18" y2="22"/></svg>`;

type LocateState = "idle" | "scanning" | "locked" | "error";
const LOCATE_LABEL: Record<LocateState, string> = {
  idle: "LOCATE",
  scanning: "SCANNING",
  locked: "LOCKED",
  error: "NO SIGNAL",
};

function CrosshairIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

type MarkerOverlayEntry = {
  id: string;
  el: HTMLElement;
  overlay: any;
  onClick: (e: Event) => void;
};

// 성능 로그 — 개발 모드에서만 (프로덕션 무부하)
const PERF = process.env.NODE_ENV !== "production";

export default function KakaoMap({
  locations,
  stagesCount,
  clanStats = [],
  activity = [],
}: {
  locations: LocationWithStats[];
  stagesCount?: number;
  clanStats?: ClanStat[];
  activity?: string[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const myPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const myMarkerOverlayRef = useRef<any>(null);
  const myMarkerElRef = useRef<HTMLElement | null>(null);
  const markerOverlaysRef = useRef<MarkerOverlayEntry[]>([]);
  // selected.id 를 ref 로도 들고 있어 마커 effect(B)가 selected 에 의존하지 않게 함
  const selectedIdRef = useRef<string | null>(null);
  const mapClickListenerRef = useRef<(() => void) | null>(null);
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<LocationWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locateState, setLocateState] = useState<LocateState>("idle");
  const [occupation, setOccupation] = useState<Occupation | null>(null);
  const [myClanId, setMyClanId] = useState<string | null>(null);
  const [myNick, setMyNick] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<{
    title: string;
    level: number;
    places: number;
    streak: number;
    visits: number;
  } | null>(null);
  const [tickerIdx, setTickerIdx] = useState(0);

  // 내 소속 문파(체크인 시 저장) — 클라이언트에서만
  useEffect(() => {
    setMyClanId(localStorage.getItem(MY_CLAN_KEY));
  }, []);

  // 내 닉네임 → 방문일 기반 칭호/계급 + 미션 판정 지표. 초기 렌더 비차단(1쿼리).
  useEffect(() => {
    const nick = localStorage.getItem(MY_NICK_KEY);
    setMyNick(nick);
    if (!nick) return;
    let cancelled = false;
    createSupabaseBrowserClient()
      .from("visits")
      .select("visited_on, location_id")
      .eq("nickname", nick)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data as { visited_on: string; location_id: string }[] | null) ?? [];
        const daySet = new Set(rows.map((v) => v.visited_on));
        const days = daySet.size;
        setMyStats({
          title: titleForDays(days),
          level: Math.floor(days / 5) + 1,
          places: new Set(rows.map((v) => v.location_id)).size,
          streak: streakOf(daySet),
          visits: rows.length,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 실시간 활동 피드 — 천천히 순환
  useEffect(() => {
    if (activity.length < 2) return;
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % activity.length), 3500);
    return () => clearInterval(t);
  }, [activity.length]);

  // 세력권 glow 레이어 — 문파별 점령지 중심에 부드러운 광역 glow.
  // 마커와 별개로 항상 표시(culling X) → 줌아웃·빈 지도에서도 세력 분포 체감. 문파 수만큼만.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao) return;
    const { kakao } = window;
    const map = mapRef.current;
    const agg = new Map<string, { color: string; sLat: number; sLng: number; n: number }>();
    for (const loc of locations) {
      if (!loc.clan) continue;
      const k = loc.clan.name;
      const e = agg.get(k) ?? { color: loc.clan.color, sLat: 0, sLng: 0, n: 0 };
      e.sLat += loc.lat;
      e.sLng += loc.lng;
      e.n += 1;
      agg.set(k, e);
    }
    const overlays: any[] = [];
    for (const e of agg.values()) {
      const size = Math.min(70 + e.n * 6, 240);
      const el = document.createElement("div");
      el.className = "gj-territory";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.setProperty("--clan", e.color);
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(e.sLat / e.n, e.sLng / e.n),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 0,
      });
      ov.setMap(map);
      overlays.push(ov);
    }
    return () => overlays.forEach((o) => o.setMap(null));
  }, [mapReady, locations]);

  // 선택 장소의 점령 현황을 on-demand 집계 (최근 14일 방문). 초기 로딩엔 영향 없음.
  useEffect(() => {
    if (!selected) {
      setOccupation(null);
      return;
    }
    let cancelled = false;
    const sinceDay = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const supabase = createSupabaseBrowserClient();
    const sel = selected.id;
    Promise.all([
      supabase
        .from("visits")
        .select("clan_id, nickname, visited_on")
        .eq("location_id", sel)
        .gte("visited_on", sinceDay),
      supabase
        .from("occupation_log")
        .select("occupied_at, prev_clan_id")
        .eq("location_id", sel)
        .order("occupied_at", { ascending: false }),
    ]).then(([v, l]) => {
      if (cancelled) return;
      const rows = (v.data as { clan_id: string; nickname: string; visited_on: string }[]) ?? [];
      const log = (l.data as { occupied_at: string; prev_clan_id: string | null }[]) ?? [];
      const since = log[0]?.occupied_at?.slice(0, 10) ?? null;
      const takeovers = log.filter((x) => x.prev_clan_id).length;
      if (rows.length === 0) {
        setOccupation({ recent: 0, share: 0, guardian: null, lastDaysAgo: null, since, takeovers });
        return;
      }
      const byClan = new Map<string, number>();
      const byNick = new Map<string, number>();
      let last = "";
      for (const r of rows) {
        byClan.set(r.clan_id, (byClan.get(r.clan_id) ?? 0) + 1);
        byNick.set(r.nickname, (byNick.get(r.nickname) ?? 0) + 1);
        if (r.visited_on > last) last = r.visited_on;
      }
      const topClan = [...byClan.values()].sort((a, b) => b - a)[0] ?? 0;
      const guardian = [...byNick.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const lastDaysAgo = Math.round((Date.now() - new Date(`${last}T00:00:00Z`).getTime()) / 86_400_000);
      setOccupation({
        recent: rows.length,
        share: Math.round((topClan / rows.length) * 100),
        guardian,
        lastDaysAgo,
        since,
        takeovers,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // 우세 문파 + 내 문파 순위 (clanStats 파생)
  const topClan = clanStats[0] && clanStats[0].count > 0 ? clanStats[0] : null;
  const totalOccupied = useMemo(() => clanStats.reduce((a, c) => a + c.count, 0), [clanStats]);
  const myRankIdx = myClanId ? clanStats.findIndex((c) => c.id === myClanId) : -1;
  const myClan = myRankIdx >= 0 ? clanStats[myRankIdx] : null;

  // === Effect A: 지도 초기화 (마운트 1회) =================================
  // - Kakao SDK 로드 → Map 생성 → 지도 click 리스너 → 현재 위치 1회 조회
  // - cleanup에서 listener 제거, 현재 위치 overlay setMap(null), mapRef 초기화
  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!appKey) {
      setError("NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수를 설정해주세요.");
      return;
    }
    let cancelled = false;

    loadKakaoScript(appKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const { kakao } = window;

        // 이미 만든 맵이 있으면 그대로 재사용 (StrictMode 등에서 안전)
        if (!mapRef.current) {
          const map = new kakao.maps.Map(containerRef.current, {
            // 기본 중심: 청주시청 (활성 지역 청주·오송 기준)
            center: new kakao.maps.LatLng(36.6424, 127.489),
            level: 5,
          });
          mapRef.current = map;

          const onMapClick = () => setSelected(null);
          kakao.maps.event.addListener(map, "click", onMapClick);
          mapClickListenerRef.current = onMapClick;
        }

        // 현재 위치 1회만 (이미 받았으면 스킵)
        if (!myMarkerOverlayRef.current && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled || !mapRef.current) return;
              const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              myPosRef.current = here;

              const meEl = document.createElement("div");
              meEl.className = "gj-here";
              meEl.innerHTML = `
                <span class="gj-here-pulse"></span>
                <span class="gj-here-pulse gj-here-pulse-2"></span>
                <span class="gj-here-core"></span>
              `;
              const overlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(here.lat, here.lng),
                content: meEl,
                yAnchor: 0.5,
                xAnchor: 0.5,
                zIndex: 100,
              });
              overlay.setMap(mapRef.current);
              myMarkerOverlayRef.current = overlay;
              myMarkerElRef.current = meEl;
            },
            () => {},
            { enableHighAccuracy: true, timeout: 5000 },
          );
        }

        setMapReady(true);
      })
      .catch((e) => setError(e.message ?? "지도 로드 실패"));

    return () => {
      cancelled = true;

      // 지도 click 리스너 명시적 제거
      if (mapRef.current && window.kakao && mapClickListenerRef.current) {
        window.kakao.maps.event.removeListener(
          mapRef.current,
          "click",
          mapClickListenerRef.current,
        );
        mapClickListenerRef.current = null;
      }

      // 현재 위치 overlay 분리
      if (myMarkerOverlayRef.current) {
        myMarkerOverlayRef.current.setMap(null);
        myMarkerOverlayRef.current = null;
      }
      myMarkerElRef.current = null;

      // 카카오 Map은 별도 dispose 메서드가 없음 — 컨테이너 정리에 맡김
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // === Effect B: viewport 내부 마커만 렌더 (성능 최적화) =====================
  // - 전체 locations 중 현재 지도 bounds 안의 것만 화면에 attach
  // - overlay 는 pool 에 보관해 재사용 (화면 밖이면 detach 하되 폐기 X → DOM/리스너 재생성 방지)
  // - idle → debounce(120ms) → requestAnimationFrame 으로 pan 중 연속 재계산 방지
  // - bounds 는 LatLng/contain 대신 SW/NE 수치 비교 (객체 할당 제거)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao) return;
    const { kakao } = window;
    const map = mapRef.current;
    const MAX_VISIBLE = 400; // 동시에 화면에 붙는 최대 마커 (현재 비주얼 유지 위해 그대로)
    const POOL_MAX = 1200; // 재사용 pool 상한 — 초과분(화면 밖)은 폐기해 메모리 누수 방지

    const makeEntry = (loc: LocationWithStats): MarkerOverlayEntry => {
      const tier = tierOf(loc.recordCount);
      const el = document.createElement("div");
      el.className = "gj-marker";
      el.dataset.tier = tier;
      el.dataset.selected = loc.id === selectedIdRef.current ? "true" : "false";
      el.dataset.occupied = loc.clan ? "true" : "false"; // 점령 마커 강조용
      // 점령 문파색 / 무주공산 회색 — 마커 CSS 변수만 덮어써 구조·감성 유지
      const clanColor = loc.clan?.color ?? VACANT_COLOR;
      el.style.setProperty("--tier-color", clanColor);
      el.style.setProperty("--tier-rgb", hexToRgb(clanColor));
      const chipHtml =
        loc.recordCount > 0
          ? `<span class="gj-marker-chip" aria-label="기록 ${loc.recordCount}회">★${loc.recordCount}</span>`
          : `<span class="gj-marker-chip" data-variant="new" aria-label="신규">NEW</span>`;
      el.innerHTML = `
        <div class="gj-marker-icon" aria-label="${escapeHtml(loc.name)}">
          ${PULLUP_SVG}
          ${chipHtml}
          <span class="gj-marker-icon-ring"></span>
        </div>
        <div class="gj-marker-base"></div>
      `;
      const onClick = (e: Event) => {
        e.stopPropagation();
        setSelected(loc);
        map.panTo(new kakao.maps.LatLng(loc.lat, loc.lng));
      };
      el.addEventListener("click", onClick);
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(loc.lat, loc.lng),
        content: el,
        yAnchor: 1,
        xAnchor: 0.5,
        clickable: true,
      });
      return { id: loc.id, el, overlay, onClick };
    };

    const pool = new Map<string, MarkerOverlayEntry>(); // 생성된 모든 overlay (재사용)
    const onMap = new Set<string>(); // 현재 map 에 attach 된 id
    let last = { sw: NaN, sn: NaN, ne: NaN, nn: NaN }; // 직전 bounds (동일하면 skip)

    let chunkRaf = 0; // 진행 중인 chunk 렌더 rAF
    let seq = 0; // 렌더 토큰 — 새 렌더가 시작되면 이전 chunk 폐기
    let firstLogged = false;
    const tEffect =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const computeAndRender = () => {
      const mySeq = ++seq;
      if (chunkRaf) {
        cancelAnimationFrame(chunkRaf);
        chunkRaf = 0;
      }

      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const swLat = sw.getLat();
      const swLng = sw.getLng();
      const neLat = ne.getLat();
      const neLng = ne.getLng();

      // bounds 가 직전과 같으면 재계산 skip
      if (swLat === last.sw && swLng === last.sn && neLat === last.ne && neLng === last.nn) {
        return;
      }
      last = { sw: swLat, sn: swLng, ne: neLat, nn: neLng };

      // viewport 안의 대상 id (LatLng/contain 대신 수치 비교, cap)
      const targetIds = new Set<string>();
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        if (loc.lat >= swLat && loc.lat <= neLat && loc.lng >= swLng && loc.lng <= neLng) {
          targetIds.add(loc.id);
          if (targetIds.size >= MAX_VISIBLE) break;
        }
      }

      // 화면 밖 → detach (DOM 은 setMap(null) 로 문서에서 제거, 객체는 pool 보존)
      for (const id of onMap) {
        if (!targetIds.has(id)) {
          pool.get(id)?.overlay.setMap(null);
          onMap.delete(id);
        }
      }

      // 신규 attach 대상 수집 → chunk 렌더 (긴 동기 작업 방지: TBT↓, 프레임드랍↓)
      const toAttach: LocationWithStats[] = [];
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        if (targetIds.has(loc.id) && !onMap.has(loc.id)) toAttach.push(loc);
      }

      const CHUNK = 120;
      let idx = 0;
      const flush = () => {
        if (mySeq !== seq) return; // 더 최신 렌더가 시작됨 → 폐기
        const end = Math.min(idx + CHUNK, toAttach.length);
        for (; idx < end; idx++) {
          const loc = toAttach[idx];
          let entry = pool.get(loc.id);
          if (!entry) {
            entry = makeEntry(loc);
            pool.set(loc.id, entry);
          }
          entry.el.dataset.selected = loc.id === selectedIdRef.current ? "true" : "false";
          entry.overlay.setMap(map);
          onMap.add(loc.id);
        }
        if (idx < toAttach.length) {
          chunkRaf = requestAnimationFrame(flush);
          return;
        }
        chunkRaf = 0;

        // pool 상한 초과분(화면 밖)부터 폐기 — 메모리 누수 방지
        if (pool.size > POOL_MAX) {
          for (const [id, entry] of pool) {
            if (pool.size <= POOL_MAX) break;
            if (onMap.has(id)) continue;
            entry.overlay.setMap(null);
            entry.el.removeEventListener("click", entry.onClick);
            pool.delete(id);
          }
        }
        markerOverlaysRef.current = Array.from(onMap, (id) => pool.get(id)!);

        if (PERF && !firstLogged) {
          firstLogged = true;
          const ms =
            (typeof performance !== "undefined" ? performance.now() : Date.now()) - tEffect;
          console.log(
            `[map] initial render ${ms.toFixed(0)}ms · visible ${onMap.size} · total ${locations.length}`,
          );
        }
      };
      flush();
    };

    // idle → debounce(120ms) → rAF (pan/zoom 중 연속 재계산 방지)
    // 단, 최초 idle 은 디바운스 없이 즉시 렌더(초기 마커 지연 방지)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;
    let firstIdle = true;
    const renderNextFrame = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        computeAndRender();
      });
    };
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        renderNextFrame();
      }, 120);
    };

    // 첫 마커 중심 1회 (사용자 위치 없을 때만). overlay 생성은 idle 이후로 미룸.
    if (locations[0] && !myPosRef.current) {
      map.setCenter(new kakao.maps.LatLng(locations[0].lat, locations[0].lng));
    }

    const onIdle = () => {
      if (firstIdle) {
        firstIdle = false;
        renderNextFrame();
      } else {
        schedule();
      }
    };
    kakao.maps.event.addListener(map, "idle", onIdle);

    return () => {
      kakao.maps.event.removeListener(map, "idle", onIdle);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (rafId) cancelAnimationFrame(rafId);
      if (chunkRaf) cancelAnimationFrame(chunkRaf);
      for (const entry of pool.values()) {
        entry.overlay.setMap(null);
        entry.el.removeEventListener("click", entry.onClick);
      }
      pool.clear();
      onMap.clear();
      markerOverlaysRef.current = [];
    };
    // selected 는 deps 에서 제외 — 마커 재생성 트리거 금지 (selectedIdRef + Effect C 로 동기화)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, locations]);

  // === Effect C: selected → DOM data-selected 동기화 =========================
  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
    markerOverlaysRef.current.forEach(({ id, el }) => {
      el.dataset.selected = id === selected?.id ? "true" : "false";
    });
  }, [selected]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.kakao) return;

    if (locateTimerRef.current) clearTimeout(locateTimerRef.current);

    const triggerBurst = () => {
      const el = myMarkerElRef.current;
      if (!el) return;
      el.dataset.burst = "false";
      // force reflow → 다시 true로 켜야 애니메이션 재시작
      void el.offsetWidth;
      el.dataset.burst = "true";
      setTimeout(() => {
        if (el.dataset.burst === "true") el.dataset.burst = "false";
      }, 1300);
    };

    const onLocked = () => {
      setLocateState("locked");
      triggerBurst();
      locateTimerRef.current = setTimeout(() => setLocateState("idle"), 1400);
    };

    const onError = () => {
      setLocateState("error");
      locateTimerRef.current = setTimeout(() => setLocateState("idle"), 1800);
    };

    setLocateState("scanning");

    if (myPosRef.current) {
      map.panTo(
        new window.kakao.maps.LatLng(
          myPosRef.current.lat,
          myPosRef.current.lng,
        ),
      );
      // panTo는 즉시 시작되니 시각적 여운만 0.7초 후 LOCKED
      locateTimerRef.current = setTimeout(onLocked, 700);
      return;
    }

    if (!navigator.geolocation) {
      onError();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        myPosRef.current = here;
        map.panTo(new window.kakao.maps.LatLng(here.lat, here.lng));
        locateTimerRef.current = setTimeout(onLocked, 700);
      },
      () => onError(),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }, []);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="text-sm font-bold text-arcade-danger">지도 로드 실패</div>
        <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all rounded border border-arcade-danger/40 bg-arcade-panel p-3 text-left text-[10px] text-arcade-danger">
          {error}
        </pre>
      </div>
    );
  }

  // locations 변경 시에만 합산 (selected/locateState 등 잦은 리렌더에서 재계산 방지)
  const totalChallenges = useMemo(
    () => locations.reduce((a, l) => a + l.recordCount, 0),
    [locations],
  );
  const distance =
    selected && myPosRef.current
      ? distanceKm(myPosRef.current, { lat: selected.lat, lng: selected.lng })
      : null;

  return (
    <div className="relative isolate h-[calc(100dvh-100px)] w-full overflow-hidden bg-arcade-bg">
      {/* MAP — z-0으로 카카오 내부 스택 컨텍스트 격리 */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* 비네트 */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(10,10,15,0.55)_100%)]" />

      {/* 스캔라인 (인디게임 톤) */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 3px)",
        }}
      />

      {/* 상단 영역: selected 있으면 STAGE 정보 카드, 없으면 HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3">
        {selected ? (
          <SelectedHeader
            key={selected.id}
            location={selected}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="pointer-events-auto space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="arcade-card bg-arcade-panel/85 px-3 py-1.5 backdrop-blur">
                <div className="arcade-label">STAGES</div>
                <div className="font-display flex items-baseline whitespace-nowrap leading-none text-arcade-accent tabular-nums [font-size:clamp(0.95rem,5vw,1.25rem)] tracking-tight">
                  {(stagesCount ?? locations.length).toLocaleString("ko-KR")}
                  <span className="ml-1 text-[10px] text-zinc-400">곳</span>
                </div>
              </div>
              <div className="arcade-card bg-arcade-panel/85 px-3 py-1.5 backdrop-blur">
                <div className="arcade-label">CHALLENGES</div>
                <div className="font-display text-xl leading-none text-arcade-neon tabular-nums">
                  {totalChallenges}
                  <span className="ml-1 text-[10px] text-zinc-400">회</span>
                </div>
              </div>
            </div>
            {/* 내 정보 — 현재 문파 · 계급 · 내 문파 점령 수 */}
            <div className="arcade-card flex flex-wrap items-center gap-x-2 gap-y-0.5 bg-arcade-panel/85 px-3 py-1.5 backdrop-blur">
              {myClan ? (
                <>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: myClan.color, boxShadow: `0 0 6px ${myClan.color}` }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-[11px]" style={{ color: myClan.color }}>
                    {myClan.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-arcade-neon">
                    {myStats?.title ?? "수련생"} Lv{myStats?.level ?? 1}
                  </span>
                  <span className="ml-auto shrink-0 text-[9px] tracking-arcade text-zinc-400">
                    점령{" "}
                    <span className="font-display text-arcade-accent tabular-nums">
                      {myClan.count}
                    </span>{" "}
                    · {myRankIdx + 1}위
                  </span>
                </>
              ) : (
                <span className="text-[10px] tracking-arcade text-zinc-400">
                  미입단 — 철봉을 방문해 문파에 입단하라
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LOCATE — GPS 레이더 버튼 */}
      <button
        onClick={recenter}
        disabled={locateState === "scanning"}
        data-state={locateState}
        aria-label={`현재 위치 — ${LOCATE_LABEL[locateState]}`}
        className="gj-locate absolute right-3 top-[88px] z-20 backdrop-blur"
      >
        <span className="gj-locate-icon">
          <CrosshairIcon />
        </span>
        <span>{LOCATE_LABEL[locateState]}</span>
      </button>

      {/* 프로필 진입 — 내 칭호/계급 (체크인한 적 있으면 노출) */}
      {!selected && myNick && (
        <Link
          href={`/u/${encodeURIComponent(myNick)}`}
          aria-label={`내 프로필 — ${myNick}`}
          className="arcade-card-tap absolute right-3 top-[138px] z-20 flex max-w-[44vw] items-center gap-1.5 bg-arcade-panel/85 px-2.5 py-1.5 backdrop-blur"
        >
          <span className="arcade-label shrink-0">내</span>
          <span className="min-w-0 truncate text-[11px] text-arcade-neon">
            {myStats?.title ?? myNick}
          </span>
          {myStats && (
            <span className="font-display shrink-0 text-[11px] leading-none text-zinc-400 tabular-nums">
              LV{myStats.level}
            </span>
          )}
          <span className="shrink-0 text-[10px] text-zinc-500">▸</span>
        </Link>
      )}

      {/* DOMINANT — 현재 우세 문파 / 점령률 / 최근 활동 */}
      {!selected && topClan && (
        <div className="pointer-events-none absolute right-3 top-[180px] z-20 w-[40vw] max-w-[160px]">
          <div className="arcade-card bg-arcade-panel/85 px-2.5 py-2 backdrop-blur">
            <div className="arcade-label-wide" style={{ color: topClan.color }}>
              DOMINANT
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: topClan.color, boxShadow: `0 0 6px ${topClan.color}` }}
                aria-hidden
              />
              <span className="truncate text-xs" style={{ color: topClan.color }}>
                {topClan.name}
              </span>
            </div>
            <div className="mt-1 text-[9px] tracking-arcade text-zinc-500">
              점령률{" "}
              <span className="font-display text-sm text-arcade-accent tabular-nums">
                {totalOccupied ? Math.round((topClan.count / totalOccupied) * 100) : 0}%
              </span>
            </div>
            {activity[0] && (
              <div className="mt-1 border-t border-arcade-border pt-1 text-[9px] leading-tight text-zinc-400">
                <span className="text-arcade-danger/90">최근 </span>
                <span className="line-clamp-2">{activity[0]}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEXT MISSION + 실시간 활동 피드 */}
      {!selected && mapReady && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 space-y-2">
          {!(
            (myStats?.places ?? 0) >= 1 &&
            (myStats?.visits ?? 0) >= 1 &&
            (myStats?.streak ?? 0) >= 3
          ) && (
            <div className="arcade-card bg-arcade-panel/85 px-3 py-2 backdrop-blur">
              <div className="arcade-label-wide text-arcade-accent">NEXT MISSION</div>
              <ul className="mt-1 space-y-0.5 text-[10px] tracking-arcade">
                {[
                  { ok: (myStats?.places ?? 0) >= 1, t: "장소 1곳 방문" },
                  { ok: (myStats?.visits ?? 0) >= 1, t: "첫 점령 참여" },
                  { ok: (myStats?.streak ?? 0) >= 3, t: "연속 방문 3일" },
                ].map((m, i) => (
                  <li key={i} className={m.ok ? "text-arcade-neon" : "text-zinc-400"}>
                    {m.ok ? "■" : "□"} {m.t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="arcade-card truncate bg-arcade-panel/80 px-3 py-2 text-center text-[11px] tracking-arcade text-zinc-400 backdrop-blur">
            {activity.length ? (
              <>
                <span className="text-arcade-danger/90">▣ </span>
                {activity[tickerIdx % activity.length]}
              </>
            ) : (
              "▼ 마커를 눌러 STAGE INFO 열기"
            )}
          </div>
        </div>
      )}

      {/* 하단 시트 */}
      {selected && (
        <StageSheet
          location={selected}
          distance={distance}
          occupation={occupation}
          onClose={() => setSelected(null)}
          onChallenge={() => router.push(`/locations/${selected.id}`)}
        />
      )}
    </div>
  );
}

function SelectedHeader({
  location,
  onClose,
}: {
  location: LocationWithStats;
  onClose: () => void;
}) {
  const tier = tierOf(location.recordCount);
  const tierClass =
    tier === "hot"
      ? "border-arcade-danger text-arcade-danger"
      : tier === "active"
        ? "border-arcade-accent text-arcade-accent"
        : "border-arcade-neon text-arcade-neon";

  return (
    <div className="pointer-events-auto animate-[gj-slide-down_0.18s_ease-out]">
      <div className="arcade-card border-2 border-arcade-accent bg-arcade-panel/95 px-3 py-2.5 shadow-arcade-glow backdrop-blur">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="arcade-chip border-arcade-accent text-arcade-accent">
                STAGE
              </span>
              {location.recordCount === 0 && (
                <span className="arcade-chip border-arcade-neon text-arcade-neon">
                  NEW
                </span>
              )}
            </div>
            <h3 className="arcade-title mt-1.5 truncate text-sm font-bold text-arcade-accent">
              {location.name}
            </h3>
            {location.address && (
              <div className="truncate text-[10px] text-zinc-400">
                {location.address}
              </div>
            )}
          </div>
          {location.recordCount > 0 && (
            <div className="shrink-0 text-right">
              <div className="arcade-label">SCORE</div>
              <div className={`text-base font-bold ${tierClass.split(" ")[1]}`}>
                ★{location.recordCount}
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="arcade-btn-ghost shrink-0 px-1.5 py-0.5 text-[10px] leading-none"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function StageSheet({
  location,
  distance,
  occupation,
  onClose,
  onChallenge,
}: {
  location: LocationWithStats;
  distance: number | null;
  occupation: Occupation | null;
  onClose: () => void;
  onChallenge: () => void;
}) {
  const tier = tierOf(location.recordCount);
  const tierLabel = tier === "hot" ? "HOT" : tier === "active" ? "ACTIVE" : "NEW";
  const tierClass =
    tier === "hot"
      ? "border-arcade-danger text-arcade-danger"
      : tier === "active"
        ? "border-arcade-accent text-arcade-accent"
        : "border-arcade-neon text-arcade-neon";

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 animate-[gj-slide-up_0.22s_ease-out]">
      <div className="border-t border-arcade-accent bg-arcade-panel/95 px-4 pb-4 pt-3 shadow-[0_-6px_24px_rgba(255,210,63,0.18)] backdrop-blur">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-arcade-border" />

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`arcade-chip ${tierClass}`}>{tierLabel}</span>
            {/* 점령전 — 현재 점령 문파 (무주공산이면 회색) */}
            {location.clan ? (
              <span
                className="arcade-chip truncate"
                style={{ borderColor: location.clan.color, color: location.clan.color }}
              >
                {location.clan.name}
              </span>
            ) : (
              <span className="arcade-chip border-arcade-border text-zinc-500">
                무주공산
              </span>
            )}
            <span className="arcade-label-wide">STAGE INFO</span>
          </div>
          <span className="arcade-label shrink-0">지도 탭 ▸ 닫기</span>
        </div>

        {/* 점령 현황 — 최근 14일 + 점령 이력 (클릭 시 로드) */}
        {occupation && (occupation.recent > 0 || occupation.since) && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-arcade-border bg-arcade-inset px-3 py-2 text-[10px] tracking-arcade text-zinc-400">
            <span>
              점령률{" "}
              <span className="font-display text-sm text-arcade-accent tabular-nums">
                {occupation.share}%
              </span>
            </span>
            <span>
              최근방문{" "}
              <span className="font-display text-sm text-arcade-neon tabular-nums">
                {occupation.recent}
              </span>
              회
            </span>
            {occupation.guardian && (
              <span className="min-w-0 truncate">
                관장 <span className="text-zinc-200">{occupation.guardian}</span>
              </span>
            )}
            <span>
              탈환{" "}
              <span className="font-display text-sm text-arcade-danger tabular-nums">
                {occupation.takeovers}
              </span>
              회
            </span>
            {occupation.since && (
              <span className="w-full text-zinc-500">
                점령 시작 <span className="text-zinc-300">{occupation.since}</span>
                {occupation.lastDaysAgo != null &&
                  ` · ${occupation.lastDaysAgo === 0 ? "오늘 활동" : `${occupation.lastDaysAgo}일 전 활동`}`}
              </span>
            )}
          </div>
        )}

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="arcade-stat p-2">
            <div className="arcade-label">HIGH SCORE</div>
            {location.topPullup ? (
              <>
                <div className="font-display text-lg leading-none text-arcade-accent tabular-nums">
                  {location.topPullup.value}
                  <span className="ml-0.5 text-[9px] text-zinc-400">회</span>
                </div>
                <div className="truncate text-[9px] text-zinc-500">
                  {location.topPullup.nickname}
                </div>
              </>
            ) : (
              <div className="font-display text-lg leading-none text-zinc-600">---</div>
            )}
          </div>
          <div className="arcade-stat p-2">
            <div className="arcade-label">CHALLENGERS</div>
            <div className="font-display text-lg leading-none text-arcade-neon tabular-nums">
              {location.recordCount}
              <span className="ml-0.5 text-[9px] text-zinc-400">명</span>
            </div>
          </div>
          <div className="arcade-stat p-2">
            <div className="arcade-label">DISTANCE</div>
            <div className="font-display text-lg leading-none text-zinc-200 tabular-nums">
              {distance == null
                ? "--"
                : distance < 1
                  ? `${Math.round(distance * 1000)}m`
                  : `${distance.toFixed(1)}km`}
            </div>
          </div>
        </div>

        <button
          onClick={onChallenge}
          className="arcade-btn-primary font-display w-full py-3 text-lg leading-none tracking-[0.18em]"
        >
          ▶ ENTER STAGE
        </button>
      </div>
    </div>
  );
}
