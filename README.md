# 공스장 (GONGSJANG)

> 동네 철봉 도장깨기 — 은둔고수의 기록을 깨라

GPS 기반 동네 철봉 랭킹 웹앱 MVP. 옛날 오락실 점수판 감성으로
동네 은둔고수의 기록을 깨러 가는 현실 도장깨기.

## 스택

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- Supabase (Postgres + RLS)
- Kakao Maps JavaScript SDK

## MVP 범위

1. 지도 화면 (`/`) - 카카오맵 위에 철봉 핀
2. 장소 목록 (`/locations`) + 신규 장소 등록
3. 장소 상세 + 랭킹 (`/locations/[id]`)
4. 기록 등록 (`/locations/[id]/record`)
5. 모바일 반응형 UI (다크 + 네온 아케이드 톤)

> 인증/QR/GPS 인증은 의도적으로 제외. 닉네임 기반 익명 등록.

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 세팅

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. SQL Editor에 `supabase/schema.sql` 붙여넣고 실행
3. `Settings → API`에서 `Project URL`, `anon public key` 복사

### 3. Kakao Maps 키 발급

1. [kakao developers](https://developers.kakao.com/) 앱 생성
2. **JavaScript 키** 복사
3. `플랫폼 → Web`에 개발용 도메인 등록 (예: `http://localhost:3000`)

### 4. 환경변수

`.env.example` 을 복사해서 `.env.local` 만들기.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_KAKAO_MAP_KEY=...
```

### 5. 실행

```bash
npm run dev
```

http://localhost:3000

## 디렉토리

```
app/
  page.tsx                       # 지도 홈
  locations/page.tsx             # 철봉 목록
  locations/[id]/page.tsx        # 장소 상세 + 랭킹
  locations/[id]/record/page.tsx # 기록 등록
components/
  KakaoMap.tsx
  RankingTabs.tsx
  RecordForm.tsx
  AddLocationButton.tsx
lib/
  supabase/client.ts
  supabase/server.ts
  types.ts
supabase/schema.sql              # 테이블 + RLS + 샘플 데이터
```

## 데이터 모델

- `locations(id, name, address, description, lat, lng, created_at)`
- `records(id, location_id, nickname, record_type, value, memo, created_at)`
  - `record_type`: `pullup | chinup | muscleup | hang`
  - `value`: 회수 또는 데드행 초

랭킹은 `value DESC` 정렬.

## 다음 단계 (MVP 이후)

- Supabase Auth 기반 사용자 프로필
- GPS 인증 (장소 반경 내에서만 기록 등록 허용)
- QR 코드 인증
- 종목 추가, 사진 업로드
- 동네 전체 랭킹, 주간 챌린지
