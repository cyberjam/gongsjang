import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Location, RecordRow } from "@/lib/types";
import { RECORD_TYPE_UNIT } from "@/lib/types";
import {
  extractDong,
  extractGu,
  fuzzyAgo,
  isElder,
  masterHistory,
  reignLabel,
} from "@/lib/dojo";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({
  params,
}: {
  params: { id: string };
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

  const dong = extractDong(loc.address);
  const gu = extractGu(loc.address);

  // 마스터 history
  const masters = masterHistory(records, "pullup");
  const currentMaster = masters[masters.length - 1] ?? null;
  const pastMasters = masters.slice(0, -1).reverse(); // 최근 폐위 순
  const pioneer = masters[0] ?? null; // 개척자 = 1대 마스터 = 첫 기록자
  const unit = RECORD_TYPE_UNIT.pullup;

  // 최근 도전자 — 시간 역순, 최근 12명
  const recent = records
    .filter((r) => r.record_type === "pullup")
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);

  // 동네 랭킹 — 같은 ○○동 내 최고 기록 top 3
  let dongTop: { nickname: string; value: number; locationName: string }[] = [];
  if (dong) {
    const { data: dongLocs } = await supabase
      .from("locations")
      .select("id, name, address")
      .like("address", `%${dong}%`);
    const ids = (dongLocs ?? []).map((l: any) => l.id);
    if (ids.length > 0) {
      const { data: dongRecords } = await supabase
        .from("records")
        .select("nickname, value, location_id")
        .in("location_id", ids)
        .eq("record_type", "pullup")
        .order("value", { ascending: false })
        .limit(20);
      // 닉네임당 최고 기록 1건만
      const seen = new Set<string>();
      for (const r of dongRecords ?? []) {
        if (seen.has(r.nickname)) continue;
        seen.add(r.nickname);
        const locName = (dongLocs ?? []).find((l: any) => l.id === r.location_id)?.name ?? "";
        dongTop.push({ nickname: r.nickname, value: r.value, locationName: locName });
        if (dongTop.length >= 3) break;
      }
    }
  }

  return (
    <div className="arcade-fade-in space-y-6 px-4 pb-32 pt-3">
      <Link
        href="/locations"
        className="inline-flex items-center gap-1 text-[10px] tracking-arcade text-arcade-muted hover:text-arcade-phosphor"
      >
        <span>←</span>
        <span>EXIT</span>
      </Link>

      {/* 1. 장소 헤더 — 도장 이름 + 위치 */}
      <header className="space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="arcade-chip border-arcade-border text-arcade-muted">
            DOJO
          </span>
          {gu && (
            <span className="text-[10px] tracking-arcade text-arcade-muted">
              {gu}
              {dong ? ` · ${dong}` : ""}
            </span>
          )}
        </div>
        <h1 className="font-display truncate text-2xl leading-none text-arcade-phosphor2">
          {loc.name}
        </h1>
        {loc.address && (
          <div className="truncate text-[11px] text-arcade-muted">{loc.address}</div>
        )}
        {loc.description && (
          <p className="pt-1 text-[12px] leading-relaxed text-zinc-400">
            {loc.description}
          </p>
        )}
      </header>

      {/* 2. THIS DOJO'S MASTER */}
      <DojoMasterCard master={currentMaster} unit={unit} pioneer={pioneer} />

      {/* 3. RECENT CHALLENGERS — 방명록 */}
      <RecentChallengers records={recent} unit={unit} masterId={currentMaster?.record.id} />

      {/* 4. 역대 마스터 */}
      {pastMasters.length > 0 && (
        <PastMasters masters={pastMasters} unit={unit} />
      )}

      {/* 5. 동네 랭킹 */}
      {dong && dongTop.length > 0 && (
        <NeighborhoodRanking
          dong={dong}
          gu={gu}
          rows={dongTop}
          unit={unit}
          currentLocationId={loc.id}
        />
      )}

      {/* sticky CTA */}
      <StickyChallenge locationId={loc.id} hasMaster={!!currentMaster} value={currentMaster?.record.value} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────

function DojoMasterCard({
  master,
  unit,
  pioneer,
}: {
  master: ReturnType<typeof masterHistory>[number] | null;
  unit: string;
  pioneer: ReturnType<typeof masterHistory>[number] | null;
}) {
  if (!master) {
    return (
      <section className="arcade-card border-dashed px-4 py-8 text-center">
        <div className="font-display text-base leading-none tracking-arcade-xwide text-arcade-muted">
          무주공산
        </div>
        <div className="arcade-divider my-3 mx-auto w-12" />
        <div className="text-sm text-arcade-phosphor2">
          아직 이 도장의 주인이 없습니다
        </div>
        <div className="mt-1 text-[11px] text-arcade-muted">
          첫 기록을 남긴 사람이 1대 마스터
        </div>
      </section>
    );
  }

  const elder = isElder(master.daysHeld);

  return (
    <section className="arcade-card border-arcade-phosphor3 bg-arcade-inset px-4 py-5">
      <div className="flex items-center justify-between text-[10px] tracking-arcade-wide text-arcade-muted">
        <span>THIS DOJO&apos;S MASTER</span>
        <span>{pioneer ? `${master === pioneer ? "1" : ""}대` : ""}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <h2
          className={`font-display flex-1 truncate text-3xl leading-none text-arcade-amber ${
            elder ? "arcade-master-30" : ""
          }`}
        >
          {master.record.nickname}
        </h2>
        {elder && (
          <span className="arcade-chip border-arcade-amber text-arcade-amber">
            ★ 고수
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className={`font-display text-[5.5rem] leading-none text-arcade-amber tabular-nums ${
            elder ? "arcade-master-30" : ""
          }`}
        >
          {master.record.value.toLocaleString()}
        </span>
        <span className="font-display text-base text-arcade-muted">{unit}</span>
        <span className="ml-auto text-[10px] tracking-arcade text-arcade-muted">
          PULL-UP
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="font-display text-arcade-phosphor2">
          {reignLabel(master.daysHeld)}
        </span>
        <span className="text-arcade-muted">·</span>
        <span className="text-arcade-muted">
          {fuzzyAgo(master.crownedAt)} 등극
        </span>
      </div>

      {master.record.memo && (
        <p className="mt-3 border-l-2 border-arcade-border pl-3 text-[12px] italic text-zinc-400">
          “{master.record.memo}”
        </p>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────

function RecentChallengers({
  records,
  unit,
  masterId,
}: {
  records: RecordRow[];
  unit: string;
  masterId?: string;
}) {
  if (records.length === 0) {
    return null;
  }
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between px-1">
        <span className="arcade-label-wide">RECENT CHALLENGERS</span>
        <span className="arcade-label">{records.length}명</span>
      </header>
      <ol className="rounded-sm border border-arcade-border bg-arcade-inset">
        {records.map((r) => {
          const isMaster = r.id === masterId;
          return (
            <li
              key={r.id}
              className="grid grid-cols-[1fr_auto_5rem] items-center gap-3 border-b border-arcade-border/60 px-3 py-2 last:border-b-0"
            >
              <span
                className={`min-w-0 truncate text-sm ${
                  isMaster ? "text-arcade-amber" : "text-arcade-phosphor2"
                }`}
              >
                {isMaster && <span className="mr-1 text-arcade-amber">▸</span>}
                {r.nickname}
              </span>
              <span
                className={`font-display whitespace-nowrap text-sm leading-none tabular-nums ${
                  isMaster ? "text-arcade-amber" : "text-zinc-400"
                }`}
              >
                {r.value}
                <span className="ml-0.5 text-[10px] text-arcade-muted">{unit}</span>
              </span>
              <span className="text-right text-[10px] text-arcade-muted">
                {fuzzyAgo(r.created_at)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────

function PastMasters({
  masters,
  unit,
}: {
  masters: ReturnType<typeof masterHistory>;
  unit: string;
}) {
  // 1대가 맨 위에 (역사적 순서)
  const ordered = masters.slice().reverse();
  return (
    <section>
      <header className="mb-2 px-1">
        <span className="arcade-label-wide">역대 마스터</span>
      </header>
      <ol className="rounded-sm border border-arcade-border bg-arcade-inset">
        {ordered.map((m, idx) => {
          const era = idx + 1;
          const isPioneer = era === 1;
          return (
            <li
              key={m.record.id}
              className="flex items-center gap-3 border-b border-arcade-border/60 px-3 py-2 last:border-b-0"
            >
              <span className="font-display w-12 shrink-0 text-[11px] tracking-arcade text-arcade-muted">
                {isPioneer ? "개척자" : `${era}대`}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-arcade-phosphor2">
                {m.record.nickname}
              </span>
              <span className="font-display whitespace-nowrap text-sm tabular-nums text-zinc-400">
                {m.record.value}
                <span className="ml-0.5 text-[10px] text-arcade-muted">{unit}</span>
              </span>
              <span className="w-20 shrink-0 text-right text-[10px] text-arcade-muted">
                {m.daysHeld}일 보위
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────

function NeighborhoodRanking({
  dong,
  gu,
  rows,
  unit,
  currentLocationId,
}: {
  dong: string;
  gu: string | null;
  rows: { nickname: string; value: number; locationName: string }[];
  unit: string;
  currentLocationId: string;
}) {
  void currentLocationId;
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between px-1">
        <span className="arcade-label-wide">{dong} 최강자</span>
        {gu && <span className="arcade-label">{gu}</span>}
      </header>
      <ol className="rounded-sm border border-arcade-border bg-arcade-inset">
        {rows.map((r, idx) => (
          <li
            key={`${r.nickname}-${idx}`}
            className="flex items-center gap-3 border-b border-arcade-border/60 px-3 py-2 last:border-b-0"
          >
            <span className="font-display w-5 shrink-0 text-[11px] tabular-nums text-arcade-muted">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-arcade-phosphor2">
                {r.nickname}
              </div>
              <div className="truncate text-[10px] text-arcade-muted">
                @ {r.locationName}
              </div>
            </div>
            <span className="font-display whitespace-nowrap text-sm tabular-nums text-arcade-amber">
              {r.value}
              <span className="ml-0.5 text-[10px] text-arcade-muted">{unit}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────

function StickyChallenge({
  locationId,
  hasMaster,
  value,
}: {
  locationId: string;
  hasMaster: boolean;
  value?: number;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md bg-gradient-to-t from-arcade-bg via-arcade-bg/95 to-transparent px-4 pb-4 pt-6">
        <Link
          href={`/locations/${locationId}/record`}
          className="arcade-btn-amber pointer-events-auto block w-full py-3.5 text-center"
        >
          <span className="font-display block text-lg leading-none tracking-[0.18em]">
            ▸ 기록 남기기
          </span>
          {hasMaster && value != null && (
            <span className="mt-1 block text-[10px] tracking-arcade opacity-80">
              {value}을(를) 넘어라
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
