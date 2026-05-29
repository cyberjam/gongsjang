-- 공스장 MVP 스키마
-- Supabase SQL Editor에서 그대로 실행

create extension if not exists "pgcrypto";

-- 철봉 장소
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  description text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists locations_lat_lng_idx on locations (lat, lng);

-- 기록
-- record_type: pullup(풀업), chinup(친업), muscleup(머슬업), hang(데드행 초)
create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  record_type text not null check (record_type in ('pullup','chinup','muscleup','hang')),
  value integer not null check (value > 0 and value < 100000),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists records_location_type_idx on records (location_id, record_type, value desc);
create index if not exists records_created_at_idx on records (created_at desc);

-- RLS
alter table locations enable row level security;
alter table records enable row level security;

-- 모두 읽기 허용
drop policy if exists "locations are viewable by everyone" on locations;
create policy "locations are viewable by everyone"
  on locations for select using (true);

drop policy if exists "records are viewable by everyone" on records;
create policy "records are viewable by everyone"
  on records for select using (true);

-- 누구나 등록 가능 (MVP: 익명 닉네임 기반)
drop policy if exists "anyone can insert locations" on locations;
create policy "anyone can insert locations"
  on locations for insert with check (true);

drop policy if exists "anyone can insert records" on records;
create policy "anyone can insert records"
  on records for insert with check (true);

-- 샘플 데이터 (서울 일부 공원)
insert into locations (name, address, description, lat, lng) values
  ('한강공원 뚝섬 철봉', '서울 광진구 자양동', '한강 보면서 운동하는 명소', 37.5314, 127.0666),
  ('올림픽공원 평화광장', '서울 송파구 방이동', '철봉 3개, 평행봉 1개', 37.5202, 127.1218),
  ('서울숲 운동기구존', '서울 성동구 성수동1가', '나무 그늘 아래 철봉', 37.5446, 127.0378),
  ('남산 야외운동기구', '서울 중구 회현동1가', '계단 옆 철봉, 높이 적당', 37.5519, 126.9810),
  ('보라매공원 헬스존', '서울 동작구 신대방동', '동네 고수들 모이는 곳', 37.4936, 126.9197)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- 시드 import 지원 — 외부 데이터 출처 추적 + 공간 dedup
-- ─────────────────────────────────────────────────────────────

alter table locations add column if not exists source text;
-- 'public_data' | 'osm' | 'manual' | 'user'
alter table locations add column if not exists external_id text;
-- 원본 데이터셋에서의 식별자 (재import 시 dedup)
alter table locations add column if not exists verified boolean not null default false;
-- 큐레이션 완료 여부 (이름·설명 톤 입혔는지)

create unique index if not exists locations_source_external_id_uniq
  on locations (source, external_id)
  where source is not null and external_id is not null;

-- 두 좌표 사이 거리 N미터 이내인 기존 location 조회 (Haversine).
-- import 스크립트가 30m dedup에 사용.
create or replace function locations_within(
  in_lat double precision,
  in_lng double precision,
  in_meters double precision
)
returns setof locations
language sql stable as $$
  select * from locations
  where 6371000 * 2 * asin(sqrt(
    power(sin(radians((lat - in_lat) / 2)), 2) +
    cos(radians(in_lat)) * cos(radians(lat)) *
    power(sin(radians((lng - in_lng) / 2)), 2)
  )) <= in_meters;
$$;

-- ─────────────────────────────────────────────────────────────
-- 문파(점령) 시스템 — Sprint 1: 지역 기반 문파 + 장소 점령 상태
--   · 문파는 유저가 만들지 않고 지역마다 자동 존재 (region_key = 동/읍/면)
--   · 각 location 은 현재 점령 문파(clan_id)를 가짐. null = 무주공산(회색)
--   · Sprint 1 기본 점령 = 주소 지역 매칭. Sprint 2 에서 방문일 기반으로 대체.
-- ─────────────────────────────────────────────────────────────

create table if not exists clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  region_key text not null,   -- 주소에 포함되는 지역명(동/읍/면) — 소속·점령 매칭
  color text not null,        -- 마커 색 (hex, arcade 네온 톤)
  created_at timestamptz not null default now()
);

alter table locations add column if not exists clan_id uuid references clans(id) on delete set null;
create index if not exists locations_clan_id_idx on locations (clan_id);

