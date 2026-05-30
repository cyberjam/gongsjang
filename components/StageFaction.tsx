import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kstDaysAgo } from "@/lib/clan";

// Stage 점령전 패널 (골격) — 현재 점령 문파/관장/점령력/점령 시작일/최근 방문자/최근 점령 기록.
// clans/점령 컬럼 미적용 시 무주공산으로 안전 폴백. CRT/아케이드 톤 유지.
export default async function StageFaction({ locationId }: { locationId: string }) {
  const supabase = createSupabaseServerClient();

  const { data: locRaw } = await supabase
    .from("locations")
    .select("clan_id, warden, occupied_since, clan:clans(name, color)")
    .eq("id", locationId)
    .maybeSingle();
  const loc = locRaw as
    | { clan_id: string | null; warden: string | null; occupied_since: string | null; clan: { name: string; color: string } | null }
    | null;

  const since30 = kstDaysAgo(30);
  const [{ count: power }, { data: recentRaw }, { data: logRaw }, { data: clansRaw }] =
    await Promise.all([
      loc?.clan_id
        ? supabase
            .from("visits")
            .select("*", { count: "exact", head: true })
            .eq("location_id", locationId)
            .eq("clan_id", loc.clan_id)
            .gte("visited_on", since30)
        : Promise.resolve({ count: 0 } as any),
      supabase
        .from("visits")
        .select("nickname, visited_on")
        .eq("location_id", locationId)
        .order("visited_on", { ascending: false })
        .limit(8),
      supabase
        .from("occupation_log")
        .select("clan_id, prev_clan_id, occupied_at")
        .eq("location_id", locationId)
        .order("occupied_at", { ascending: false })
        .limit(3),
      supabase.from("clans").select("id, name, color"),
    ]);

  const clanById = new Map(
    ((clansRaw as { id: string; name: string; color: string }[]) ?? []).map((c) => [c.id, c]),
  );
  const recentVisitors = [
    ...new Set(((recentRaw as { nickname: string }[]) ?? []).map((r) => r.nickname)),
  ].slice(0, 5);
  const log = (logRaw as { clan_id: string | null; prev_clan_id: string | null; occupied_at: string }[]) ?? [];

  const occupied = Boolean(loc?.clan);
  const color = loc?.clan?.color ?? "#888fa0";

  return (
    <div className="arcade-card-feature space-y-3 p-3" style={occupied ? { borderColor: color } : undefined}>
      <div className="flex items-center justify-between">
        <span className="arcade-label-wide">점령 현황</span>
        <span
          className="arcade-chip"
          style={
            occupied
              ? { borderColor: color, color }
              : { borderColor: "#2a2a3a", color: "#888fa0" }
          }
        >
          {occupied ? loc!.clan!.name : "무주공산"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="arcade-stat p-2">
          <div className="arcade-label">관장</div>
          <div className="truncate text-sm text-zinc-200">{loc?.warden ?? "공석"}</div>
        </div>
        <div className="arcade-stat p-2">
          <div className="arcade-label">점령력</div>
          <div className="font-display text-lg leading-none tabular-nums" style={{ color }}>
            {power ?? 0}
          </div>
        </div>
        <div className="arcade-stat p-2">
          <div className="arcade-label">점령 시작</div>
          <div className="text-[11px] text-zinc-300 tabular-nums">
            {loc?.occupied_since ? loc.occupied_since.slice(0, 10) : "--"}
          </div>
        </div>
      </div>

      {recentVisitors.length > 0 && (
        <div>
          <div className="arcade-label mb-1">최근 방문자</div>
          <div className="flex flex-wrap gap-1.5">
            {recentVisitors.map((n) => (
              <span key={n} className="arcade-chip border-arcade-border text-zinc-300">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div>
          <div className="arcade-label mb-1">최근 점령 기록</div>
          <ul className="space-y-1">
            {log.map((l, i) => {
              const who = l.clan_id ? clanById.get(l.clan_id) : null;
              const prev = l.prev_clan_id ? clanById.get(l.prev_clan_id) : null;
              return (
                <li key={i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {l.occupied_at.slice(0, 10)}
                  </span>
                  <span className="min-w-0 truncate">
                    <span style={who ? { color: who.color } : undefined}>{who?.name ?? "무주공산"}</span>
                    {prev ? (
                      <>
                        {" "}← <span style={{ color: prev.color }}>{prev.name}</span> 탈환
                      </>
                    ) : (
                      " 점령"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
