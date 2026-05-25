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

export default function RankingTabs({ records, activeType }: Props) {
  const [type, setType] = useState<RecordType>(activeType);

  const ranked = useMemo(() => {
    return records
      .filter((r) => r.record_type === type)
      .sort((a, b) => b.value - a.value || a.created_at.localeCompare(b.created_at));
  }, [records, type]);

  return (
    <div className="mt-2">
      <div className="flex gap-1 overflow-x-auto pb-2">
        {RECORD_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`shrink-0 rounded border px-3 py-1 text-xs ${
              type === t.value
                ? "border-arcade-accent bg-arcade-accent text-arcade-bg"
                : "border-arcade-border text-zinc-300 hover:border-arcade-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <div className="rounded border border-dashed border-arcade-border bg-arcade-panel p-6 text-center text-xs text-zinc-400">
          아직 기록이 없어요. 첫 도전자가 되어보세요.
        </div>
      ) : (
        <ol className="overflow-hidden rounded border border-arcade-border bg-arcade-panel">
          <li className="flex items-center justify-between border-b border-arcade-border px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
            <span>RANK · NAME</span>
            <span>SCORE</span>
          </li>
          {ranked.map((r, idx) => {
            const rankClass =
              idx === 0
                ? "arcade-rank-1"
                : idx === 1
                  ? "arcade-rank-2"
                  : idx === 2
                    ? "arcade-rank-3"
                    : "text-zinc-300";
            return (
              <li
                key={r.id}
                className="flex items-center justify-between border-b border-arcade-border/60 px-3 py-2 text-sm last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`w-6 shrink-0 text-right font-bold ${rankClass}`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className={`truncate font-semibold ${rankClass}`}>{r.nickname}</div>
                    {r.memo && (
                      <div className="truncate text-[10px] text-zinc-500">{r.memo}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${rankClass}`}>
                    {r.value.toLocaleString()}
                    <span className="ml-1 text-[10px] text-zinc-400">
                      {RECORD_TYPE_UNIT[type]}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
