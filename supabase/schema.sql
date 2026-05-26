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
