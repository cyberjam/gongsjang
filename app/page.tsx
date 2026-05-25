import KakaoMap from "@/components/KakaoMap";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Location } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: false });

  const locations: Location[] = data ?? [];

  return (
    <div>
      <div className="border-b border-arcade-border px-4 py-2 text-[11px] text-zinc-400">
        지도를 움직여 우리 동네 철봉을 찾아보세요. 핀을 누르면 랭킹으로.
      </div>
      {error ? (
        <div className="p-4 text-sm text-arcade-danger">
          장소를 불러오지 못했습니다: {error.message}
        </div>
      ) : (
        <KakaoMap locations={locations} />
      )}
    </div>
  );
}
