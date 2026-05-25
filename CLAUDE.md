# 공스장 (GONG-JANG) - Claude 작업 지침

## 프로젝트 정체성

GPS 기반 동네 철봉 랭킹 웹앱. **운동 앱이 아니라 인디게임**이다.

- 동네 철봉을 스테이지로 보는 **현실 기반 도장깨기 게임**
- 옛날 오락실 HIGH SCORE 점수판 감성
- 이름 모를 은둔고수의 기록을 깨러 가는 서사
- 스트릿 운동 문화 + 지역 전설 느낌

---

## 디자인 시스템 (Single Source of Truth)

### 1. 컬러 — `tailwind.config.ts → arcade.*`

| 토큰 | HEX | 용도 |
|---|---|---|
| `arcade-bg` | `#0a0a0f` | 화면 배경 |
| `arcade-panel` | `#15151f` | 카드/패널 배경 |
| `arcade-inset` | `#0e0e16` | 카드 안쪽 inset 배경 |
| `arcade-border` | `#2a2a3a` | 1px 보더 |
| `arcade-accent` | `#ffd23f` | 금색 — primary, 1등, 보스 |
| `arcade-neon` | `#39ff14` | 네온 그린 — 현재위치, 첫 도전자 |
| `arcade-danger` | `#ff3864` | 빨강 — HOT, 경고, 전설 강조 |
| `arcade-muted` | `#888fa0` | 보조 텍스트 |

### 2. 폰트 — 모노스페이스 고정

`ui-monospace, SFMono-Regular, Menlo` 전체. **산세리프 금지.**

### 3. 글자 트래킹 (letter-spacing)

세 단계만 사용:

| 클래스 | 값 | 용도 |
|---|---|---|
| `tracking-arcade` | `0.18em` | 일반 캡스 라벨 (대다수) |
| `tracking-arcade-wide` | `0.28em` | CTA, 섹션 헤더 |
| `tracking-arcade-xwide` | `0.42em` | 강조 라벨 (✦ STAGE BOSS ✦, VACANT_SEAT) |

### 4. Glow / 그림자 토큰

| 클래스 | 색상 / 강도 |
|---|---|
| `shadow-arcade-glow-sm` | 금 약 |
| `shadow-arcade-glow` | 금 기본 |
| `shadow-arcade-glow-lg` | 금 강 (primary hover) |
| `shadow-arcade-glow-neon` | 네온 그린 기본 |
| `shadow-arcade-glow-neon-lg` | 네온 그린 강 |
| `shadow-arcade-glow-danger` | 빨강 |
| `shadow-arcade-card-hover` | 카드 hover lift |

### 5. 컴포넌트 클래스 — `app/globals.css`

#### 카드
- `.arcade-card` — 기본 패널 카드 (border 1px)
- `.arcade-card-feature` — 강조 카드 (border-2 + 금색 + glow)
- `.arcade-card-tap` — 누를 수 있는 카드 (hover lift + active press)

#### 박스/라벨
- `.arcade-stat` — 카드 안쪽 작은 통계 박스
- `.arcade-label` — `text-[9px] uppercase tracking-arcade text-zinc-500`
- `.arcade-label-wide` — `tracking-arcade-wide` 변형
- `.arcade-divider` — 가운데 회색 그라데이션 가로줄
- `.arcade-divider-accent` — 금색 광선 가로줄

#### 버튼
- `.arcade-btn-primary` — 금색 솔리드 CTA, hover 시 광선 sweep + glow 확장
- `.arcade-btn-ghost` — 테두리 보조 버튼
- `.arcade-btn-neon` — 네온 그린 아이콘 버튼

#### 칩/입력
- `.arcade-chip` — 작은 태그 (HOT/NEW/BOSS), 색상은 `border-arcade-*` 인라인으로
- `.arcade-input` — 입력 필드 (focus 시 금색 보더 + glow)

#### 효과
- `.arcade-scanlines` — CRT 스캔라인 ::before 오버레이
- `.arcade-glow-gold` / `.arcade-glow-neon` — phosphor 텍스트 그림자 + 펄스
- `.arcade-blink` — 1초 깜빡임
- `.arcade-fade-in` — 페이지 진입 0.25s

### 6. 타이포그래피 스케일

