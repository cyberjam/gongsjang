/**
 * 공스장 카피 라이브러리
 *
 * 톤: 동네 철봉 도장 / CRT 점수판 / 무거운 정적 분위기
 * 원칙:
 * - "도장"의 어휘 — 마스터, 도전자, 수성, 무주공산, 개척자, 격파
 * - 금지어 — 운동, 헬스, 피트니스, 사용자, 회원, TOP (랭킹 표기)
 * - 친절·응원 어휘 금지 — 화이팅/최고예요/응원해요 X
 * - 한 줄. 10~22자 사이.
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

  // === 새 마스터 등극 ===
  submitNewChampion: [
    "★ 새 마스터 등극 ★",
    "왕좌가 바뀌었다",
    "MASTER CHANGED",
    "이 도장의 새 주인은 {nickname}",
    "전 마스터의 수성, {days}일로 종료",
    "기존 기록을 갈아치웠다",
    "도장의 주인이 갱신되었다",
    "RECORD BROKEN",
  ],

  // === 첫 기록 — 1대 마스터 = 개척자 ===
  submitFirstEver: [
    "이 도장의 개척자가 되었다",
    "FIRST BLOOD",
    "무주공산을 점령했다",
    "{nickname}, 1대 마스터",
    "이 도장은 이제 당신의 것이다",
    "비어있던 자리에 이름이 박혔다",
  ],

  // === 랭킹 헤더 (점수판 타이틀) ===
  rankingHeader: [
    "HIGH SCORE",
    "이 동네 도전자들",
    "도장을 거쳐간 자들",
    "거리의 마스터 명단",
    "HALL OF MASTERS",
    "WORLD CHAMPIONS",
    "남겨진 이름들",
  ],

  // === 도전 문구 (CTA / 마스터 카드 주변) ===
  challengePrompt: [
    "이 기록을 깨러 왔는가",
    "마스터의 기록은 깨라고 있는 것",
    "도장의 주인이 기다린다",
    "도전할 자, 와라",
    "철봉은 거짓말을 하지 않는다",
    "당신의 차례다",
    "기록 앞에 변명은 없다",
    "WAITING FOR CHALLENGER",
  ],

  // === 도전 버튼 라벨 ===
  challengeButton: [
    "▸ 마스터 도전",
    "▸ ENTER DOJO",
    "▸ 기록 남기기",
    "▸ TAKE THE THRONE",
    "▸ 격파",
  ],

  // === 마스터 수성 문구 ===
  legendStanding: [
    "아직 아무도 이 기록을 넘지 못했다",
    "이 숫자 앞에 모두가 멈춘다",
    "동네는 알지만 아무도 못 깬 숫자",
    "이름조차 모르는 자의 기록",
    "한 번도 떨어진 적 없는 자리",
    "이 사람을 봤다는 자는 없다",
  ],

  // === 마스터 소개 태그 ===
  legendIntro: [
    "이 도장의 주인",
    "지역 전설",
    "동네 마스터",
    "거리의 챔피언",
    "출근길에 마주치는 그 사람",
    "이름 없는 강자",
  ],

  // === 빈 도장 — 무주공산 ===
  vacantStage: [
    "이 도장은 아직 주인이 없습니다",
    "무주공산",
    "첫 도전자가 1대 마스터",
    "아직 침묵 속의 도장",
    "당신이 첫 번째 이름이 된다",
    "VACANT",
  ],

  // === 빈 지역 (지도/목록 페이지) ===
  vacantRegion: [
    "당신이 첫 개척자입니다",
    "이 동네는 아직 무주공산",
    "지도에 점이 없는 곳",
    "기록되지 않은 동네",
  ],

  // === 원정 — 자기 동네 밖 기록 ===
  expedition: [
    "원정 성공",
    "EXPEDITION COMPLETE",
    "다른 동네에 흔적을 남겼다",
    "WANDERING MASTER",
    "당신, 떠돌이 마스터",
    "동네를 벗어난 도장깨기",
    "{distance}km 떨어진 곳까지 와서 박았다",
  ],

  // === 새 도장 발견 ===
  newStage: [
    "새 도장이 발견되었다",
    "NEW DOJO UNLOCKED",
    "지도에 점이 하나 더 찍혔다",
    "DOJO DISCOVERED",
    "새로운 전장이 열렸다",
    "이 동네에 도장이 생겼다",
    "{nickname}이 찾아낸 자리",
  ],

  // === 장소 설명 placeholder ===
  placeDescriptions: [
    "그늘 아래, 누군가의 기록이 잠들어 있는 곳",
    "비 오는 날에도 누가 와있는 곳",
    "철봉 두 개, 평행봉 하나, 전설 다수",
    "동네 도전자들의 베이스",
    "출근길 마주치던 그 사람이 도장 깨던 곳",
    "지나가던 외지인이 풀업하고 가는 곳",
    "한낮의 도장",
    "새벽의 신성한 장소",
    "지나가면 보이고, 들르면 무너지는",
    "공원 끝, 사람들이 안 보는 곳",
  ],

  // === 시스템 ===
  error: [
    "GAME ERROR",
    "통신 끊김",
    "신호가 약하다",
    "다시 시도해라",
    "동전이 부족하다",
  ],

  loading: [
    "LOADING...",
    "도장을 불러오는 중",
    "도전자 명단 조회 중",
    "PROCESSING...",
    "기록 가져오는 중",
  ],

  notFound: [
    "GAME OVER",
    "이 도장은 존재하지 않는다",
    "길을 잃었다",
    "INSERT COIN TO CONTINUE",
    "지도에 없는 자리",
  ],

  // === 태그라인 ===
  tagline: [
    "동네 철봉 도장",
    "마스터의 기록을 깨라",
    "현실의 도장깨기",
    "INSERT COIN · 공스장",
    "거리에 흔적을 남겨라",
    "이름을 새겨라",
    "STREET DOJO",
  ],

  // === 짧은 배지 ===
  badges: {
    new: "NEW",
    elder: "★ 고수",
    master: "MASTER",
    pioneer: "PIONEER",
    fresh: "FRESH",
    rookie: "ROOKIE",
  },

  // === 종목 ===
  eventCaps: {
    pullup: "PULL-UP",
    chinup: "CHIN-UP",
    muscleup: "MUSCLE-UP",
    hang: "DEAD HANG",
  },

  // === 브랜드 ===
  brand: {
    kr: "공스장",
    en: "GONGSJANG",
    tagline: "동네 철봉 도장",
    full: "공스장 — 동네 철봉 도장",
    activeRegion: "현재 활성 지역: 청주·오송",
  },
} as const;

// === Helpers ===

export function randomOf<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function deterministicOf<T>(list: readonly T[], seed: string | number): T {
  const s = String(seed);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return list[Math.abs(hash) % list.length];
}

export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
