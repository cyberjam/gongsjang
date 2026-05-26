"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  RECORD_TYPES,
  RECORD_TYPE_UNIT,
  type RecordType,
} from "@/lib/types";

const NICKNAME_KEY = "gongsjang_nickname";

export default function RecordForm({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(NICKNAME_KEY) ?? "";
  });
  const [type, setType] = useState<RecordType>("pullup");
  const [value, setValue] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (trimmedNickname.length > 12) {
      setError("닉네임은 12자 이하로 입력해주세요.");
      return;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
      setError("기록은 양의 정수로 입력해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("records").insert({
      location_id: locationId,
      nickname: trimmedNickname,
      record_type: type,
      value: num,
      memo: memo.trim() || null,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    localStorage.setItem(NICKNAME_KEY, trimmedNickname);
    router.push(`/locations/${locationId}?type=${type}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] text-zinc-400">닉네임 (최대 12자)</label>
        <input
          className="arcade-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="예: AAA, 은둔고수"
          maxLength={12}
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-zinc-400">종목</label>
        <div className="grid grid-cols-4 gap-2">
          {RECORD_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded border px-2 py-2 text-xs ${
                type === t.value
                  ? "border-arcade-accent bg-arcade-accent text-arcade-bg"
                  : "border-arcade-border text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-zinc-400">
          기록 ({RECORD_TYPE_UNIT[type]})
        </label>
        <input
          className="arcade-input text-lg font-bold tracking-wider"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-zinc-400">메모 (선택)</label>
        <textarea
          className="arcade-input"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 비 와서 미끄러웠음"
          maxLength={200}
        />
      </div>

      {error && <div className="text-[12px] text-arcade-danger">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="arcade-btn-primary font-display w-full py-3 text-lg leading-none tracking-[0.18em]"
      >
        {loading ? "등록 중..." : "▶ SUBMIT SCORE"}
      </button>
    </form>
  );
}
