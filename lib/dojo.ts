// 공스장 — 도장 로직 유틸 (서버·클라이언트 공용)
// 살아있는 도장처럼 보이게 하는 파생 데이터 계산

import type { RecordRow, RecordType } from "./types";

export type Master = {
  record: RecordRow;
  crownedAt: string;   // 마스터가 된 시점
  dethronedAt: string | null;  // 다음 마스터에게 자리 내준 시점 (null = 현재 마스터)
  daysHeld: number;    // 보위 일수
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 시간 순서대로 마스터 교체 history 계산. 마지막이 현재 마스터. */
export function masterHistory(records: RecordRow[], type: RecordType = "pullup"): Master[] {
  const sorted = records
    .filter((r) => r.record_type === type)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const masters: Master[] = [];
  let current: Master | null = null;

  for (const r of sorted) {
    if (!current || r.value > current.record.value) {
      if (current) {
        current.dethronedAt = r.created_at;
        current.daysHeld = daysBetween(current.crownedAt, r.created_at);
      }
      current = {
        record: r,
        crownedAt: r.created_at,
        dethronedAt: null,
        daysHeld: 0,
      };
      masters.push(current);
    }
  }

  // 현재 마스터의 보위 일수 (지금까지)
  if (current) {
    current.daysHeld = daysBetween(current.crownedAt, new Date().toISOString());
  }

  return masters;
}

export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS));
}

/** 시간을 도장스럽게 풀어 표시 (오늘 / 3일 전 / 지난주 / 지난달 / 작년 봄 등) */
export function fuzzyAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const days = Math.floor(diffMs / DAY_MS);

  if (days < 0) return "방금";
  if (days === 0) {
    const h = Math.floor(diffMs / (60 * 60 * 1000));
    if (h < 1) return "방금";
    if (h < 6) return `${h}시간 전`;
    return "오늘";
  }
  if (days === 1) return "어제";
  if (days <= 6) return `${days}일 전`;
  if (days <= 13) return "지난주";
  if (days <= 30) return `${Math.floor(days / 7)}주 전`;
  if (days <= 60) return "지난달";
  if (days <= 365) return `${Math.floor(days / 30)}달 전`;
  const yrs = Math.floor(days / 365);
  return `${yrs}년 전`;
}

/** 마스터 보위 일수 라벨 ("오늘 갱신" / "N일째 무패" / "N개월째 무패") */
export function reignLabel(daysHeld: number): string {
  if (daysHeld === 0) return "오늘 갱신";
  if (daysHeld < 30) return `${daysHeld}일째 무패`;
  const months = Math.floor(daysHeld / 30);
  return `${months}개월째 무패`;
}

/** 30일 이상 보위 → ★ 고수 */
export function isElder(daysHeld: number): boolean {
  return daysHeld >= 30;
}

/** 주소에서 ○○동/읍/면 추출 */
export function extractDong(address: string | null | undefined): string | null {
  if (!address) return null;
  return address.match(/([가-힣]+(?:동|읍|면))/)?.[1] ?? null;
}

/** 주소에서 ○○구/군 추출 */
export function extractGu(address: string | null | undefined): string | null {
  if (!address) return null;
  return address.match(/([가-힣]+구|[가-힣]+군)/)?.[1] ?? null;
}
