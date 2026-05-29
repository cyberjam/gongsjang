# 공스장 세션 핸드오프

> 다음 세션이 이 파일 하나로 현재 상태 복원 가능하도록 정리.
> 디자인/카피 가이드는 `CLAUDE.md` 참조.

## 프로젝트 한 줄
**공스장** (영문 **GONGSJANG**, 하이픈 X) — GPS 기반 동네 철봉 도장깨기 인디게임 톤 웹앱.
배포: `gongsjang.vercel.app` · 레포: `cyberjam/gongsjang` · 작업 브랜치: `main`

## 스택
Next.js 14 App Router · TypeScript · TailwindCSS · Supabase (Postgres + RLS) · Kakao Maps JS SDK · VT323 디스플레이 폰트

## 핵심 톤 (요약본 — 전체는 CLAUDE.md)
- 다크 + 네온(금색 #ffd23f, 그린 #39ff14, 빨강 #ff3864), 모노스페이스
- 도장 어휘: **마스터 / 도전자 / 수성 / 무주공산 / 개척자**
- 금지: 운동/헬스/피트니스/사용자/회원/TOP/`GONG-JANG`/응원어
- 활성 지역: **청주·오송**

## Schema (supabase/schema.sql)
```sql
locations(id uuid, name, address, description, lat, lng, created_at,
          source text, external_id text, verified bool)
records(id, location_id, nickname, record_type, value, memo, created_at)

create unique index locations_source_external_id_uniq
  on locations(source, external_id) where source is not null and external_id is not null;

create function locations_within(in_lat, in_lng, in_meters) ...  -- Haversine RPC
```
**유의**: 부분 유니크 인덱스라 `upsert(onConflict:...)` 안 됨 → batch insert 사용 중.

## 시드 파이프라인 (scripts/, package.json)
| script | 역할 |
|---|---|
| `seed:fetch` | data.go.kr 전국실외운동기구(15139207) + 전국도시공원(15012890) → `supabase/raw/*.json` |
| `seed:build` | 청주 bbox + 철봉 키워드 + priority (청주 철봉 0건이라 사실상 미사용) |
| `seed:parks` | 도시공원 최소 시드 → `parks-demo.json` (`PARKS_LIMIT` env) |
| `seed:eqmt` | 실외운동기구 최소 시드 → `eqmt-demo.json` (`EQMT_LIMIT` env) |
| `seed:osm` | Overpass API 청주 bbox → `cheongju.osm.json` |
| `seed:import [p1|p2|all|etc|parks|eqmt|osm|<path>]` | batch insert + 행 fallback + RPC 부재 시 좌표 dedup 자동 OFF |

**필드 매핑 (실외운동기구는 비표준 약어)**:
`sprtgdNm`→기구명, `lat`/`lot`→좌표, `lctnRoadNmAddr`/`lctnLotnoAddr`→주소, `instlPlcNm`→장소. `normalizeEqmt()` in `scripts/lib/cheongju.mjs`.

## 현재 데이터 상태
- **실외운동기구 raw**: 10,764건 전국 fetch 완료. 충북 117 / **청주 sgg 0건** (확정)
- **도시공원 raw**: 18,376건 전국 fetch 완료
- **DB**: 도시공원 parks-demo 일부 import 됨 (정확한 행 수는 `[home] locations total count` 콘솔 로그로 확인 가능)
- **청주 철봉**: 공공데이터 0건 → OSM(`seed:osm`) 또는 수동 시드 필요. 둘 다 아직 안 함.

## 환경/네트워크
- `.env.local`에 `DATA_GO_KR_API_KEY`(decoded), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- **이 Claude Code 환경**은 `data.go.kr` / `supabase.com` outbound 403 (allowlist 차단) → 모든 fetch/import는 사용자 로컬에서 실행
- 키 normalize: `fetch-public-data.mjs`가 encoded/decoded 자동 감지 후 1회만 encode

## 지도(`components/KakaoMap.tsx`) 핵심
- **viewport culling**: 현재 map bounds 안의 마커만 overlay 생성, `idle` 이벤트마다 diff (MAX_VISIBLE=400)
- **STAGES 카운터**: `app/page.tsx`에서 `count:"exact" head:true` 별도 쿼리 → `stagesCount` prop. `toLocaleString("ko-KR")` + `clamp(0.95~1.25rem)` 폰트.
- **CHALLENGES 카운터**: `locations.reduce(...recordCount)` — 여전히 select 1000 캡 영향받음 (개선 안 함)
- **기본 중심**: 청주시청 `36.6424, 127.489`
- **마커**: Π pull-up bar SVG + 코너 칩, 단일 box-shadow glow, HOT 펄스 X (월드맵 오브젝트 톤)
- **selected**: scale 1.18 + 글로우 강화, gj-marker-icon-ring DOM 제거됨
- **GPS 버튼**: GPS 레이더 톤 (gj-locate, scanning/locked/error 상태머신, 마커 1회 burst)
- **하단 시트**: STAGE INFO + ENTER STAGE CTA

## 상세페이지(`app/locations/[id]/page.tsx`)
현재 단순 구조 (보스 카드/방명록/역대 마스터 풀톤 적용 → revert됨, `cc78695` revert `967b780`):
1. STAGE 칩 + 장소명
2. 주소 + 도전자 N명
3. RankingTabs (TOP3 박스 + 4위+ 행)
4. NEW CHALLENGER CTA

`lib/dojo.ts`(masterHistory/fuzzyAgo 등)는 revert와 함께 삭제됨.

## 최근 커밋 흐름 (역순)
- `5d62cea` viewport 마커 culling
- `709856a` STAGES 1000 캡 해제 (exact count + 콤마)
- `6fbb188` external_id 중복 제거 + 행 단위 fallback
- `7b60439` batch upsert → batch insert (부분 유니크 인덱스 ON CONFLICT 불가)
- `d5e7e6a` 전국 limit 해제 + 배치 모드
- `4156859` RPC 미존재 시 좌표 dedup 자동 OFF
- `d94045f` parks-demo 최소 빌더
- `e082d37` eqmt-demo 최소 빌더
- `ecb44aa` OSM Overpass fetcher
- `1ce594f` fetch 완주 + 시도 분포 진단
- `738a540` 필드 매핑 (sprtgdNm/lat/lot)
- `c7f4212` resultCode 10 진단·복구
- `847a640` data.go.kr region 필터 제거
- `100e4bc` GONG-JANG → GONGSJANG 브랜드 정리
- `4220e04` 랭킹 오락실 톤
- `5a3eebf` STAGE BOSS 카드 추가
- `b53d37c` lib/copy.ts 카피 라이브러리
- `ef07ed5` CLAUDE.md 디자인 직시

## 열린 이슈 / 다음 작업 후보
1. **청주 철봉 실데이터** — `npm run seed:osm` 한 번 돌려보기 (OSM 청주 커버리지 얕음 예상). 비면 수동 시드.
2. **CHALLENGES 카운터**도 exact count 적용 여부
3. **지도 마커 1000+** — 현재 `app/page.tsx`의 locations select가 Supabase 기본 1000 limit. 진짜로 1000+ 마커 보이게 하려면 viewport-bbox 서버 fetch API route 필요.
4. **마커 클러스터링** — 현재 viewport culling + 400 캡으로 충분. 데이터 더 늘면 필요.
5. **상세페이지 도장감 강화** — 보스/방명록/역대 마스터는 한 번 적용 후 revert됨. 사용자가 다시 원하면 lib/dojo.ts 부활.
6. **schema_init.sql 별도 분리** — 컬럼·RPC 마이그레이션이 Supabase에서 누락되는 사고가 두 번 있었음. 명시 분리 + README 안내 추가하면 안전.

## 진행 컨벤션
- 브랜치: `main` 직접 푸시 (Vercel 자동 배포)
- 커밋: 한글 본문 OK, `https://claude.ai/code/session_...` trailer
- TypeScript 빌드는 `NEXT_PUBLIC_*` 더미값으로 verify 가능
- 사용자가 "revert" 한 마디면 `git revert HEAD --no-edit` 후 push