| 역할 | 크기 | 예시 |
|---|---|---|
| 마이크로 라벨 | `text-[9px]` | "STAGES", "DEFEATED" |
| 캡션 | `text-[10px]` | 메타 정보 |
| 본문 보조 | `text-[11px]` | 도전 안내, 주소 |
| 본문 | `text-xs` (12px) | 설명 |
| 인터랙티브 본문 | `text-sm` (14px) | 버튼, 폼 |
| 페이지 타이틀 | `text-base` ~ `text-lg` | h1 |
| 챔피언 닉네임 | `text-3xl` | 보스 카드 |
| 챔피언 점수 | `text-5xl` ~ `[3.5rem]` | 거대 숫자 |

### 7. Spacing

- 페이지 패딩: `px-4`
- 카드 패딩: `p-3` ~ `p-4`
- 박스 패딩: `px-3 py-2`
- 섹션 간격: `mt-4` ~ `mt-6`
- 컴포넌트 내부: `gap-2`, `gap-3`

### 8. 모바일 일관성

- 부모 컨테이너: `max-w-md mx-auto` (layout.tsx에 적용됨)
- 터치 타깃 최소 44px (`h-11` 또는 `py-3`)
- 100dvh 사용 (iOS Safari 툴바 대응)
- `-webkit-tap-highlight-color: transparent` (전역)
- `select-none` 인터랙티브 요소
- `:focus-visible` 금색 outline

---

## ✅ Always / ❌ Never

### ✅ Always
- 새 화면도 위 토큰/클래스 우선 사용
- 카드는 `.arcade-card` 계열로 시작
- 라벨은 `.arcade-label` 계열로
- 버튼은 `.arcade-btn-*` 계열로
- 영문 캡스 + 한글 짧게
- 1등 금색, 2등 은색, 3등 동색
- 모바일 우선

### ❌ Never
- 흰색 배경, 파스텔
- `rounded-xl` 이상 (큰 둥근 모서리)
- 산세리프 본문
- 친절한 응원 카피 ("화이팅", "최고예요" 금지)
- 운동앱/SaaS 톤
- 새 색상/트래킹/그림자 인라인 추가 (토큰부터 보기)
- 이모지 남용 (마이크로카피로 분위기 만들기)

### 안티패턴 예시

```tsx
// ❌ 헬스앱 느낌
<div className="bg-white rounded-3xl shadow-lg p-6">
  <h2 className="text-2xl font-bold text-gray-900">오늘의 운동</h2>
  <p className="text-gray-600">화이팅! 💪</p>
</div>

// ✅ 아케이드 (토큰 + 컴포넌트 클래스)
<div className="arcade-card p-3">
  <div className="arcade-label">HIGH SCORE</div>
  <h2 className="arcade-title text-base font-bold text-arcade-accent">
    한강공원 뚝섬
  </h2>
  <p className="text-[11px] text-zinc-400">동네 은둔고수의 기록을 깨라</p>
</div>
```

---

## 카피 라이브러리

`lib/copy.ts` — 14 카테고리 50+ 문구. 새 화면에 카피 필요하면 여기서 먼저 찾기.

```ts
import { COPY, randomOf, deterministicOf, fmt } from "@/lib/copy";

deterministicOf(COPY.legendStanding, location.id)  // 도장마다 다른, 새로고침 안정
randomOf(COPY.submitSuccess)                        // 토스트
fmt(COPY.submitNewChampion[2], { nickname })        // 토큰 치환
```

---

## 스택 & 구조

- Next.js 14 App Router · TypeScript · TailwindCSS
- Supabase (Postgres + RLS, MVP는 익명 닉네임)
- Kakao Maps JavaScript SDK

```
app/                  # 페이지 (지도 / 목록 / 상세+랭킹 / 기록등록)
components/           # 클라이언트 컴포넌트
lib/copy.ts           # 카피 라이브러리
lib/supabase/         # 브라우저/서버 클라이언트
lib/types.ts          # RecordType, Location, LocationWithStats 등
supabase/schema.sql   # 테이블 + RLS + 샘플 데이터
```

## 코드 스타일

- MVP 단계: **단순·직선적·과한 추상화 금지**
- 컴포넌트는 한 파일에 한 가지 책임
- 주석은 WHY가 비자명할 때만
- 새 UI 코드는 위 디자인 시스템 토큰/클래스 우선 사용
- 새 토큰이 필요하면 `tailwind.config.ts`나 `globals.css`에 추가 후 사용

## 환경변수

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_KAKAO_MAP_KEY
```

Vercel Production/Preview/Development 모두 설정. `NEXT_PUBLIC_*`은 빌드 inline이라 변경 시 재배포 필요.