alter table clans enable row level security;
drop policy if exists "clans are viewable by everyone" on clans;
create policy "clans are viewable by everyone"
  on clans for select using (true);

-- 시드 문파 (청주 생활권 예시 — 다크 네온 컬러로 arcade 톤 유지)
insert into clans (name, slug, region_key, color) values
  ('청룡문', 'cheongryong', '율량동', '#3fa9ff'),
  ('흑월단', 'heugwol',     '복대동', '#ff3864'),
  ('백호방', 'baekho',      '산남동', '#e8ecff')
on conflict (slug) do nothing;

-- Sprint 1 기본 점령: 주소에 문파 region_key 가 포함되면 그 문파가 해당 장소 점령
update locations l
set clan_id = c.id
from clans c
where l.clan_id is null and l.address like '%' || c.region_key || '%';

-- ─────────────────────────────────────────────────────────────
-- 점령 엔진 — Sprint 2: 방문 기록 + 최근 14일 방문 합산 점령 + 변경 로그
--   · 점령 기준 = 최근 14일 (장소,문파)별 방문 수. 1위 문파가 점령.
--   · 같은 장소·같은 사람·같은 날 = 1회만 (허위·중복 방지)
--   · 점령자 바뀌면 occupation_log 에 이력. 시간 지나면 역전 가능.
--   · QR/사진/GPS 인증은 후속 — 여기선 데이터 모델 + 집계 엔진만.
-- ─────────────────────────────────────────────────────────────

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  clan_id uuid not null references clans(id),         -- 이 방문이 기여하는 문파(방문자 소속)
  nickname text not null check (char_length(nickname) between 1 and 12),
  visited_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now()
);
-- 같은 장소·같은 사람·같은 날 1회만
create unique index if not exists visits_once_per_day
  on visits (location_id, nickname, visited_on);
-- 최근 N일 집계용
create index if not exists visits_location_day_idx
  on visits (location_id, visited_on);

alter table visits enable row level security;
drop policy if exists "visits are viewable by everyone" on visits;
create policy "visits are viewable by everyone" on visits for select using (true);
drop policy if exists "anyone can insert visits" on visits;
create policy "anyone can insert visits" on visits for insert with check (true);

-- 점령 변경 이력
create table if not exists occupation_log (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  clan_id uuid references clans(id),        -- 새 점령 문파 (null = 무주공산화)
  prev_clan_id uuid references clans(id),    -- 직전 점령 문파
  occupied_at timestamptz not null default now()
);
create index if not exists occupation_log_location_idx
  on occupation_log (location_id, occupied_at desc);

alter table occupation_log enable row level security;
drop policy if exists "occupation_log is viewable by everyone" on occupation_log;
create policy "occupation_log is viewable by everyone" on occupation_log for select using (true);

-- 한 장소의 점령자 재계산 = 최근 14일 방문 1위 문파. 바뀌면 로그.
-- SECURITY DEFINER: 익명 visit insert 트리거가 RLS 우회해 locations/log 갱신.
create or replace function recompute_location_occupation(in_location uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner uuid;
  current_owner uuid;
begin
  select clan_id into winner
  from visits
  where location_id = in_location
    and visited_on >= (current_date - interval '14 days')
  group by clan_id
  order by count(*) desc, clan_id
  limit 1;

  select clan_id into current_owner from locations where id = in_location;

  if winner is distinct from current_owner then
    update locations set clan_id = winner where id = in_location;
    insert into occupation_log (location_id, clan_id, prev_clan_id)
    values (in_location, winner, current_owner);
  end if;
end;
$$;

-- 전체 재계산 (방문이 14일 밖으로 빠져 점령이 식는 경우 — cron/Action 에서 주기 호출)
create or replace function recompute_all_occupation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in select id from locations loop
    perform recompute_location_occupation(r.id);
  end loop;
end;
$$;

-- 방문 insert 시 해당 장소 점령 재계산
create or replace function on_visit_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recompute_location_occupation(new.location_id);
  return new;
end;
$$;

drop trigger if exists visits_recompute on visits;
create trigger visits_recompute
  after insert on visits
  for each row execute function on_visit_recompute();

-- TODO(Sprint3+): 방문 인증(QR/사진/GPS·시간) · 방문자 소속 문파 자동 판정 · 점령 기여도
