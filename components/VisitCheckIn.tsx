"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { distanceMeters } from "@/lib/geo";

// 기록 폼과 닉네임 공유 + 선택 문파 기억
const NICK_KEY = "gongsjang_nickname";
const CLAN_KEY = "gongsjang_clan";
// 허위 인증 방지 — 철봉 좌표 기준 이 반경(m) 안에서만 인증 허용
const CHECKIN_RADIUS_M = 50;

type Clan = { id: string; name: string; color: string };

// 현재 위치 1회 조회 (Promise). 모바일 Safari/Chrome 대응: https + 사용자 제스처(버튼) 내 호출.
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  });
}

function geoErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "위치 권한이 거부됐다. 브라우저 설정에서 위치 허용 후 다시.";
    case 2:
      return "위치를 잡지 못했다. 신호 트인 곳에서 다시.";
    case 3:
      return "위치 확인이 지연됐다. 다시 시도해라.";
    default:
      return "이 기기는 위치를 지원하지 않는다.";
  }
}

// 방문 인증(체크인) — 같은 장소 하루 1회. 방문은 선택한 문파 기여로 집계되어
// 트리거가 점령을 재계산한다. (QR/GPS 검증은 후속 — TODO)
export default function VisitCheckIn({
  locationId,
  lat,
  lng,
  clans,
}: {
  locationId: string;
  lat: number;
  lng: number;
  clans: Clan[];
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(NICK_KEY) ?? "",
  );
  const [clanId, setClanId] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(CLAN_KEY) ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "ok" | "already">(null);

  if (clans.length === 0) return null;

  async function checkIn() {
    setError(null);
    const nick = nickname.trim();
    if (!nick) return setError("닉네임을 입력해라.");
    if (nick.length > 12) return setError("닉네임은 12자 이하.");
    if (!clanId) return setError("소속 문파를 골라라.");

    setLoading(true);

    // 1) GPS 반경 검증 — 철봉 50m 이내에서만 인증
    let pos: GeolocationPosition;
    try {
      pos = await getPosition();
    } catch (e: any) {
      setLoading(false);
      return setError(geoErrorMessage(e?.code ?? 0));
    }
    const dist = distanceMeters(
      { lat, lng },
      { lat: pos.coords.latitude, lng: pos.coords.longitude },
    );
    if (dist > CHECKIN_RADIUS_M) {
      setLoading(false);
      return setError(
        `철봉에서 ${Math.round(dist)}m 떨어져 있다. ${CHECKIN_RADIUS_M}m 안에서 인증 가능.`,
      );
    }

    // 2) 방문 기록
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("visits")
      .insert({ location_id: locationId, clan_id: clanId, nickname: nick });
    setLoading(false);

    if (error) {
      // 같은 장소·같은 사람·같은 날 = unique 위반 → 이미 인증
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        setDone("already");
        return;
      }
      setError(error.message);
      return;
    }

    localStorage.setItem(NICK_KEY, nick);
    localStorage.setItem(CLAN_KEY, clanId);
    setDone("ok");
    router.refresh(); // 점령 색·통계 갱신
  }

  return (
    <div className="arcade-card-feature space-y-3 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="arcade-label-wide">이 구역 점령</span>
        <span className="arcade-label">GPS {CHECKIN_RADIUS_M}m 이내</span>
      </div>

      {done ? (
        <p
          className={`text-center text-sm ${
            done === "ok" ? "text-arcade-neon" : "text-zinc-400"
          }`}
        >
          {done === "ok"
            ? "✓ 오늘 방문 인증 완료 — 한 발 더 다가갔다"
            : "오늘은 이미 이 구역을 밟았다"}
        </p>
      ) : (
        <>
          <input
            className="arcade-input w-full"
            placeholder="닉네임 (최대 12자)"
            value={nickname}
            maxLength={12}
            onChange={(e) => setNickname(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            {clans.map((c) => {
              const on = c.id === clanId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClanId(c.id)}
                  className="arcade-chip select-none"
                  style={{
                    borderColor: c.color,
                    color: on ? "#0a0a0f" : c.color,
                    backgroundColor: on ? c.color : "transparent",
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          {error && <p className="text-[11px] text-arcade-danger">{error}</p>}

          <button
            type="button"
            onClick={checkIn}
            disabled={loading}
            className="arcade-btn-primary font-display w-full py-3 text-lg leading-none tracking-[0.18em] disabled:opacity-60"
          >
            {loading ? "위치 확인 중…" : "▶ 방문 인증"}
          </button>
        </>
      )}
    </div>
  );
}
