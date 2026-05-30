import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FactionJoinButton from "@/components/FactionJoinButton";

export const dynamic = "force-dynamic";

type Clan = { id: string; name: string; color: string };

// 문파 프로필 — 문파명/색/문주/인원/방문일/점령 수/최근 점령/랭킹. 가입·탈퇴.
export default async function FactionPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: clanRaw } = await supabase
    .from("clans")
    .select("id, name, color")
    .eq("id", params.id)
    .maybeSingle();
  if (!clanRaw) notFound();
  const clan = clanRaw as Clan;

  const [
    { count: members },
    { count: occupied },
    { count: visitDays },
    { data: memberVisits },
    { data: logRaw },
    { data: allOccupied },
  ] = await Promise.all([
    supabase.from("clan_memberships").select("*", { count: "exact", head: true }).eq("clan_id", clan.id),
    supabase.from("locations").select("*", { count: "exact", head: true }).eq("clan_id", clan.id),
    supabase.from("visits").select("*", { count: "exact", head: true }).eq("clan_id", clan.id),
    supabase.from("visits").select("nickname").eq("clan_id", clan.id),
    supabase
      .from("occupation_log")
      .select("location_id, occupied_at")
      .eq("clan_id", clan.id)
      .order("occupied_at", { ascending: false })
      .limit(1),
    supabase.from("locations").select("clan_id").not("clan_id", "is", null),
  ]);

  // 문주 + 멤버 기여 랭킹 (방문 수 기반)
  const tally = new Map<string, number>();
  for (const r of (memberVisits as { nickname: string }[]) ?? [])
    tally.set(r.nickname, (tally.get(r.nickname) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const warden = ranked[0]?.[0] ?? null;

  // 최근 점령 장소명
  let recentSpot: string | null = null;
  const lastLoc = (logRaw as { location_id: string }[])?.[0]?.location_id;
  if (lastLoc) {
    const { data } = await supabase.from("locations").select("name").eq("id", lastLoc).maybeSingle();
    recentSpot = (data as { name: string } | null)?.name ?? null;
  }

  // 전체 점령 랭킹 순위
  const occCount = new Map<string, number>();
  for (const r of (allOccupied as { clan_id: string }[]) ?? [])
    occCount.set(r.clan_id, (occCount.get(r.clan_id) ?? 0) + 1);
  const myOcc = occCount.get(clan.id) ?? 0;
  const rank = [...occCount.values()].filter((v) => v > myOcc).length + 1;

  return (
    <div className="arcade-fade-in space-y-5 px-4 pb-8 pt-3">
      <Link href="/factions" className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-zinc-500 hover:text-arcade-accent">
        <span>←</span>
        <span>FACTIONS</span>
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: clan.color, boxShadow: `0 0 8px ${clan.color}` }} aria-hidden />
          <span className="arcade-chip border-arcade-border text-zinc-400">문파 · {rank}위</span>
        </div>
        <h1 className="font-display truncate text-3xl leading-none" style={{ color: clan.color }}>
          {clan.name}
        </h1>
        <div className="text-[11px] tracking-arcade text-zinc-500">
          문주 <span className="text-arcade-accent">{warden ?? "공석"}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <div className="arcade-stat p-3">
          <div className="arcade-label">총 인원</div>
          <div className="font-display text-2xl leading-none text-zinc-200 tabular-nums">{members ?? 0}</div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">점령 장소</div>
          <div className="font-display text-2xl leading-none text-arcade-accent tabular-nums">{occupied ?? 0}</div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">총 방문일</div>
          <div className="font-display text-2xl leading-none text-arcade-neon tabular-nums">{visitDays ?? 0}</div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">최근 점령</div>
          <div className="mt-1 truncate text-xs text-zinc-300">{recentSpot ?? "—"}</div>
        </div>
      </div>

      {ranked.length > 0 && (
        <section className="space-y-2">
          <div className="arcade-label-wide">문파 랭킹 (기여)</div>
          <ol className="space-y-1.5">
            {ranked.slice(0, 5).map(([nick, n], i) => (
              <li key={nick} className="arcade-card flex items-center gap-3 p-2.5 text-[11px]">
                <span className="font-display w-5 text-center text-arcade-accent tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-200">{nick}</span>
                <span className="font-display shrink-0 tabular-nums" style={{ color: clan.color }}>{n}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <FactionJoinButton clanId={clan.id} />
    </div>
  );
}
