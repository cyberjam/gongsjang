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
    <div className="px-4 py-4">
      <Link
        href={`/locations/${loc.id}`}
        className="text-[11px] text-zinc-400 hover:text-arcade-accent"
      >
        ← {loc.name}
      </Link>

      <h1 className="mt-2 arcade-title text-base font-bold text-arcade-accent">
        ENTER YOUR SCORE
      </h1>
      <p className="mb-4 text-[11px] text-zinc-400">
        오락실 점수판처럼, 닉네임과 기록만 남기면 끝.
      </p>

      <RecordForm locationId={loc.id} />
    </div>
  );
}
