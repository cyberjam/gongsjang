-- ============================================================
-- 0002_faction_system — 동네 문파 점령전 (dev 의 점령 기반 위에 확장)
--   · 동네별 문파 자동 생성(네이밍 규칙)
--   · 점령력 = 최근 30일 방문(방문일) 기반
--   · 관장(장소 기여 1위) + 점령 시작일 컬럼
--   · 더미 방문 데이터로 점령/관장 시연
-- 적용: Supabase SQL Editor 에 그대로 실행 (schema.sql 이후)
-- ============================================================

-- ── 장소 점령 메타 컬럼 ──────────────────────────────────────
alter table locations add column if not exists occupied_since timestamptz; -- 점령 시작일
alter table locations add column if not exists warden text;                -- 관장(기여 1위 닉네임)

-- ── 동네별 문파 자동 생성 ────────────────────────────────────
-- 규칙: 주소의 동/읍/면 → "{동 접두}{세력 접미}". 동당 1문파. 이미 있으면 skip.
create or replace function generate_clans()
returns void
language plpgsql
as $$
declare
  suffixes text[] := array['청룡회','백호단','현무문','주작궁','철권문'];
  colors   text[] := array['#3fa9ff','#e8ecff','#39ff14','#ff3864','#ffd23f'];
  r record; base text; idx int;
begin
  for r in
    select distinct substring(address from '([가-힣]+[동읍면])') as dong
    from locations
    where address ~ '[가-힣]+[동읍면]'
  loop
    if r.dong is null then continue; end if;
    if exists (select 1 from clans where region_key = r.dong) then continue; end if;
    base := regexp_replace(r.dong, '[동읍면]$', '');
    idx  := (abs(hashtext(r.dong)) % 5);
    insert into clans (name, slug, region_key, color)
    values (base || suffixes[idx + 1], 'clan-' || substr(md5(r.dong), 1, 8), r.dong, colors[idx + 1])
    on conflict (slug) do nothing;
  end loop;
end;
$$;

select generate_clans();

-- 초기 점령 = 거주 동네 문파 (방문 데이터가 쌓이면 recompute 가 덮어씀)
update locations l
set clan_id = c.id, occupied_since = coalesce(l.occupied_since, now())
from clans c
where l.clan_id is null and l.address like '%' || c.region_key || '%';

-- ── 점령 계산: 최근 30일 방문 1위 문파 + 관장 + 점령 시작일 ──
create or replace function recompute_location_occupation(in_location uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner uuid;
  current_owner uuid;
  top_warden text;
begin
  select clan_id into winner
  from visits
  where location_id = in_location
    and visited_on >= (current_date - interval '30 days')
  group by clan_id
  order by count(*) desc, clan_id
  limit 1;

  select nickname into top_warden
  from visits
  where location_id = in_location
    and visited_on >= (current_date - interval '30 days')
  group by nickname
  order by count(*) desc, nickname
  limit 1;

  select clan_id into current_owner from locations where id = in_location;

  update locations set warden = top_warden where id = in_location;

  if winner is distinct from current_owner then
    update locations
      set clan_id = winner, occupied_since = now()
      where id = in_location;
    insert into occupation_log (location_id, clan_id, prev_clan_id)
    values (in_location, winner, current_owner);
  end if;
end;
$$;

-- ── 더미 방문 데이터 (점령/관장 시연용) ──────────────────────
-- 홍길동: 앞쪽 장소 5곳에 최근 5일 방문 → 해당 장소 관장 + 점령력 5
insert into visits (location_id, clan_id, nickname, visited_on)
select l.id, l.clan_id, '홍길동', (current_date - gs)
from (select id, clan_id from locations where clan_id is not null order by created_at limit 5) l
cross join generate_series(0, 4) gs
on conflict do nothing;

-- 김철봉: 라이벌(2일) — 접전 연출
insert into visits (location_id, clan_id, nickname, visited_on)
select l.id, l.clan_id, '김철봉', (current_date - gs)
from (select id, clan_id from locations where clan_id is not null order by created_at limit 2) l
cross join generate_series(0, 1) gs
on conflict do nothing;

-- 전체 재계산 (warden/점령 반영)
select recompute_all_occupation();
