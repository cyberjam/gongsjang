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
  const activeType: RecordType = (RECORD_TYPES.find((t) => t.value === searchParams.type)?.value ??
    "pullup") as RecordType;

  return (
    <div className="px-4 py-4">
      <Link href="/locations" className="text-[11px] text-zinc-400 hover:text-arcade-accent">
        ← 목록으로
      </Link>

      <div className="mt-2 rounded border border-arcade-border bg-arcade-panel p-4">
        <h1 className="text-base font-bold text-arcade-accent">{loc.name}</h1>
        {loc.address && <div className="mt-1 text-[11px] text-zinc-400">{loc.address}</div>}
        {loc.description && (
          <div className="mt-2 text-xs text-zinc-300">{loc.description}</div>
        )}
        <div className="mt-2 text-[10px] text-zinc-500">
          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="arcade-title text-sm font-bold text-arcade-accent">HIGH SCORE</h2>
        <Link
          href={`/locations/${loc.id}/record`}
          className="rounded bg-arcade-accent px-3 py-1.5 text-xs font-bold text-arcade-bg"
        >
          기록 등록 ▶
        </Link>
      </div>

      <RankingTabs
        locationId={loc.id}
        records={records}
        activeType={activeType}
      />
    </div>
  );
}
