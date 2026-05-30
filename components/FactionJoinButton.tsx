"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NICK_KEY = "gongsjang_nickname";

// 문파 가입/탈퇴 — 닉네임당 1문파. 자동 가입 없음(명시적 선택). GPS/인증 없음.
export default function FactionJoinButton({ clanId }: { clanId: string }) {
  const router = useRouter();
  const [nick, setNick] = useState<string | null>(null);
  const [memberClan, setMemberClan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const n = localStorage.getItem(NICK_KEY);
    setNick(n);
    if (!n) {
      setReady(true);
      return;
    }
    createSupabaseBrowserClient()
      .from("clan_memberships")
      .select("clan_id")
      .eq("nickname", n)
      .maybeSingle()
      .then(({ data }) => {
        setMemberClan((data as { clan_id: string } | null)?.clan_id ?? null);
        setReady(true);
      });
  }, []);

  const joinedHere = memberClan === clanId;

  async function toggle() {
    if (!nick) return;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (joinedHere) {
      await supabase.from("clan_memberships").delete().eq("nickname", nick);
      setMemberClan(null);
    } else {
      await supabase
        .from("clan_memberships")
        .upsert({ nickname: nick, clan_id: clanId }, { onConflict: "nickname" });
      setMemberClan(clanId);
    }
    setLoading(false);
    router.refresh();
  }

  if (!ready) return null;

  if (!nick) {
    return (
      <p className="text-center text-[11px] tracking-arcade text-zinc-500">
        닉네임이 필요하다 — 철봉에서 먼저 방문 인증
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={
        joinedHere
          ? "arcade-btn-ghost w-full py-3 text-sm"
          : "arcade-btn-primary font-display w-full py-3 text-lg leading-none tracking-[0.18em]"
      }
    >
      {loading ? "처리 중…" : joinedHere ? "탈퇴" : "▶ 입단"}
    </button>
  );
}
