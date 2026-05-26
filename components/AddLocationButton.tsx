"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AddLocationButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickCurrentLocation() {
    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 정보를 지원하지 않아요.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => setError("위치를 가져오지 못했어요: " + e.message),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!coords) {
      setError("현재 위치를 먼저 가져와주세요.");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("locations")
      .insert({
        name: name.trim(),
        address: address.trim() || null,
        description: description.trim() || null,
        lat: coords.lat,
        lng: coords.lng,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
    if (data?.id) router.push(`/locations/${data.id}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="arcade-btn rounded border border-arcade-accent px-2.5 py-1 text-[11px] tracking-[0.15em] text-arcade-accent hover:bg-arcade-accent hover:text-arcade-bg hover:shadow-[0_0_12px_rgba(255,210,63,0.35)]"
      >
        + 철봉 추가
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md animate-[gj-slide-up_0.22s_ease-out] rounded-t border-t-2 border-arcade-accent bg-arcade-panel p-4 shadow-[0_-8px_24px_rgba(255,210,63,0.18)] sm:rounded sm:border-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-sm font-bold text-arcade-accent">새 스테이지 등록</div>

            <label className="mb-2 block text-[11px] text-zinc-400">이름 *</label>
            <input
              className="arcade-input mb-3 bg-arcade-bg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 한강공원 뚝섬 철봉"
            />

            <label className="mb-2 block text-[11px] text-zinc-400">주소</label>
            <input
              className="arcade-input mb-3 bg-arcade-bg"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울 광진구 자양동"
            />

            <label className="mb-2 block text-[11px] text-zinc-400">한줄 소개</label>
            <textarea
              className="arcade-input mb-3 bg-arcade-bg"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 철봉 2개, 그늘 좋음"
            />

            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={pickCurrentLocation}
                type="button"
                className="arcade-btn-ghost px-2.5 py-1 text-[11px]"
              >
                현재 위치 가져오기
              </button>
              <span className="text-[11px] text-zinc-400">
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : "위치 미설정"}
              </span>
            </div>

            {error && (
              <div className="mb-2 text-[11px] text-arcade-danger">{error}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="arcade-btn-ghost flex-1 px-3 py-2 text-sm"
              >
                취소
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="arcade-btn-primary flex-1 px-3 py-2 text-sm"
              >
                {loading ? "등록 중..." : "▶ 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
