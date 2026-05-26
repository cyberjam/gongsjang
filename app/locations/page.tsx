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
        <h1 className="arcade-title font-display text-2xl leading-none text-arcade-accent">
          STAGE SELECT
        </h1>
        <AddLocationButton />
      </div>

      {error && (
        <div className="rounded border border-arcade-danger/40 bg-arcade-danger/10 p-3 text-xs text-arcade-danger">
          {error.message}
        </div>
      )}

      {locations.length === 0 ? (
        <div className="rounded border border-arcade-border bg-arcade-panel p-6 text-center text-sm text-zinc-400">
          아직 등록된 철봉이 없어요.
          <br />
          첫 스테이지를 만들어 보세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {locations.map((loc) => (
            <li key={loc.id}>
              <Link
                href={`/locations/${loc.id}`}
                className="arcade-card-tap block p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{loc.name}</div>
                    {loc.address && (
                      <div className="truncate text-[11px] text-zinc-400">{loc.address}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-[10px] tracking-[0.2em] text-arcade-accent">
                    ▶ PLAY
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
