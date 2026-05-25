"use client";

import { useMemo, useState } from "react";
import {
  RECORD_TYPES,
  RECORD_TYPE_UNIT,
  type RecordRow,
  type RecordType,
} from "@/lib/types";

type Props = {
  locationId: string;
  records: RecordRow[];
  activeType: RecordType;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function isFresh(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

export default function RankingTabs({ records, activeType }: Props) {
  const [type, setType] = useState<RecordType>(activeType);
  const unit = RECORD_TYPE_UNIT[type];

  const ranked = useMemo(() => {
    return records
      .filter((r) => r.record_type === type)
      .sort((a, b) => b.value - a.value || a.created_at.localeCompare(b.created_at));
  }, [records, type]);

  const champion = ranked[0];
  const challengers = ranked.slice(1);

  return (
    <div>
      {/* MODE SELECT */}
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {RECORD_TYPES.map((t) => {
          const active = type === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`arcade-btn shrink-0 gap-1.5 rounded border px-3 py-1.5 text-[11px] font-bold tracking-arcade ${
                active
                  ? "border-arcade-accent bg-arcade-accent/10 text-arcade-accent shadow-arcade-glow-sm"
                  : "border-arcade-border text-zinc-400 hover:border-arcade-accent/60"
              }`}
            >
              <span className={active ? "text-arcade-accent" : "opacity-0"}>▶</span>
              <span>{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      {/* SCOREBOARD */}
      <div className="arcade-scanlines arcade-card overflow-hidden border-2">
        <div className="border-b border-arcade-border bg-arcade-bg/40 px-3 py-2">
          <div className="font-display flex items-center justify-between text-base leading-none tracking-[0.18em] text-zinc-500">
            <span>HIGH SCORE</span>
            <span className="text-arcade-accent">
              {RECORD_TYPES.find((t) => t.value === type)?.label.toUpperCase()}
            </span>
          </div>
        </div>

        {champion ? (
          <ChampionCard champion={champion} unit={unit} />
        ) : (
          <VacantSeat />
        )}

        {champion && (
          <ChallengerList challengers={challengers} unit={unit} />
        )}
      </div>
    </div>
  );
}

function ChampionCard({ champion, unit }: { champion: RecordRow; unit: string }) {
  return (
    <div className="relative border-b border-arcade-accent/30 px-4 py-5 text-center">
      <div className="absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-arcade-accent to-transparent" />

      <div className="font-display text-base leading-none tracking-[0.16em] text-arcade-accent">
        ★ ROUND CHAMPION ★
      </div>

      <div className="arcade-glow-gold font-display mt-3 truncate text-4xl leading-none tracking-[0.04em] text-arcade-accent">
        {champion.nickname}
      </div>

      <div className="mt-3 flex items-baseline justify-center gap-1">
        <span className="arcade-glow-gold font-display text-[4.25rem] leading-none text-arcade-accent tabular-nums">
          {champion.value.toLocaleString()}
        </span>
        <span className="text-xs tracking-wider text-zinc-400">{unit}</span>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] tracking-arcade text-zinc-500">
        <span>{fmtDate(champion.created_at)}</span>
        {isFresh(champion.created_at) && (
          <span className="arcade-chip arcade-blink border-arcade-danger text-arcade-danger">
            NEW!
          </span>
        )}
      </div>
      {champion.memo && (
        <div className="mt-2 truncate text-[10px] italic text-zinc-500">
          “{champion.memo}”
        </div>
      )}
    </div>
  );
}

function VacantSeat() {
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-[10px] tracking-arcade-xwide text-zinc-500">VACANT_SEAT</div>
      <div className="arcade-divider my-3 w-16" />
      <div className="arcade-glow-neon text-xl font-black tracking-[0.12em] text-arcade-neon">
        BE THE FIRST
      </div>
      <div className="mt-2 text-[11px] text-zinc-400">동네 첫 도전자가 되어라</div>
      <div className="mt-5 text-[11px] tracking-arcade-wide text-arcade-neon">
        <span>{">"}</span>
        <span className="arcade-blink ml-1">_</span>
      </div>
    </div>
  );
}

function ChallengerList({
  challengers,
  unit,
}: {
  challengers: RecordRow[];
  unit: string;
}) {
  return (
    <ol>
      <li className="flex items-center justify-between border-b border-arcade-border/70 bg-arcade-bg/30 px-3 py-1.5 arcade-label-wide">
        <span>RANK · NAME</span>
        <span>SCORE</span>
      </li>

      {challengers.length === 0 && (
        <li className="px-3 py-4 text-center text-[11px] tracking-arcade text-zinc-500">
          <span>NEXT SLOT </span>
          <span className="text-arcade-neon">VACANT</span>
          <span className="arcade-blink ml-1 text-arcade-neon">_</span>
        </li>
      )}

      {challengers.map((r, idx) => {
        const rank = idx + 2; // 1등은 챔피언 카드
        const colorClass =
          rank === 2
            ? "arcade-rank-2"
            : rank === 3
              ? "arcade-rank-3"
              : "text-zinc-300";
        const symbol = rank === 2 ? "◆" : rank === 3 ? "◇" : "·";
        return (
          <li
            key={r.id}
            className="flex items-center justify-between border-b border-arcade-border/40 px-3 py-2 text-sm last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`font-display w-8 shrink-0 text-right text-base leading-none tabular-nums ${colorClass}`}
              >
                #{String(rank).padStart(2, "0")}
              </span>
              <span className={`shrink-0 ${colorClass}`}>{symbol}</span>
              <div className="min-w-0">
                <div className={`truncate font-semibold tracking-wider ${colorClass}`}>
                  {r.nickname}
                </div>
                {r.memo && (
                  <div className="truncate text-[10px] italic text-zinc-500">
                    “{r.memo}”
                  </div>
                )}
              </div>
              {isFresh(r.created_at) && (
                <span className="arcade-chip arcade-blink shrink-0 border-arcade-danger text-arcade-danger">
                  NEW
                </span>
              )}
            </div>
            <div className="text-right tabular-nums">
              <div className={`font-display text-lg leading-none ${colorClass}`}>
                {r.value.toLocaleString()}
                <span className="ml-0.5 text-[10px] text-zinc-400">{unit}</span>
              </div>
              <div className="text-[10px] tracking-wider text-zinc-500">
                {fmtDate(r.created_at)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
