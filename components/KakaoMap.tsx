"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationWithStats } from "@/lib/types";

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

export default function KakaoMap({ locations }: { locations: LocationWithStats[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const myPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const myMarkerOverlayRef = useRef<any>(null);
  const myMarkerElRef = useRef<HTMLElement | null>(null);
  const markerOverlaysRef = useRef<MarkerOverlayEntry[]>([]);
  const mapClickListenerRef = useRef<(() => void) | null>(null);
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<LocationWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locateState, setLocateState] = useState<LocateState>("idle");

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
            center: new kakao.maps.LatLng(37.5665, 126.978),
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

  // === Effect B: locations 마커 attach/detach =================================
  // - locations 또는 mapReady 변경 시 기존 overlay 전부 setMap(null)로 제거 후 새로 생성
  // - cleanup에서도 동일하게 정리 → 누적 방지의 핵심
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao) return;
    const { kakao } = window;
    const map = mapRef.current;

    // 이전 오버레이 잔존분 완전 분리 (effect 재실행 첫 진입 시)
    markerOverlaysRef.current.forEach(({ overlay, el, onClick }) => {
      overlay.setMap(null);
      el.removeEventListener("click", onClick);
    });
    markerOverlaysRef.current = [];

    const next: MarkerOverlayEntry[] = [];

    locations.forEach((loc) => {
      const tier = tierOf(loc.recordCount);
      const el = document.createElement("div");
      el.className = "gj-marker";
      el.dataset.tier = tier;
      el.dataset.selected = "false";
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
      overlay.setMap(map);

      next.push({ id: loc.id, el, overlay, onClick });
    });

    markerOverlaysRef.current = next;

    // 새로 만든 마커들에 현재 selected 상태 즉시 반영
    next.forEach(({ id, el }) => {
      el.dataset.selected = id === selected?.id ? "true" : "false";
    });

    // 첫 마커 위치로 중심 1회 (사용자 위치 없을 때만)
    if (locations[0] && !myPosRef.current) {
      map.setCenter(new kakao.maps.LatLng(locations[0].lat, locations[0].lng));
    }

    return () => {
      // unmount 또는 deps 변경 직전 — 만들었던 next 배열 분리
      next.forEach(({ overlay, el, onClick }) => {
        overlay.setMap(null);
        el.removeEventListener("click", onClick);
      });
      // 동일한 참조면 ref도 비움 (StrictMode 안전)
      if (markerOverlaysRef.current === next) {
        markerOverlaysRef.current = [];
      }
    };
    // selected는 의도적으로 deps에서 제외 — 마커 재생성 트리거하면 안 됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, locations]);

  // === Effect C: selected → DOM data-selected 동기화 =========================
  useEffect(() => {
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

  const totalChallenges = locations.reduce((a, l) => a + l.recordCount, 0);
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
          <div className="pointer-events-auto grid grid-cols-2 gap-2">
            <div className="arcade-card bg-arcade-panel/85 px-3 py-1.5 backdrop-blur">
              <div className="arcade-label">DOJOS</div>
              <div className="font-display text-xl leading-none text-arcade-phosphor2 tabular-nums">
                {locations.length}
                <span className="ml-1 text-[10px] text-arcade-muted">곳</span>
              </div>
            </div>
            <div className="arcade-card bg-arcade-panel/85 px-3 py-1.5 backdrop-blur">
              <div className="arcade-label">도전자 누적</div>
              <div className="font-display text-xl leading-none text-arcade-amber tabular-nums">
                {totalChallenges}
                <span className="ml-1 text-[10px] text-arcade-muted">회</span>
              </div>
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

      {/* 안내 hint */}
      {!selected && mapReady && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20">
          <div className="arcade-card bg-arcade-panel/80 px-3 py-2 text-center text-[11px] tracking-arcade text-arcade-muted backdrop-blur">
            ▼ 핀을 눌러 도장 정보 열기
          </div>
        </div>
      )}

      {/* 하단 시트 */}
      {selected && (
        <StageSheet
          location={selected}
          distance={distance}
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
  return (
    <div className="pointer-events-auto animate-[gj-slide-down_0.18s_ease-out]">
      <div className="arcade-card border-arcade-phosphor3 bg-arcade-panel/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="arcade-chip border-arcade-border text-arcade-muted">
                DOJO
              </span>
              {location.recordCount === 0 && (
                <span className="arcade-chip border-arcade-phosphor3 text-arcade-phosphor2">
                  무주공산
                </span>
              )}
            </div>
            <h3 className="arcade-title mt-1.5 truncate text-sm font-bold text-arcade-phosphor2">
              {location.name}
            </h3>
            {location.address && (
              <div className="truncate text-[10px] text-arcade-muted">
                {location.address}
              </div>
            )}
          </div>
          {location.recordCount > 0 && (
            <div className="shrink-0 text-right">
              <div className="arcade-label">기록</div>
              <div className="font-display text-base leading-none text-arcade-amber">
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
  onClose,
  onChallenge,
}: {
  location: LocationWithStats;
  distance: number | null;
  onClose: () => void;
  onChallenge: () => void;
}) {
  const tier = tierOf(location.recordCount);
  const tierLabel =
    tier === "hot" ? "마스터 있음" : tier === "active" ? "도전 중" : "무주공산";
  const tierClass =
    tier === "hot"
      ? "border-arcade-amber text-arcade-amber"
      : tier === "active"
        ? "border-arcade-phosphor3 text-arcade-phosphor2"
        : "border-arcade-muted text-arcade-muted";

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 animate-[gj-slide-up_0.22s_ease-out]">
      <div className="border-t border-arcade-phosphor3 bg-arcade-panel/95 px-4 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-arcade-border" />

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`arcade-chip ${tierClass}`}>{tierLabel}</span>
            <span className="arcade-label-wide">도장 정보</span>
          </div>
          <span className="arcade-label">지도 탭 ▸ 닫기</span>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="arcade-stat p-2">
            <div className="arcade-label">마스터 기록</div>
            {location.topPullup ? (
              <>
                <div className="font-display text-lg leading-none text-arcade-amber tabular-nums">
                  {location.topPullup.value}
                  <span className="ml-0.5 text-[9px] text-arcade-muted">회</span>
                </div>
                <div className="truncate text-[9px] text-arcade-muted">
                  {location.topPullup.nickname}
                </div>
              </>
            ) : (
              <div className="font-display text-lg leading-none text-arcade-muted">---</div>
            )}
          </div>
          <div className="arcade-stat p-2">
            <div className="arcade-label">도전자</div>
            <div className="font-display text-lg leading-none text-arcade-phosphor2 tabular-nums">
              {location.recordCount}
              <span className="ml-0.5 text-[9px] text-arcade-muted">명</span>
            </div>
          </div>
          <div className="arcade-stat p-2">
            <div className="arcade-label">거리</div>
            <div className="font-display text-lg leading-none text-zinc-300 tabular-nums">
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
          className="arcade-btn-amber font-display w-full py-3 text-lg leading-none tracking-[0.18em]"
        >
          ▸ 도장 입장
        </button>
      </div>
    </div>
  );
}
