// 칭호 — 풀업 횟수가 아니라 "운동 나간 날짜 수(총 방문일)" 기반.
// "꾸준히 밖에 나가는 게임" 철학. 임계값은 누적 방문일.

export type Title = { name: string; minDays: number };

// minDays 내림차순 — 높은 칭호부터 매칭
export const TITLES: Title[] = [
  { name: "무림지존", minDays: 180 },
  { name: "절정고수", minDays: 90 },
  { name: "하급고수", minDays: 30 },
  { name: "입문무사", minDays: 7 },
  { name: "수련생", minDays: 0 },
];

export function titleForDays(days: number): string {
  const t = TITLES.find((t) => days >= t.minDays);
  return (t ?? TITLES[TITLES.length - 1]).name;
}

// 다음 칭호까지 남은 방문일 (최고 칭호면 null)
export function nextTitle(days: number): { name: string; remaining: number } | null {
  const higher = [...TITLES].reverse().find((t) => t.minDays > days);
  return higher ? { name: higher.name, remaining: higher.minDays - days } : null;
}
