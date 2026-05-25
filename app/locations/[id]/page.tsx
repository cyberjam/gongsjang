import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Location, RecordRow, RecordType } from "@/lib/types";
import { RECORD_TYPES } from "@/lib/types";
import RankingTabs from "@/components/RankingTabs";
import StageBoss from "@/components/StageBoss";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { type?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!location) notFound();
  const loc = location as Location;

  const { data: recordsData } = await supabase
    .from("records")
    .select("*")
    .eq("location_id", params.id);

  const records: RecordRow[] = recordsData ?? [];
  const activeType: RecordType = (RECORD_TYPES.find(
    (t) => t.value === searchParams.type,
  )?.value ?? "pullup") as RecordType;

  const pullups = records.filter((r) => r.record_type === "pullup");
  const boss =
    pullups.length > 0
      ? pullups
          .slice()
          .sort(
            (a, b) =>
              b.value - a.value ||
              a.created_at.localeCompare(b.created_at),
          )[0]
      : null;

  const totalChallenges = records.length;

  return (
    <div className="arcade-fade-in px-4 pb-8 pt-3">
      <Link
        href="/locations"
        className="inline-flex items-center gap-1 text-[10px] tracking-[0.2em] text-zinc-400 hover:text-arcade-accent"
      >
        <span>←</span>
        <span>EXIT TO STAGE SELECT</span>
      </Link>

      {/* STAGE 카드 */}
      <div className="arcade-scanlines relative mt-2 overflow-hidden rounded border-2 border-arcade-border bg-arcade-panel">
        <div className="absolute inset-x-0 top-0 mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-arcade-accent to-transparent" />
        <div className="relative p-4">
          <div className="flex items-center gap-2">
            <span className="rounded border border-arcade-accent px-1.5 py-0.5 text-[9px] font-bold tracking-[0.24em] text-arcade-accent">
              STAGE
            </span>
            <span className="text-[9px] tracking-[0.24em] text-zinc-500">
              {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
            </span>
          </div>
          <h1 className="arcade-title mt-2 text-lg font-bold text-arcade-accent">
            {loc.name}
          </h1>
          {loc.address && (
            <div className="mt-1 text-[11px] text-zinc-400">{loc.address}</div>
          )}
          {loc.description && (
            <div className="mt-2 border-t border-arcade-border/60 pt-2 text-xs text-zinc-300">
              {loc.description}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-arcade-border/60 pt-3">
            <div className="rounded border border-arcade-border bg-arcade-bg/50 px-3 py-2">
              <div className="text-[9px] tracking-[0.24em] text-zinc-500">
                CHALLENGES
              </div>
              <div className="text-sm font-bold text-arcade-neon">
                {totalChallenges}
                <span className="ml-1 text-[10px] text-zinc-400">회</span>
              </div>
            </div>
            <div className="rounded border border-arcade-border bg-arcade-bg/50 px-3 py-2">
              <div className="text-[9px] tracking-[0.24em] text-zinc-500">
                EVENTS
              </div>
              <div className="text-sm font-bold text-arcade-accent">
                {RECORD_TYPES.length}
                <span className="ml-1 text-[10px] text-zinc-400">종목</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STAGE BOSS */}
      <StageBoss boss={boss} totalPullups={pullups.length} />

      {/* CTA (보스 유무에 따라 카피 변경) */}
      <Link
        href={`/locations/${loc.id}/record`}
        className="arcade-btn-primary mt-4 w-full flex-col py-3 text-center"
      >
        <span className="block text-sm font-black tracking-[0.28em]">
          {boss ? "▶ 보스 도전" : "▶ 첫 전설이 되어라"}
        </span>
        <span className="mt-0.5 block truncate text-[10px] tracking-[0.18em] opacity-85">
          {boss
            ? `${boss.nickname}의 ${boss.value}회를 넘어라`
            : "기록 등록하기"}
        </span>
      </Link>

      {/* HIGH SCORE BOARD */}
      <div className="mt-6">
        <RankingTabs
          locationId={loc.id}
          records={records}
          activeType={activeType}
        />
      </div>
    </div>
  );
}
