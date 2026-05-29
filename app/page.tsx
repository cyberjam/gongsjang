import KakaoMap from "@/components/KakaoMap";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClanBadge, ClanStat, Location, LocationWithStats, RecordRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Supabase 단일 select 는 최대 1000행. 전국 철봉(수천 건)을 전부 표시하려면
// range() 로 끝까지 페이지네이션해서 모든 행을 가져온다.
// (지도 마커는 KakaoMap 이 viewport culling 으로 보이는 것만 렌더하므로 안전)
const PAGE = 1000;

async function fetchAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, error };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows, error: null };
}

export default async function HomePage() {
  const supabase = createSupabaseServerClient();

  // 마커 컬럼 + 점령 문파(색) embed. 컬럼/관계 미적용(스키마 미반영) 시 embed 빼고 폴백.
  const loadLocations = (withClan: boolean) =>
    fetchAll<Location & { clan: ClanBadge | null }>(
      (from, to) =>
        supabase
          .from("locations")
          .select(
            withClan
              ? "id, name, address, lat, lng, clan:clans(name, color)"
              : "id, name, address, lat, lng",
          )
          .order("created_at", { ascending: false })
          .range(from, to) as unknown as PromiseLike<{
          data: (Location & { clan: ClanBadge | null })[] | null;
          error: { message: string } | null;
        }>,
    );

  const [locTry, recResult, { count: stagesCount }] = await Promise.all([
    loadLocations(true),
    fetchAll<Pick<RecordRow, "location_id" | "record_type" | "value" | "nickname">>(
      (from, to) =>
        supabase
          .from("records")
          .select("location_id, record_type, value, nickname")
          .range(from, to),
    ),
    supabase.from("locations").select("*", { count: "exact", head: true }),
  ]);

  // 문파 관계가 스키마 캐시에 없으면(아직 마이그레이션 전) embed 빼고 재시도 → 지도는 정상
  let locResult = locTry;
  if (locResult.error) {
    console.warn(`[home] 문파 embed 실패 → 폴백: ${locResult.error.message}`);
    locResult = await loadLocations(false);
  }

  const { rows: locations, error } = locResult;
  const records = recResult.rows;

  console.log(
    `[home] locations total count = ${stagesCount ?? "?"} (fetched ${locations.length})`,
  );

  if (error) {
    return (
      <div className="p-4 text-sm text-arcade-danger">
        장소를 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  const byLocation = new Map<string, Pick<RecordRow, "record_type" | "value" | "nickname">[]>();
  (records ?? []).forEach((r: any) => {
    const list = byLocation.get(r.location_id) ?? [];
    list.push({ record_type: r.record_type, value: r.value, nickname: r.nickname });
    byLocation.set(r.location_id, list);
  });

  const enriched: LocationWithStats[] = (locations ?? []).map((loc) => {
    const rs = byLocation.get(loc.id) ?? [];
    const pullups = rs.filter((r) => r.record_type === "pullup");
    const top = pullups.length
      ? pullups.reduce((a, b) => (a.value >= b.value ? a : b))
      : null;
    return {
      ...loc,
      recordCount: rs.length,
      topPullup: top ? { value: top.value, nickname: top.nickname } : null,
    };
  });

  // 문파 점령 랭킹 + 최근 점령 활동 (HUD/활동 피드용). 문파 수만큼만 가벼운 카운트.
  const { data: clansRaw } = await supabase.from("clans").select("id, name, slug, color");
  const clanList = (clansRaw as ClanStat[]) ?? [];
  const clanStats: ClanStat[] = (
    await Promise.all(
      clanList.map(async (c) => {
        const { count } = await supabase
          .from("locations")
          .select("*", { count: "exact", head: true })
          .eq("clan_id", c.id);
        return { ...c, count: count ?? 0 };
      }),
    )
  ).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const { data: logRaw } = await supabase
    .from("occupation_log")
    .select("location_id, clan_id, prev_clan_id, occupied_at")
    .order("occupied_at", { ascending: false })
    .limit(6);
  const logRows = (logRaw as { location_id: string; clan_id: string | null; prev_clan_id: string | null }[]) ?? [];
  const clanName = new Map(clanList.map((c) => [c.id, c.name]));
  let locName = new Map<string, string>();
  const logLocIds = [...new Set(logRows.map((l) => l.location_id))];
  if (logLocIds.length) {
    const { data } = await supabase.from("locations").select("id, name").in("id", logLocIds);
    locName = new Map(((data as { id: string; name: string }[]) ?? []).map((l) => [l.id, l.name]));
  }
  const activity = logRows.map((l) => {
    const who = (l.clan_id && clanName.get(l.clan_id)) || "어느 세력";
    const where = locName.get(l.location_id) ?? "한 구역";
    return `${who}가 ${where}을 ${l.prev_clan_id ? "탈환" : "점령"}했다`;
  });

  return (
    <KakaoMap
      locations={enriched}
      stagesCount={stagesCount ?? enriched.length}
      clanStats={clanStats}
      activity={activity}
    />
  );
}
