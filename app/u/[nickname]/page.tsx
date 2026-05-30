import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { titleForDays, nextTitle } from "@/lib/titles";

export const dynamic = "force-dynamic";

// "YYYY-MM-DD" (UTC 자정 기준) → epoch
const dayMs = 86_400_000;
const toEpoch = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayKST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

// 최신 방문일에서 거꾸로 이어지는 연속 방문일. 단, 최신이 오늘/어제가 아니면 0.
function currentStreak(daySet: Set<string>): number {
  if (daySet.size === 0) return 0;
  const latest = Math.max(...[...daySet].map(toEpoch));
  const today = toEpoch(todayKST());
  if (today - latest > dayMs) return 0; // 끊김
  let streak = 0;
  let cursor = latest;
  while (daySet.has(fmt(cursor))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
}

export default async function ProfilePage({
  params,
}: {
  params: { nickname: string };
}) {
  const nick = decodeURIComponent(params.nickname);
  const supabase = createSupabaseServerClient();

  const { data: visitsData } = await supabase
    .from("visits")
    .select("location_id, clan_id, visited_on, clan:clans(name, color)")
    .eq("nickname", nick);

  const visits: any[] = visitsData ?? [];

  // 집계
  const daySet = new Set<string>(visits.map((v) => v.visited_on));
  const totalDays = daySet.size;
  const locationSet = new Set<string>(visits.map((v) => v.location_id));
  const streak = currentStreak(daySet);

  // 소속 문파 = 방문 기여가 가장 많은 문파
  const clanTally = new Map<
    string,
    { count: number; name: string; color: string }
  >();
  const locTally = new Map<string, number>();
  for (const v of visits) {
    if (v.clan_id) {
      const e = clanTally.get(v.clan_id) ?? {
        count: 0,
        name: v.clan?.name ?? "무소속",
        color: v.clan?.color ?? "#888fa0",
      };
      e.count++;
      clanTally.set(v.clan_id, e);
    }
    locTally.set(v.location_id, (locTally.get(v.location_id) ?? 0) + 1);
  }
  const soul = [...clanTally.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  const soulClanId = soul?.[0] ?? null;
  const soulClan = soul?.[1] ?? null;
  const contribution = soulClanId
    ? visits.filter((v) => v.clan_id === soulClanId).length
    : 0;

  // 대표 장소 (최다 방문)
  const topLocId =
    [...locTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  let topLocName: string | null = null;
  if (topLocId) {
    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", topLocId)
      .maybeSingle();
    topLocName = (loc as any)?.name ?? null;
  }

  // 문파 내 역할 = 소속 문파 최근 30일 방문 기여 순위 (관장=1위 / 핵심 멤버=top5 / 일반 단원)
  let role: "관장" | "핵심 멤버" | "일반 단원" | null = null;
  if (soulClanId && totalDays > 0) {
    const since = fmt(toEpoch(todayKST()) - 30 * dayMs);
    const { data: clanVisits } = await supabase
      .from("visits")
      .select("nickname")
      .eq("clan_id", soulClanId)
      .gte("visited_on", since);
    const tally = new Map<string, number>();
    for (const r of (clanVisits as any[]) ?? [])
      tally.set(r.nickname, (tally.get(r.nickname) ?? 0) + 1);
    const ranked = [...tally.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map((e) => e[0]);
    const rank = ranked.indexOf(nick);
    role = rank === 0 ? "관장" : rank >= 1 && rank < 5 ? "핵심 멤버" : "일반 단원";
  }

  const totalVisits = visits.length; // 총 방문 수(누적, 방문일과 별개)
  const level = Math.floor(totalDays / 5) + 1; // 계급 — 방문일 기반 (5일당 1)
  const title = titleForDays(totalDays);
  const next = nextTitle(totalDays);

  return (
    <div className="arcade-fade-in space-y-5 px-4 pb-8 pt-3">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-zinc-500 hover:text-arcade-accent"
      >
        <span>←</span>
        <span>MAP</span>
      </Link>

      {/* 헤더 — 닉네임 + 소속 문파 + 칭호 */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="arcade-chip border-arcade-border text-zinc-400">
            WARRIOR
          </span>
          {role && (
            <span
              className={`arcade-chip ${
                role === "관장"
                  ? "border-arcade-accent text-arcade-accent"
                  : role === "핵심 멤버"
                    ? "border-arcade-neon text-arcade-neon"
                    : "border-arcade-border text-zinc-400"
              }`}
            >
              {role}
            </span>
          )}
        </div>
        <h1 className="font-display truncate text-3xl leading-none text-arcade-accent">
          {nick}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          {soulClan ? (
            <span
              className="arcade-chip"
              style={{ borderColor: soulClan.color, color: soulClan.color }}
            >
              {soulClan.name}
            </span>
          ) : (
            <span className="arcade-chip border-arcade-border text-zinc-500">
              무소속
            </span>
          )}
          <span
            className="arcade-chip border-arcade-neon text-arcade-neon"
            title="총 방문일 기반 칭호"
          >
            {title}
          </span>
        </div>
      </header>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="arcade-stat p-3">
          <div className="arcade-label">총 방문 수</div>
          <div className="font-display text-2xl leading-none text-arcade-accent tabular-nums">
            {totalVisits}
            <span className="ml-1 text-[10px] text-zinc-400">회</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">총 방문일</div>
          <div className="font-display text-2xl leading-none text-arcade-accent tabular-nums">
            {totalDays}
            <span className="ml-1 text-[10px] text-zinc-400">일</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">연속 방문일</div>
          <div className="font-display text-2xl leading-none text-arcade-neon tabular-nums">
            {streak}
            <span className="ml-1 text-[10px] text-zinc-400">일</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">방문 장소</div>
          <div className="font-display text-2xl leading-none text-zinc-200 tabular-nums">
            {locationSet.size}
            <span className="ml-1 text-[10px] text-zinc-400">곳</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">점령 기여</div>
          <div className="font-display text-2xl leading-none text-zinc-200 tabular-nums">
            {contribution}
            <span className="ml-1 text-[10px] text-zinc-400">회</span>
          </div>
        </div>
        <div className="arcade-stat p-3">
          <div className="arcade-label">계급</div>
          <div className="font-display text-2xl leading-none text-arcade-neon tabular-nums">
            <span className="text-[10px] text-zinc-400">LV </span>
            {level}
          </div>
        </div>
      </div>

      {/* 대표 장소 */}
      <div className="arcade-card p-3">
        <div className="arcade-label">대표 장소</div>
        <div className="mt-1 truncate text-sm text-zinc-200">
          {topLocName ?? "아직 발자국이 없다"}
        </div>
      </div>

      {/* 다음 칭호까지 */}
      {next && (
        <p className="text-center text-[11px] tracking-arcade text-zinc-500">
          다음 칭호 <span className="text-arcade-neon">{next.name}</span> 까지{" "}
          <span className="text-zinc-300 tabular-nums">{next.remaining}</span>일
        </p>
      )}
    </div>
  );
}
