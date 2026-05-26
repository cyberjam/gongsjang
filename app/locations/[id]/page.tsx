import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Location, RecordRow, RecordType } from "@/lib/types";
import { RECORD_TYPES } from "@/lib/types";
import RankingTabs from "@/components/RankingTabs";

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

  const totalChallenges = records.length;

  return (
    <div className="arcade-fade-in space-y-5 px-4 pb-8 pt-3">
      <Link
        href="/locations"
        className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-zinc-500 hover:text-arcade-accent"
      >
        <span>←</span>
        <span>EXIT</span>
      </Link>

      {/* 1. 장소명 — 카드 없이 텍스트로만 */}
      <header className="space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="arcade-chip border-arcade-border text-zinc-400">
            STAGE
          </span>
          <h1 className="font-display min-w-0 flex-1 truncate text-2xl leading-none text-arcade-accent">
            {loc.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
          {loc.address && (
            <>
              <span className="truncate">{loc.address}</span>
              <span className="text-zinc-700">·</span>
            </>
          )}
          <span>도전자 {totalChallenges}명</span>
        </div>
        {loc.description && (
          <p className="pt-1 text-[11px] leading-relaxed text-zinc-500">
            {loc.description}
          </p>
        )}
      </header>

      {/* 2. TOP3 + 3. 전체 랭킹 */}
      <RankingTabs
        locationId={loc.id}
        records={records}
        activeType={activeType}
      />

      {/* 4. 기록 등록 버튼 */}
      <Link
        href={`/locations/${loc.id}/record`}
        className="block w-full rounded border border-arcade-accent bg-arcade-accent py-3 text-center text-arcade-bg transition active:translate-y-px hover:brightness-95"
      >
        <span className="font-display block text-lg leading-none tracking-[0.18em]">
          ▶ NEW CHALLENGER
        </span>
        <span className="mt-1 block text-[10px] tracking-arcade opacity-80">
          기록 등록하기
        </span>
      </Link>
    </div>
  );
}
