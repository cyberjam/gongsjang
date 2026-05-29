"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// 기록 폼과 닉네임 공유 + 선택 문파 기억
const NICK_KEY = "gongsjang_nickname";
const CLAN_KEY = "gongsjang_clan";

type Clan = { id: string; name: string; color: string };

// 방문 인증(체크인) — 같은 장소 하루 1회. 방문은 선택한 문파 기여로 집계되어
// 트리거가 점령을 재계산한다. (QR/GPS 검증은 후속 — TODO)
export default function VisitCheckIn({
  locationId,
  clans,
}: {
  locationId: string;
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
      <div className="arcade-label-wide">이 구역 점령</div>

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
            {loading ? "인증 중…" : "▶ 방문 인증"}
          </button>
        </>
      )}
    </div>
  );
}
