import type { RecordRow } from "@/lib/types";
import { COPY, deterministicOf } from "@/lib/copy";

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function StageBoss({
  boss,
  totalPullups,
}: {
  boss: RecordRow | null;
  totalPullups: number;
}) {
  if (!boss) {
    return <VacantStage seed={"vacant"} />;
  }

  const legendLine = deterministicOf(COPY.legendStanding, boss.location_id);
  const introLine = deterministicOf(COPY.legendIntro, boss.location_id);

  const days = daysSince(boss.created_at);
  const standingLabel =
    days === 0 ? "오늘 갱신됨" : `${days}일째 무패`;
  const defeatedCount = Math.max(0, totalPullups - 1);

  return (
    <div className="arcade-scanlines arcade-card-feature mt-4 overflow-hidden">
      {/* 상하 광선 라인 */}
      <div className="arcade-divider-accent absolute inset-x-0 top-0" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-arcade-accent/40 to-transparent" />

      <CornerMarks />

      <div className="relative px-4 py-5 text-center">
        <div className="font-display text-base leading-none tracking-[0.16em] text-arcade-accent">
          ✦ STAGE BOSS ✦
        </div>
        <div className="arcade-label-wide mt-1">{introLine}</div>

        <div className="arcade-glow-gold mt-4 text-2xl leading-none text-arcade-accent">
          ♛
        </div>

        <div className="arcade-glow-gold font-display mt-2 truncate text-4xl leading-none tracking-[0.04em] text-arcade-accent">
          {boss.nickname}
        </div>

        <div className="mt-3 flex items-baseline justify-center gap-1.5">
          <span className="arcade-glow-gold font-display text-[5rem] leading-none text-arcade-accent tabular-nums">
            {boss.value.toLocaleString()}
          </span>
          <span className="text-sm tracking-wider text-zinc-300">회</span>
        </div>
        <div className="font-display mt-1 text-sm leading-none tracking-[0.18em] text-zinc-400">
          PULL-UP
        </div>

        {boss.memo && (
          <div className="mx-auto mt-3 max-w-[16rem] truncate text-[11px] italic text-zinc-400">
            “{boss.memo}”
          </div>
        )}

        <div className="arcade-divider my-4 w-3/4" />

        <div className="text-[11px] font-bold tracking-arcade text-arcade-danger">
          ╳ {legendLine} ╳
        </div>

        <div className="mt-3 inline-flex overflow-hidden rounded border border-arcade-border bg-arcade-bg/60 text-[10px]">
          <div className="px-3 py-1.5">
            <div className="arcade-label-wide">STANDING</div>
            <div className="font-bold text-arcade-accent">{standingLabel}</div>
          </div>
          <div className="w-px bg-arcade-border" />
          <div className="px-3 py-1.5">
            <div className="arcade-label-wide">DEFEATED</div>
            <div className="font-display text-base leading-none text-arcade-neon tabular-nums">
              {defeatedCount}
              <span className="ml-0.5 text-[9px] text-zinc-400">명</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VacantStage({ seed }: { seed: string }) {
  const headline = deterministicOf(COPY.vacantStage.slice(0, 4), seed);
  return (
    <div className="arcade-scanlines arcade-card relative mt-4 overflow-hidden border-2 border-dashed border-arcade-neon/70">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-arcade-neon to-transparent" />
      <CornerMarks neon />

      <div className="relative px-4 py-8 text-center">
        <div className="font-display text-base leading-none tracking-[0.16em] text-zinc-500">
          VACANT_STAGE
        </div>
        <div className="arcade-divider my-3 w-16" />

        <div className="arcade-glow-neon text-2xl font-black tracking-[0.1em] text-arcade-neon">
          {headline}
        </div>
        <div className="mt-2 text-[11px] tracking-arcade text-zinc-400">
          첫 도전자가 전설이 된다
        </div>

        <div className="mt-5 text-sm tracking-arcade-wide text-arcade-neon">
          <span>{">"}</span>
          <span className="arcade-blink ml-1">_</span>
        </div>
      </div>
    </div>
  );
}

function CornerMarks({ neon = false }: { neon?: boolean }) {
  const color = neon ? "text-arcade-neon" : "text-arcade-accent";
  const cls =
    "pointer-events-none absolute select-none font-bold leading-none " + color;
  return (
    <>
      <span className={`${cls} left-1 top-1 text-xs`}>┌</span>
      <span className={`${cls} right-1 top-1 text-xs`}>┐</span>
      <span className={`${cls} bottom-1 left-1 text-xs`}>└</span>
      <span className={`${cls} bottom-1 right-1 text-xs`}>┘</span>
    </>
  );
}
