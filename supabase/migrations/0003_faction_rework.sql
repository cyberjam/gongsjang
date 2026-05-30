-- ============================================================
-- 0003_faction_rework — 문파 가입 모델 재설계
--   · 동네 자동 가입 폐기 → 기본 "무소속"
--   · 사용자가 직접 가입/탈퇴 (clan_memberships)
--   · 가입은 지역 제한 없음 (어느 동네 문파든 가능)
--   · 점령(locations.clan_id)·점령력(30일)·관장은 기존 유지
-- 적용: Supabase SQL Editor 에 실행 (0002 이후)
-- ============================================================

-- ── 문파 가입 (닉네임당 1문파, 가입=upsert / 탈퇴=delete) ──────
create table if not exists clan_memberships (
  nickname   text primary key check (char_length(nickname) between 1 and 12),
  clan_id    uuid not null references clans(id) on delete cascade,
  joined_at  timestamptz not null default now()
);
create index if not exists clan_memberships_clan_idx on clan_memberships (clan_id);

alter table clan_memberships enable row level security;

drop policy if exists "memberships viewable by everyone" on clan_memberships;
create policy "memberships viewable by everyone"
  on clan_memberships for select using (true);

-- MVP(익명 닉네임): 누구나 가입/변경/탈퇴
drop policy if exists "anyone can join" on clan_memberships;
create policy "anyone can join"
  on clan_memberships for insert with check (true);

drop policy if exists "anyone can update membership" on clan_memberships;
create policy "anyone can update membership"
  on clan_memberships for update using (true) with check (true);

drop policy if exists "anyone can leave" on clan_memberships;
create policy "anyone can leave"
  on clan_memberships for delete using (true);

-- ── 더미 가입 (문파 찾기/프로필 시연용) ──────────────────────
-- 홍길동 → 첫 문파, 김철봉 → 둘째 문파
insert into clan_memberships (nickname, clan_id)
select '홍길동', id from clans order by name limit 1
on conflict (nickname) do update set clan_id = excluded.clan_id;

insert into clan_memberships (nickname, clan_id)
select '김철봉', id from clans order by name offset 1 limit 1
on conflict (nickname) do update set clan_id = excluded.clan_id;
