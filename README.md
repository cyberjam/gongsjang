<div align="center">

# 공스장 · GONGSJANG

### 동네 철봉 도장깨기 — 은둔고수의 기록을 깨라

옛날 오락실 **HIGH SCORE** 점수판을, 동네 철봉 위에 올렸다.

</div>

---

## ▍이건 운동 앱이 아니다

당신 동네 어딘가, 아무도 모르는 철봉 하나에
**이름 모를 은둔고수의 기록**이 걸려 있다.

공스장은 GPS로 동네 철봉을 **스테이지**로 띄우는 현실 기반 도장깨기 게임이다.
지도를 열고, 가장 가까운 철봉으로 걸어가, 매달리고, 숫자를 갱신한다.
그 순간 점수판 맨 위 이름이 당신으로 바뀐다 — 다음 도전자가 나타나기 전까지.

> 헬스장 회원권도, 응원 메시지도 없다.
> 점수와, 그 점수를 깨러 온 사람만 있다.

---

## ▍룰

```
  STAGE        동네 철봉 한 대 = 스테이지 한 판
  마스터       그 스테이지 최고 기록 보유자 (= 깨야 할 보스)
  도전자       기록을 갱신하러 온 사람
  수성         자기 기록을 지켜내는 것
  무주공산      아직 아무 기록도 없는 빈 스테이지
  개척자       무주공산에 첫 기록을 꽂은 사람
```

종목은 네 가지 — **풀업 · 친업 · 머슬업 · 데드행(초)**.
랭킹은 단순하다. 숫자 큰 사람이 위로 간다. `1등 금 · 2등 은 · 3등 동`.

---

## ▍화면

| 화면 | 경로 | 무엇 |
|---|---|---|
| 지도 | `/` | 카카오맵 위에 전국 철봉 핀. 가장 가까운 스테이지로. |
| 스테이지 선택 | `/locations` | 목록 + 새 철봉 등록 |
| 스테이지 상세 | `/locations/[id]` | 보스(마스터) + 랭킹 |
| 기록 등록 | `/locations/[id]/record` | 닉네임 + 기록 입력 |

다크 + 네온(금 `#ffd23f` · 그린 `#39ff14` · 빨강 `#ff3864`), 모노스페이스,
CRT 스캔라인. 모바일 우선.

---

## ▍전국 철봉, 진짜로 다 띄운다

핀은 샘플이 아니다. 공공데이터(전국 실외운동기구 · 도시공원)에서 철봉을 긁어
온다. 그 과정에서 **좌표가 비었거나 위·경도가 뒤바뀐 "예외" 데이터까지 복구**해
누락을 최소화했다.

- 위·경도가 뒤바뀐 행 → 자동 교정, 한국 밖 좌표는 제외
- 좌표가 아예 없는 행 → **카카오 주소→좌표 지오코딩**으로 복구 (결과는 캐시)
- "철봉"은 엄격하게 — 거꾸리·하늘타기·윗몸일으키기 같은 건 걸러낸다
- 지도는 1000행 제한 없이 전체를 불러오고, 화면에 보이는 핀만 렌더(viewport culling)

<br />

<div align="center">

— 여기서부터는 만드는 사람을 위한 이야기 —

</div>

---

## 개발 세팅

### 0. Node 24

`.nvmrc` / `engines("24.x")` 로 고정, `.npmrc` 의 `engine-strict=true` 로 설치 시 강제.

```bash
nvm install   # .nvmrc 의 24 설치
nvm use
```

### 1. 의존성

```bash
npm install
```

### 2. Supabase

