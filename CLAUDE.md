# 공스장 (GONG-JANG) - Claude 작업 지침

## 프로젝트 정체성

GPS 기반 동네 철봉 랭킹 웹앱. **운동 앱이 아니라 인디게임**이다.

- 동네 철봉을 스테이지로 보는 **현실 기반 도장깨기 게임**
- 옛날 오락실 HIGH SCORE 점수판 감성
- 이름 모를 은둔고수의 기록을 깨러 가는 서사
- 스트릿 운동 문화 + 지역 전설 느낌

## UI 디자인 직시 (DESIGN DIRECTIVE)

### ✅ Always
- **다크 테마**: `bg-arcade-bg` (#0a0a0f) 베이스
- **네온 강조**: 노란색 `arcade-accent` (#ffd23f), 초록 `arcade-neon` (#39ff14), 빨강 `arcade-danger` (#ff3864)
- **모노스페이스 폰트**: 본문/제목 전부 `font-mono` 또는 `ui-monospace`
- **모바일 우선**: `max-w-md` 컨테이너, 터치 친화 사이즈
- **아케이드 마이크로카피**: STAGE SELECT, HIGH SCORE, GAME OVER, INSERT COIN, ENTER YOUR SCORE, CONTINUE, PLAY, RANK, SCORE
- **랭킹 메달 색**: 1등 금(`arcade-rank-1`), 2등 은, 3등 동
- **모서리 각진 박스**: `rounded` (4px) 정도까지만. `rounded-2xl` 이상 금지
- **얇은 네온 보더**: `border border-arcade-border`, hover 시 `border-arcade-accent`
- **letter-spacing 강조 제목**: `arcade-title` 클래스 (트래킹 + 그림자)

### ❌ Never
- 운동/헬스 앱 느낌 (둥근 파스텔, sans-serif 본문, 흰 배경, 잔잔한 그라데이션)
- 라이트 모드 / 흰색 배경
- 둥근 큰 모서리 (`rounded-xl`, `rounded-2xl`, `rounded-full` for cards)
- 매끈한 SaaS 톤 (블루+화이트, 친절한 일러스트, 인포그래픽)
- 이모지 남용 (마이크로카피로 분위기 만들기)
- 과한 부드러운 그라데이션
- 산세리프 헤더와 깔끔한 카드 레이아웃

### 톤 가이드
- 한국어 카피는 짧고 도발적으로: "동네 은둔고수의 기록을 깨라", "첫 도전자가 되어보세요"
- 영문은 모두 대문자 + 트래킹: STAGE SELECT, HIGH SCORE
- 단위는 작게 곁들이기: `42회`, `90초`

### 시각적 디테일 권장
- 테이블/리스트 헤더는 `text-[10px] uppercase tracking-wider text-zinc-500`
- 본문 부가정보는 `text-[11px] text-zinc-400`
- 강조 숫자(점수)는 굵게 + 네온 컬러
- 빈 상태 메시지도 게임처럼: "아직 기록이 없어요. 첫 도전자가 되어보세요."
- 404는 "GAME OVER ▶ CONTINUE"

## 스택 & 구조

- Next.js 14 App Router · TypeScript · TailwindCSS
- Supabase (Postgres + RLS, 닉네임 기반 익명 등록, MVP는 인증 없음)
- Kakao Maps JavaScript SDK

```
app/                  # 페이지 (지도 / 목록 / 상세+랭킹 / 기록등록)
components/           # 클라이언트 컴포넌트 (KakaoMap, RankingTabs, RecordForm, AddLocationButton)
lib/supabase/         # 브라우저/서버 클라이언트
lib/types.ts          # RecordType, RECORD_TYPES, Location 등
supabase/schema.sql   # 테이블 + RLS + 샘플 데이터
```

## 코드 스타일

- MVP 단계: **단순·직선적·과한 추상화 금지**
- 컴포넌트는 한 파일에 한 가지 책임
- 주석은 WHY가 비자명할 때만
- 새 페이지 추가 시 위 디자인 직시를 반드시 따른다
- 새 컴포넌트는 `arcade-*` 색상 토큰 활용

## 환경변수

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_KAKAO_MAP_KEY
```

Vercel에서 Production/Preview/Development 모두 설정. `NEXT_PUBLIC_*`은 빌드 타임 inline이라 변경 시 재배포 필요.

## 안티패턴 예시 (절대 금지)

```tsx
// ❌ 헬스앱스러움
<div className="bg-white rounded-3xl shadow-lg p-6">
  <h2 className="text-2xl font-bold text-gray-900">오늘의 운동</h2>
  <p className="text-gray-600">좋아요! 계속 도전해봐요 💪</p>
</div>

// ✅ 아케이드
<div className="rounded border border-arcade-border bg-arcade-panel p-3">
  <h2 className="arcade-title text-sm font-bold text-arcade-accent">HIGH SCORE</h2>
  <p className="text-[11px] text-zinc-400">동네 은둔고수의 기록을 깨라</p>
</div>
```
