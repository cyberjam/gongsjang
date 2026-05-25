"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/lib/types";

declare global {
  interface Window {
    kakao: any;
  }
}

type Props = {
  locations: Location[];
  initialCenter?: { lat: number; lng: number };
};

function maskKey(k: string) {
  if (k.length <= 8) return k;
  return `${k.slice(0, 4)}…${k.slice(-4)} (len=${k.length})`;
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
      existing.addEventListener("load", () => window.kakao.maps.load(() => resolve()));
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
            `script loaded but window.kakao undefined. ` +
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
          `script tag onerror (network/HTTP 실패). ` +
            `origin=${window.location.origin} key=${maskKey(appKey)} src=${src}`,
        ),
      );
    };
    document.head.appendChild(script);
  });
}

export default function KakaoMap({ locations, initialCenter }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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

        const center = initialCenter
          ? new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng)
          : locations[0]
            ? new kakao.maps.LatLng(locations[0].lat, locations[0].lng)
            : new kakao.maps.LatLng(37.5665, 126.978);

        const map = new kakao.maps.Map(containerRef.current, {
          center,
          level: 5,
        });

        locations.forEach((loc) => {
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(loc.lat, loc.lng),
            map,
            title: loc.name,
          });
          const overlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(loc.lat, loc.lng),
            yAnchor: 2.2,
            content: `<div style="background:#15151f;border:1px solid #ffd23f;color:#ffd23f;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;font-family:ui-monospace,monospace;">${loc.name}</div>`,
          });
          overlay.setMap(map);
          kakao.maps.event.addListener(marker, "click", () => {
            router.push(`/locations/${loc.id}`);
          });
        });

        // 현재 위치
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const here = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
              new kakao.maps.Marker({
                position: here,
                map,
                image: new kakao.maps.MarkerImage(
                  "data:image/svg+xml;utf8," +
                    encodeURIComponent(
                      `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='6' fill='#39ff14' stroke='white' stroke-width='2'/></svg>`,
                    ),
                  new kakao.maps.Size(20, 20),
                ),
              });
              if (!initialCenter && locations.length === 0) map.setCenter(here);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 5000 },
          );
        }
      })
      .catch((e) => setError(e.message ?? "지도 로드 실패"));

    return () => {
      cancelled = true;
    };
  }, [locations, initialCenter, router]);

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="text-sm font-bold text-arcade-danger">지도 로드 실패</div>
        <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all rounded border border-arcade-danger/40 bg-arcade-panel p-3 text-left text-[10px] text-arcade-danger">
          {error}
        </pre>
        <div className="text-[11px] text-zinc-400">
          위 메시지를 복사해서 문의에 첨부하세요.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[calc(100vh-120px)] w-full" />;
}
