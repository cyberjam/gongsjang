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

export default function KakaoMap({ locations }: { locations: LocationWithStats[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const myPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const myMarkerRef = useRef<any>(null);
  const [selected, setSelected] = useState<LocationWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

        const initialCenter = locations[0]
          ? new kakao.maps.LatLng(locations[0].lat, locations[0].lng)
          : new kakao.maps.LatLng(37.5665, 126.978);

        const map = new kakao.maps.Map(containerRef.current, {
          center: initialCenter,
          level: 5,
        });
        mapRef.current = map;

        locations.forEach((loc) => {
          const tier = tierOf(loc.recordCount);
          const el = document.createElement("div");
          el.className = "gj-marker";
          el.dataset.tier = tier;
          el.innerHTML = `
            <div class="gj-marker-label">
              <span class="gj-marker-name">${escapeHtml(loc.name)}</span>
              ${
                loc.recordCount > 0
                  ? `<span class="gj-marker-count">★${loc.recordCount}</span>`
                  : `<span class="gj-marker-new">NEW</span>`
              }
            </div>
            <span class="gj-marker-pin">
              <span class="gj-marker-ring"></span>
              <span class="gj-marker-core"></span>
            </span>
          `;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelected(loc);
            map.panTo(new kakao.maps.LatLng(loc.lat, loc.lng));
          });

          const overlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(loc.lat, loc.lng),
            content: el,
            yAnchor: 1.1,
            clickable: true,
          });
          overlay.setMap(map);
        });

        // 지도 빈 곳 탭 → 시트 닫기
        kakao.maps.event.addListener(map, "click", () => setSelected(null));

        // 현재 위치
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              myPosRef.current = here;
              const meEl = document.createElement("div");
              meEl.className = "gj-here";
              meEl.innerHTML = `
                <span class="gj-here-pulse"></span>
                <span class="gj-here-pulse gj-here-pulse-2"></span>
                <span class="gj-here-core"></span>
              `;
              const overlay = new kakao.maps.CustomOverlay({
                position: new kakao.maps.LatLng(here.lat, here.lng),
                content: meEl,
                yAnchor: 0.5,
                xAnchor: 0.5,
                zIndex: 100,
              });
              overlay.setMap(map);
              myMarkerRef.current = overlay;
            },
            () => {},
            { enableHighAccuracy: true, timeout: 5000 },
          );
        }

        setReady(true);
      })
      .catch((e) => setError(e.message ?? "지도 로드 실패"));

    return () => {
      cancelled = true;
    };
  }, [locations]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    if (myPosRef.current) {
      map.panTo(
        new window.kakao.maps.LatLng(
          myPosRef.current.lat,
          myPosRef.current.lng,
        ),
      );
      return;
    }
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        myPosRef.current = here;
        map.panTo(new window.kakao.maps.LatLng(here.lat, here.lng));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 },
    );
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

      {/* 상단 HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3">
        <div className="pointer-events-auto grid grid-cols-2 gap-2">
          <div className="rounded border border-arcade-border bg-arcade-panel/85 px-3 py-2 backdrop-blur">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              STAGES
            </div>
            <div className="font-bold text-arcade-accent">
              {locations.length}
              <span className="ml-1 text-[10px] text-zinc-400">곳</span>
            </div>
          </div>
          <div className="rounded border border-arcade-border bg-arcade-panel/85 px-3 py-2 backdrop-blur">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              CHALLENGES
            </div>
            <div className="font-bold text-arcade-neon">
              {totalChallenges}
              <span className="ml-1 text-[10px] text-zinc-400">회</span>
            </div>
          </div>
        </div>
      </div>

      {/* 재중심 버튼 */}
      <button
        onClick={recenter}
        aria-label="현재 위치로 이동"
        className="arcade-btn-neon absolute right-3 top-[88px] z-20 h-11 w-11 backdrop-blur"
      >
        <span className="text-base leading-none">◉</span>
      </button>

      {/* 안내 hint */}
      {!selected && ready && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20">
          <div className="rounded border border-arcade-border bg-arcade-panel/80 px-3 py-2 text-center text-[11px] tracking-wider text-zinc-400 backdrop-blur">
            ▼ 마커를 눌러 STAGE INFO 열기
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

        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] ${tierClass}`}
              >
                {tierLabel}
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                STAGE
              </span>
            </div>
            <h2 className="arcade-title mt-1 truncate text-base font-bold text-arcade-accent">
              {location.name}
            </h2>
            {location.address && (
              <div className="truncate text-[10px] text-zinc-400">
                {location.address}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="arcade-btn-ghost shrink-0 px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded border border-arcade-border bg-arcade-bg/60 p-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              HIGH SCORE
            </div>
            {location.topPullup ? (
              <>
                <div className="text-sm font-bold text-arcade-accent">
                  {location.topPullup.value}
                  <span className="ml-0.5 text-[9px] text-zinc-400">회</span>
                </div>
                <div className="truncate text-[9px] text-zinc-500">
                  {location.topPullup.nickname}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-zinc-600">---</div>
            )}
          </div>
          <div className="rounded border border-arcade-border bg-arcade-bg/60 p-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              CHALLENGERS
            </div>
            <div className="text-sm font-bold text-arcade-neon">
              {location.recordCount}
              <span className="ml-0.5 text-[9px] text-zinc-400">명</span>
            </div>
          </div>
          <div className="rounded border border-arcade-border bg-arcade-bg/60 p-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              DISTANCE
            </div>
            <div className="text-sm font-bold text-zinc-200">
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
          className="arcade-btn-primary w-full py-3 text-sm tracking-[0.28em]"
        >
          ▶ ENTER STAGE
        </button>
      </div>
    </div>
  );
}
