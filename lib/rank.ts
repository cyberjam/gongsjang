// 계급 — 방문일 수 기반. 수치는 여기 상수로만 관리.
export type Rank = { name: string; minDays: number };

// minDays 내림차순
export const RANKS: Rank[] = [
  { name: "은둔고수", minDays: 100 },
  { name: "관장 후보", minDays: 30 },
  { name: "사범", minDays: 7 },
  { name: "수련생", minDays: 0 }, // 1~6일(및 0)
];

export function rankForDays(days: number): string {
  return (RANKS.find((r) => days >= r.minDays) ?? RANKS[RANKS.length - 1]).name;
}
