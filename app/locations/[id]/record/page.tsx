import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RecordForm from "@/components/RecordForm";
import type { Location } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const loc = data as Location;

  return (
    <div className="arcade-fade-in px-4 py-4">
      <Link
        href={`/locations/${loc.id}`}
        className="inline-flex items-center gap-1 text-[10px] tracking-[0.2em] text-zinc-400 hover:text-arcade-accent"
      >
        <span>←</span>
        <span className="truncate">{loc.name}</span>
      </Link>

      <h1 className="arcade-title font-display mt-2 text-2xl leading-none text-arcade-accent">
        ENTER YOUR SCORE
      </h1>
      <p className="mb-4 text-[11px] text-zinc-400">
        오락실 점수판처럼, 닉네임과 기록만 남기면 끝.
      </p>

      <RecordForm locationId={loc.id} />
    </div>
  );
}
