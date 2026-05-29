import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Clan = { id: string; name: string; slug: string; color: string };

// 지역 랭킹 — 문파별 점령 수(현재 점령 중인 장소 수) 내림차순
export default async function ClansPage() {
  const supabase = createSupabaseServerClient();

  const { data: clansData, error } = await supabase
    .from("clans")
    .select("id, name, slug, color");
  const clans: Clan[] = (clansData as Clan[]) ?? [];

  // 문파별 점령 수 (head count) — 문파 수는 적어 병렬 카운트로 충분
  const counts = await Promise.all(
    clans.map(async (c) => {
      const { count } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true })
        .eq("clan_id", c.id);
      return { clan: c, count: count ?? 0 };
    }),
  );
  counts.sort((a, b) => b.count - a.count || a.clan.name.localeCompare(b.clan.name));

  const medal = (i: number) =>
    i === 0
      ? "text-arcade-accent"
      : i === 1
        ? "text-zinc-300"
        : i === 2
          ? "text-[#cd7f32]"
          : "text-zinc-500";

  return (
    <div className="arcade-fade-in space-y-5 px-4 pb-8 pt-3">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-zinc-500 hover:text-arcade-accent"
      >
        <span>←</span>
        <span>MAP</span>
      </Link>

      <header className="space-y-1">
        <h1 className="font-display text-2xl leading-none text-arcade-accent">
          지역 세력 랭킹
        </h1>
        <p className="text-[11px] tracking-arcade text-zinc-500">
          점령한 구역이 많을수록 강한 문파
        </p>
      </header>

      {error && (
        <div className="rounded border border-arcade-danger/40 bg-arcade-danger/10 p-3 text-xs text-arcade-danger">
          {error.message}
        </div>
      )}

      <ol className="space-y-2">
        {counts.map(({ clan, count }, i) => (
          <li key={clan.id}>
            <Link
              href={`/clan/${clan.slug}`}
              className="arcade-card-tap flex items-center gap-3 p-3"
            >
              <span
                className={`font-display w-6 shrink-0 text-center text-lg leading-none tabular-nums ${medal(i)}`}
              >
                {i + 1}
              </span>
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: clan.color, boxShadow: `0 0 6px ${clan.color}` }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                {clan.name}
              </span>
              <span className="font-display shrink-0 text-lg leading-none text-arcade-accent tabular-nums">
                {count}
                <span className="ml-1 text-[10px] text-zinc-400">곳</span>
              </span>
            </Link>
          </li>
        ))}
        {counts.length === 0 && !error && (
          <li className="text-center text-[11px] tracking-arcade text-zinc-500">
            아직 문파가 없다
          </li>
        )}
      </ol>
    </div>
  );
}
