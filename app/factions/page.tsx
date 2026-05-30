import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kstDaysAgo } from "@/lib/clan";
import FactionJoinButton from "@/components/FactionJoinButton";

export const dynamic = "force-dynamic";

type Clan = { id: string; name: string; slug: string; color: string };

// 문파 찾기 — 카드 리스트 + 가입 버튼. 지역 제한 없음(어느 문파든 가입 가능).
export default async function FactionsPage() {
  const supabase = createSupabaseServerClient();
  const { data: clansRaw, error } = await supabase
    .from("clans")
    .select("id, name, slug, color");
  const clans: Clan[] = (clansRaw as Clan[]) ?? [];
  const since30 = kstDaysAgo(30);

  const cards = await Promise.all(
    clans.map(async (c) => {
      const [{ count: members }, { count: occupied }, { count: visitDays }] = await Promise.all([
        supabase.from("clan_memberships").select("*", { count: "exact", head: true }).eq("clan_id", c.id),
        supabase.from("locations").select("*", { count: "exact", head: true }).eq("clan_id", c.id),
        supabase.from("visits").select("*", { count: "exact", head: true }).eq("clan_id", c.id).gte("visited_on", since30),
      ]);
      return { c, members: members ?? 0, occupied: occupied ?? 0, visitDays: visitDays ?? 0 };
    }),
  );
  cards.sort((a, b) => b.occupied - a.occupied || b.members - a.members);

  return (
    <div className="arcade-fade-in space-y-5 px-4 pb-8 pt-3">
      <Link href="/" className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-zinc-500 hover:text-arcade-accent">
        <span>←</span>
        <span>MAP</span>
      </Link>

      <header className="space-y-1">
        <h1 className="font-display text-2xl leading-none text-arcade-accent">문파 찾기</h1>
        <p className="text-[11px] tracking-arcade text-zinc-500">
          어느 동네 문파든 입단 가능 — 우리 구역을 넓혀라
        </p>
      </header>

      {error && (
        <div className="rounded border border-arcade-danger/40 bg-arcade-danger/10 p-3 text-xs text-arcade-danger">
          {error.message}
        </div>
      )}

      <ul className="space-y-3">
        {cards.map(({ c, members, occupied, visitDays }) => (
          <li key={c.id} className="arcade-card space-y-3 p-3" style={{ borderColor: c.color }}>
            <Link href={`/faction/${c.id}`} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}` }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: c.color }}>
                {c.name}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-500">상세 ▸</span>
            </Link>
            <div className="grid grid-cols-3 gap-2">
              <div className="arcade-stat p-2">
                <div className="arcade-label">인원</div>
                <div className="font-display text-lg leading-none text-zinc-200 tabular-nums">{members}</div>
              </div>
              <div className="arcade-stat p-2">
                <div className="arcade-label">점령</div>
                <div className="font-display text-lg leading-none text-arcade-accent tabular-nums">{occupied}</div>
              </div>
              <div className="arcade-stat p-2">
                <div className="arcade-label">방문일</div>
                <div className="font-display text-lg leading-none text-arcade-neon tabular-nums">{visitDays}</div>
              </div>
            </div>
            <FactionJoinButton clanId={c.id} />
          </li>
        ))}
        {cards.length === 0 && !error && (
          <li className="text-center text-[11px] tracking-arcade text-zinc-500">아직 문파가 없다</li>
        )}
      </ul>
    </div>
  );
}
