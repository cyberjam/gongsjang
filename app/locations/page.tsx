import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Location } from "@/lib/types";
import AddLocationButton from "@/components/AddLocationButton";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: false });

  const locations: Location[] = data ?? [];

  return (
    <div className="arcade-fade-in px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="arcade-title font-display text-2xl leading-none text-arcade-phosphor2">
          DOJO LIST
        </h1>
        <AddLocationButton />
      </div>

      {error && (
        <div className="rounded-sm border border-arcade-danger/40 bg-arcade-danger/10 p-3 text-xs text-arcade-danger">
          {error.message}
        </div>
      )}

      {locations.length === 0 ? (
        <div className="rounded-sm border border-dashed border-arcade-border bg-arcade-inset p-8 text-center">
          <div className="font-display text-base tracking-arcade-wide text-arcade-muted">
            무주공산
          </div>
          <div className="arcade-divider mx-auto my-3 w-12" />
          <div className="text-sm text-arcade-phosphor2">
            이 동네는 아직 도장이 없습니다
          </div>
          <div className="mt-1 text-[11px] text-arcade-muted">
            당신이 첫 개척자가 됩니다
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {locations.map((loc) => (
            <li key={loc.id}>
              <Link
                href={`/locations/${loc.id}`}
                className="arcade-card-tap block p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-arcade-phosphor2">{loc.name}</div>
                    {loc.address && (
                      <div className="truncate text-[11px] text-arcade-muted">{loc.address}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-[10px] tracking-arcade text-arcade-phosphor3">
                    ▸ 입장
                  </div>
                </div>
                {loc.description && (
                  <div className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                    {loc.description}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
