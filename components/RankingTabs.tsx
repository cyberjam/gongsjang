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

const RANK_COLOR = ["arcade-rank-1", "arcade-rank-2", "arcade-rank-3"] as const;

function fmtDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default function RankingTabs({ records, activeType }: Props) {
  const [type, setType] = useState<RecordType>(activeType);
  const unit = RECORD_TYPE_UNIT[type];

  const ranked = useMemo(() => {
    return records
      .filter((r) => r.record_type === type)
      .sort(
        (a, b) =>
          b.value - a.value || a.created_at.localeCompare(b.created_at),
      );
  }, [records, type]);

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const typeLabel =
    RECORD_TYPES.find((t) => t.value === type)?.label.toUpperCase() ?? "";

  return (
    <section className="space-y-4">
      {/* 종목 탭 — 글로우 없이 단순 */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {RECORD_TYPES.map((t) => {
          const active = type === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-bold tracking-arcade transition ${
                active
                  ? "border-arcade-border bg-arcade-panel text-arcade-accent"
                  : "border-arcade-border/40 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className={active ? "" : "opacity-0"}>›</span>
              <span>{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      {/* TOP 3 — 강조 (단, 글로우 X) */}
      <div className="rounded border border-arcade-border bg-arcade-panel/50">
        <header className="flex items-center justify-between border-b border-arcade-border px-3 py-1.5">
          <span className="arcade-label-wide">TOP 3</span>
          <span className="arcade-label-wide text-arcade-accent">
            {typeLabel}
          </span>
        </header>

        {top3.length === 0 ? (
          <div className="px-3 py-7 text-center text-[11px] text-zinc-500">
            첫 도전자가 되어보세요
          </div>
        ) : (
          <ol>
            {top3.map((r, idx) => {
              const colorClass = RANK_COLOR[idx];
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 border-b border-arcade-border/30 px-3 py-2.5 last:border-b-0"
                >
                  <span
                    className={`font-display w-5 text-right text-base leading-none tabular-nums ${colorClass}`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm font-semibold ${colorClass}`}
                  >
                    {r.nickname}
                  </span>
                  <span
                    className={`font-display whitespace-nowrap text-lg leading-none tabular-nums ${colorClass}`}
                  >
                    {r.value.toLocaleString()}
                    <span className="ml-1 text-[10px] text-zinc-500">
                      {unit}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* 전체 랭킹 (4위~) — 색 강조 없이 깔끔한 행 */}
      {rest.length > 0 && (
        <div>
          <header className="mb-1.5 flex items-center justify-between px-1">
            <span className="arcade-label-wide">RANKING</span>
            <span className="arcade-label-wide">{rest.length}명</span>
          </header>
          <ol>
            {rest.map((r, idx) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-arcade-border/20 px-1 py-2 text-zinc-400 last:border-b-0"
              >
                <span className="font-display w-8 text-right text-sm leading-none tabular-nums text-zinc-500">
                  {String(idx + 4).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {r.nickname}
                </span>
                <span className="font-display whitespace-nowrap text-sm leading-none tabular-nums">
                  {r.value.toLocaleString()}
                  <span className="ml-1 text-[10px] text-zinc-500">
                    {unit}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 px-1 text-right text-[10px] text-zinc-600">
            마지막 갱신 {fmtDate(rest[rest.length - 1]!.created_at)}
          </div>
        </div>
      )}
    </section>
  );
}