1. [supabase.com](https://supabase.com) 프로젝트 생성
2. SQL Editor 에 `supabase/schema.sql` 붙여넣고 실행
3. `Settings → API` 에서 `Project URL`, `anon public key` 복사

### 3. Kakao Maps

1. [kakao developers](https://developers.kakao.com/) 앱 생성
2. **JavaScript 키** 복사 → `플랫폼 → Web` 에 도메인 등록(예: `http://localhost:3000`)
3. (선택) 시드 지오코딩용 **REST API 키** 도 복사

### 4. 환경변수

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_KAKAO_MAP_KEY=...        # JS 키
# ── 서버 전용 (시드용, 브라우저 노출 금지) ──
DATA_GO_KR_API_KEY=...               # data.go.kr decoded 키
KAKAO_REST_API_KEY=...               # 주소→좌표 지오코딩 (JS 키와 다름)
SUPABASE_SERVICE_ROLE_KEY=...        # RLS 우회 import
```

### 5. 실행

```bash
npm run dev          # http://localhost:3000
npm test             # 시드 라이브러리 단위 테스트 (node --test)
```

---

## 전국 철봉 채우기 (시드)

```bash
npm run seed:fetch   # 전국 raw 수집 → supabase/raw/*.json
npm run seed:all     # 빌드 + 적재 한 번에 (재실행해도 external_id 로 중복 방지)
```

`seed:all` = `seed:eqmt && seed:import eqmt && seed:parks && seed:import parks`.
단계별로 돌리려면 개별 스크립트 사용.

중복 방지: 좌표가 아닌 **안정 `external_id`**(관리번호/내용 해시)를 키로 쓴다 →
지오코딩으로 좌표가 바뀌어도 다시 추가되지 않는다. 살리지 못한 행은
`supabase/raw/*-dropped.json` 에 사유와 함께 남는다.

---

## CI / 자동화

| 워크플로우 | 트리거 | 하는 일 |
|---|---|---|
| `.github/workflows/ci.yml` | push / PR | `npm test` + `npm run build` |
| `.github/workflows/seed.yml` | 수동(`workflow_dispatch`) | `seed:fetch` + `seed:all` 적재 |

**시드는 왜 Vercel 이 아니라 GitHub Actions?**
Vercel 은 앱 **호스팅**용이다. 시드는 `service_role` 키로 다량 insert 하고 수 분
걸리는 배치라, 요청-응답형 서버리스보다 시크릿을 들고 길게 도는 **Actions 수동
실행**이 맞다. 앱 배포는 Vercel, 데이터 적재는 Actions 로 역할을 나눈다.

`seed.yml` 시크릿(Settings → Secrets → Actions): `DATA_GO_KR_API_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KAKAO_REST_API_KEY`.

---

## 스택 & 구조

Next.js 14 (App Router) · TypeScript · TailwindCSS · Supabase(Postgres + RLS) ·
Kakao Maps JS SDK · VT323 디스플레이 폰트

```
app/
  page.tsx                       # 지도 홈
  locations/page.tsx             # 스테이지 선택(목록) + 등록
  locations/[id]/page.tsx        # 스테이지 상세 + 랭킹
  locations/[id]/record/page.tsx # 기록 등록
components/                      # KakaoMap, RankingTabs, RecordForm …
lib/
  copy.ts                        # 카피 라이브러리
  supabase/                      # 브라우저/서버 클라이언트
  types.ts
scripts/                        # 공공데이터 시드 파이프라인
  lib/cheongju.mjs               # 정규화 · 좌표복구 · 철봉 매칭
  lib/geocode.mjs                # 카카오 주소→좌표 + 캐시
test/                           # node --test
supabase/schema.sql              # 테이블 + RLS + 함수
```

### 데이터 모델

- `locations(id, name, address, description, lat, lng, source, external_id, verified, created_at)`
- `records(id, location_id, nickname, record_type, value, memo, created_at)`
  - `record_type`: `pullup | chinup | muscleup | hang`

---

## 로드맵 (MVP 이후)

- 장소 반경 GPS 인증 (현장에서만 기록 등록)
- 주간 챌린지 · 동네 전체 랭킹
- 사진/영상 인증, 종목 추가
- viewport-bbox 서버 fetch (데이터 더 커지면)

<div align="center">
<br />

**공스장** · 동네 은둔고수의 기록을 깨라

</div>
