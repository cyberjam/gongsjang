import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { topNickname, kstDaysAgo } from "@/lib/clan";

export const dynamic = "force-dynamic";

type Clan = { id: string; name: string; slug: string; color: string };

export default async function ClanProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: clanData } = await supabase
    .from("clans")
    .select("id, name, slug, color")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!clanData) notFound();
  const clan = clanData as Clan;

  const since14 = kstDaysAgo(14);
  const since30 = kstDaysAgo(30);

  const [
    { count: occupiedCount },
    { count: recentActivity },
    { data: memberRows },
    { data: logRows },
    { data: allClansData },
  ] = await Promise.all([
    supabase.from("locations").select("*", { count: "exact", head: true }).eq("clan_id", clan.id),
    supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("clan_id", clan.id)
      .gte("visited_on", since14),
    supabase.from("visits").select("nickname").eq("clan_id", clan.id).gte("visited_on", since30),
    supabase
      .from("occupation_log")
      .select("location_id, prev_clan_id, occupied_at")
      .eq("clan_id", clan.id)
      .order("occupied_at", { ascending: false })
      .limit(8),
    supabase.from("clans").select("id, name, color"),
  ]);

  const members = (memberRows as { nickname: string }[]) ?? [];
  const memberCount = new Set(members.map((m) => m.nickname)).size;
  const leader = topNickname(members);

  // 점령 로그 표시용 이름 매핑 (장소명 + 직전 문파명)
  const log = (logRows as { location_id: string; prev_clan_id: string | null; occupied_at: string }[]) ?? [];
  const clanById = new Map<string, { name: string; color: string }>(
    ((allClansData as { id: string; name: string; color: string }[]) ?? []).map((c) => [c.id, { name: c.name, color: c.color }]),
  );
  const locIds = [...new Set(log.map((l) => l.location_id))];
  let locName = new Map<string, string>();
  if (locIds.length) {
    const { data: locs } = await supabase.from("locations").select("id, name").in("id", locIds);
    locName = new Map(((locs as { id: string; name: string }[]) ?? []).map((l) => [l.id, l.name]));
  }

  return (
    <div className="arcade-fade-in space-y-5 px-4 pb-8 pt-3">
      <Link
        href="/clans"
        className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-zinc-500 hover:text-arcade-accent"
      >
        <span>←</span>
        <span>RANKING</span>
      </Link>

      {/* 헤더 */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm"
            style={{ backgroundColor: clan.color, boxShadow: `0 0 8px ${clan.color}` }}
            aria-hidden
          />
          <span className="arcade-chip border-arcade-border text-zinc-400">문파</span>
        </div>
        <h1 className="font-display truncate text-3xl leading-none" style={{ color: clan.color }}>
          {clan.name}
        </h1>
        <div className="text-[11px] tracking-arcade text-zinc-500">
          문주{" "}
          <span className="text-arcade-accent">{leader ?? "공석"}</span>
        </div>
      </header>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="arcade-stat p-3">
          <div className="arcade-label">총 점령</div>
          <div className="font-display text-2xl leading-none text-arcade-accent tabular-nums">
            {occupiedCount ?? 0}
            <span className="ml-1 text-[10px] text-zinc-400">곳</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">최근 활동</div>
          <div className="font-display text-2xl leading-none text-arcade-neon tabular-nums">
            {recentActivity ?? 0}
            <span className="ml-1 text-[10px] text-zinc-400">회</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">소속 인원</div>
          <div className="font-display text-2xl leading-none text-zinc-200 tabular-nums">
            {memberCount}
            <span className="ml-1 text-[10px] text-zinc-400">명</span>
          </div>
        </div>
      </div>

      {/* 최근 점령 로그 */}
      <section className="space-y-2">
        <div className="arcade-label-wide">최근 점령 로그</div>
        {log.length === 0 ? (
          <p className="text-[11px] tracking-arcade text-zinc-500">아직 점령 기록이 없다</p>
        ) : (
          <ul className="space-y-1.5">
            {log.map((l, i) => {
              const prev = l.prev_clan_id ? clanById.get(l.prev_clan_id) : null;
              return (
                <li key={i} className="arcade-card flex items-center gap-2 p-2.5 text-[11px]">
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {l.occupied_at.slice(0, 10)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-200">
                    {locName.get(l.location_id) ?? "이름 없는 장소"}
                  </span>
                  <span className="shrink-0 text-zinc-500">
                    ←{" "}
                    {prev ? (
                      <span style={{ color: prev.color }}>{prev.name}</span>
                    ) : (
                      "무주공산"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
