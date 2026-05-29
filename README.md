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

### 0. Node 버전

이 프로젝트는 **Node 24.16.0** 을 사용한다 (`.nvmrc` / `engines` 로 고정,
`.npmrc` 의 `engine-strict=true` 로 설치 시 강제).

```bash
nvm install   # .nvmrc 의 24.16.0 설치
nvm use       # 24.16.0 활성화
```

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

## 전국 철봉 시드 채우기 (data.go.kr)

공공데이터로 전국 철봉 위치를 채운다. 좌표가 비었거나 뒤바뀐 "예외" 행도
복구해서 누락을 최소화한다.

```bash
# 1) 전국 raw 수집 (실외운동기구 + 도시공원) → supabase/raw/*.json
npm run seed:fetch

# 2) 빌드 + 적재 한 번에 (철봉 빌드+import + 공원 빌드+import)
#    재실행해도 external_id 로 중복 방지
npm run seed:all
```

> `seed:all` = `seed:eqmt && seed:import eqmt && seed:parks && seed:import parks`.
> 단계별로 돌리고 싶으면 개별 스크립트(`seed:eqmt` 등) 사용.

GitHub Actions 로도 돌릴 수 있다 (아래 *CI / 자동화* 참고).

**좌표 예외 복구 정책**

1. lat/lng 가 뒤바뀐 행은 자동 교정, 한국 bbox 밖은 제외
2. 좌표가 아예 없고 주소만 있는 행은 **카카오 주소→좌표 지오코딩**으로 복구
   - `.env.local` 에 `KAKAO_REST_API_KEY`(REST 키, JS 키와 다름) 필요
   - 결과는 `supabase/cache/geocode.json` 에 캐시 → 재실행 시 API 재호출 없음
   - 키가 없으면 해당 행은 제외되고 `supabase/raw/*-dropped.json` 에 사유 기록
3. 중복 방지: 좌표와 무관한 안정 `external_id`(관리번호/내용 해시) 사용 →
   지오코딩으로 좌표가 바뀌어도 재실행 시 같은 장소는 다시 추가되지 않음

> 지도(`/`)는 1000행 제한 없이 전체를 불러오고, 화면에 보이는 마커만
> 렌더(viewport culling)한다.

## CI / 자동화

| 워크플로우 | 트리거 | 하는 일 |
|---|---|---|
| `.github/workflows/ci.yml` | push / PR | `npm test`(시드 라이브러리 단위 테스트) + `npm run build` |
| `.github/workflows/seed.yml` | 수동(`workflow_dispatch`) | `seed:fetch` + `seed:all` 로 Supabase 적재 |

**시드는 왜 Vercel 이 아니라 GitHub Actions?**
Vercel 은 Next.js 앱 **호스팅**용이다. 시드는 (1) `service_role` 키로 RLS 를
우회해 다량 insert 하고 (2) 수 분 걸리는 배치라, 요청-응답형 서버리스(Vercel)보다
시크릿을 들고 길게 도는 **GitHub Actions 수동 실행**이 맞다. 앱 배포는 Vercel,
데이터 적재는 Actions 로 역할을 나눈다.

`seed.yml` 에 필요한 Repository Secrets (Settings → Secrets → Actions):
`DATA_GO_KR_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`KAKAO_REST_API_KEY`.

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
