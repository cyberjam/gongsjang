// 문파 집계 공용 유틸 (방문 기록 파생)

// 방문 행 목록에서 기여 1위 닉네임 (문주 계산). 동률이면 사전순.
export function topNickname(rows: { nickname: string }[]): string | null {
  const tally = new Map<string, number>();
  for (const r of rows) tally.set(r.nickname, (tally.get(r.nickname) ?? 0) + 1);
  return (
    [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    null
  );
}

// n일 전 날짜 "YYYY-MM-DD" (Asia/Seoul)
export function kstDaysAgo(n: number): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const ms = new Date(`${today}T00:00:00Z`).getTime() - n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
