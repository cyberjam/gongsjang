/**
 * 공스장 카피 라이브러리
 *
 * 톤: 인디게임 / 레트로 아케이드 / 스트릿 / 은둔고수
 * 원칙:
 * - 너무 친절하지 않게. 도발과 무심함 사이.
 * - 영문은 캡스(HIGH SCORE / FIRST BLOOD)로, 한글은 짧고 단정적으로.
 * - 운동앱 어휘 금지("화이팅", "최고예요", "응원해요" X)
 * - 한 줄. 10~22자 사이가 베스트.
 *
 * 사용:
 *   import { COPY, randomOf, deterministicOf, fmt } from "@/lib/copy";
 *   randomOf(COPY.challengePrompt)
 *   deterministicOf(COPY.legendStanding, location.id)
 *   fmt(COPY.submitNewChampion[2], { nickname: "MASTERZ" })
 */

export const COPY = {
  // === 기록 등록 성공 (일반) ===
  submitSuccess: [
    "기록이 점수판에 새겨졌다",
    "SCORE REGISTERED",
    "이 동네에 흔적이 남았다",
    "{nickname}, 이름이 박혔다",
    "거짓말이 안 되는 곳에 숫자가 남았다",
    "이 도장은 당신을 기억한다",
    "한 줄, 새로 그어졌다",
  ],

  // === 기록 등록 — 새 챔피언 등극 ===
  submitNewChampion: [
    "★ 새로운 보스 등장 ★",
    "왕좌가 바뀌었다",
    "NEW CHAMPION",
    "이 도장의 새 주인은 {nickname}",
    "전 보스의 보위, {days}일로 종료",
    "기존 기록을 갈아치웠다",
    "은둔고수가 갱신되었다",
    "RECORD BROKEN",
  ],

  // === 기록 등록 — 도장의 첫 기록 ===
  submitFirstEver: [
    "이 도장의 첫 전설이 되었다",
    "FIRST BLOOD",
    "VACANT_STAGE 해방",
    "{nickname}, 이 동네 초대 챔피언",
    "이 도장은 이제 당신의 것이다",
    "비어있던 자리에 이름이 박혔다",
  ],

  // === 랭킹 헤더 / 보드 타이틀 ===
  rankingHeader: [
    "HIGH SCORE",
    "이 동네 은둔고수들",
    "도장을 거쳐간 자들",
    "거리의 보스 명단",
    "HALL OF FAMERS",
    "WORLD CHAMPIONS",
    "남겨진 이름들",
  ],

  // === 도전 문구 (CTA / 보스 카드 주변) ===
  challengePrompt: [
    "이 기록을 깨러 왔는가",
    "전설은 깨라고 있는 것",
    "동네 보스가 기다린다",
    "도전할 자, 와라",
    "철봉은 거짓말을 하지 않는다",
    "당신의 차례다",
    "기록 앞에 변명은 없다",
    "WAITING FOR CHALLENGER",
  ],

  // === 도전 버튼 라벨 ===
  challengeButton: [
    "▶ 보스 도전",
    "▶ ENTER STAGE",
    "▶ 도전 시작",
    "▶ TAKE THE THRONE",
    "▶ 기록 갱신",
  ],

  // === 전설 기록 — 보스 카드 핵심 문구 ===
  legendStanding: [
    "아직 아무도 이 기록을 넘지 못했다",
    "이 숫자 앞에 모두가 멈춘다",
    "동네는 알지만 아무도 못 깬 숫자",
    "이름조차 모르는 자의 기록",
    "한 번도 떨어진 적 없는 자리",
    "전설은 여기, 새겨져 있다",
    "이 사람을 봤다는 사람은 없다",
  ],

  // === 보스 소개 태그 ===
  legendIntro: [
    "이 동네 은둔고수",
    "지역 전설",
    "동네 보스",
    "거리의 챔피언",
    "출근길에 마주치는 그 사람",
    "이름 없는 강자",
  ],

  // === 빈 도장 (보스 미존재) ===
  vacantStage: [
    "이 도장은 주인이 없다",
    "첫 도전자가 전설이 된다",
    "아직 침묵 속의 도장",
    "당신이 첫 번째 이름이 된다",
    "VACANT_STAGE",
    "기록되지 않은 자리",
  ],

  // === 원정 성공 — 사용자 위치에서 멀리 떨어진 곳에 기록 ===
  expedition: [
    "원정 성공",
    "EXPEDITION COMPLETE",
    "다른 동네에 흔적을 남겼다",
    "WANDERING CHAMP",
    "당신, 떠돌이 챔피언",
    "동네를 벗어난 도장깨기",
    "{distance}km 떨어진 곳까지 와서 박았다",
    "원정군이 입성했다",
  ],

  // === 철봉 발견 — 새 장소 등록 ===
  newStage: [
    "새 도장이 발견되었다",
    "NEW STAGE UNLOCKED",
    "지도에 점이 하나 더 찍혔다",
    "STAGE DISCOVERED",
    "새로운 전장이 열렸다",
    "이 동네에 도장이 생겼다",
    "{nickname}이 찾아낸 자리",
    "AREA EXPANDED",
  ],

  // === 장소 설명 placeholder / 샘플 ===
  placeDescriptions: [
    "그늘 아래, 누군가의 기록이 잠들어 있는 곳",
    "비 오는 날에도 누가 와있는 곳",
    "철봉 두 개, 평행봉 하나, 전설 다수",
    "동네 헬창들의 베이스",
    "출근길 마주치던 형이 도장 깨던 곳",
    "지나가던 외국인이 풀업하고 가는 곳",
    "한낮의 도장",
    "새벽의 신성한 장소",
    "지나가면 보이고, 들르면 무너지는",
    "공원 끝, 사람들이 안 보는 곳",
  ],

  // === 시스템 — 에러 ===
  error: [
    "GAME ERROR",
    "통신 끊김",
    "신호가 약하다",
    "다시 시도해라",
    "동전이 부족하다",
    "서버가 잠들었다",
  ],

  // === 시스템 — 로딩 ===
  loading: [
    "LOADING...",
    "도장을 불러오는 중",
    "전설 명단 조회 중",
    "PROCESSING...",
    "기록 가져오는 중",
  ],

  // === 시스템 — 404 / 없음 ===
  notFound: [
    "GAME OVER",
    "이 도장은 존재하지 않는다",
    "길을 잃었다",
    "INSERT COIN TO CONTINUE",
    "지도에 없는 자리",
  ],

  // === 푸터 / 태그라인 ===
  tagline: [
    "동네 철봉 도장깨기",
    "은둔고수의 기록을 깨라",
    "현실의 도장깨기",
    "INSERT COIN · 공스장",
    "거리에 흔적을 남겨라",
    "이름을 새겨라",
    "STREET RANKING",
  ],

  // === 브랜드 ===
  brand: {
    kr: "공스장",
    en: "GONGSJANG",
    tagline: "동네 철봉 도장깨기",
    full: "공스장 — 동네 철봉 도장깨기",
  },

  // === NEW! 같은 짧은 배지 ===
  badges: {
    new: "NEW!",
    hot: "HOT",
    boss: "BOSS",
    legend: "LEGEND",
    fresh: "FRESH",
    rookie: "ROOKIE",
  },

  // === 종목명 영문 풀네임 ===
  eventCaps: {
    pullup: "PULL-UP",
    chinup: "CHIN-UP",
    muscleup: "MUSCLE-UP",
    hang: "DEAD HANG",
  },
} as const;

// === Helpers ===

/** 매번 다른 카피가 필요한 곳에 사용 (예: 토스트) */
export function randomOf<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 같은 seed → 같은 결과.
 * 보스 카드처럼 화면 새로고침마다 바뀌면 안 되는 곳에 사용.
 * 예: deterministicOf(COPY.legendStanding, location.id)
 */
export function deterministicOf<T>(list: readonly T[], seed: string | number): T {
  const s = String(seed);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return list[Math.abs(hash) % list.length];
}

/** {nickname} / {days} / {distance} 같은 토큰 치환 */
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
