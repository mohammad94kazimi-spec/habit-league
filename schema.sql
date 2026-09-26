-- ===================================================================
-- چالش عادت‌ها — Schema برای Supabase (Postgres)
-- این فایل را یک‌بار در SQL Editor پروژه‌ی Supabase اجرا کن.
-- ===================================================================

create extension if not exists "pgcrypto";

-- ---------- پروفایل کاربران (تکمیل‌کننده‌ی auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- هنگام signup خودکار یک پروفایل بساز
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- لیگ‌ها ----------
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists league_members (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- عضویت با کد دعوت (چون کاربر پیش از عضویت league_id را نمی‌داند)
create or replace function join_league(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  select id into v_league_id from leagues where invite_code = upper(p_code);
  if v_league_id is null then
    raise exception 'کد دعوت نامعتبر است';
  end if;
  insert into league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict do nothing;
  return v_league_id;
end;
$$;

create or replace function create_league(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into leagues (name, invite_code, created_by) values (p_name, v_code, auth.uid())
  returning id into v_id;
  insert into league_members (league_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

-- ---------- عادت‌ها ----------
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  league_id uuid references leagues(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('build', 'break')),
  base_points int not null default 1,
  penalty_points int not null default 1,
  streak_bonus_every int not null default 7,
  streak_bonus_points int not null default 3,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- ورودی‌های روزانه ----------
create table if not exists daily_entries (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  entry_date date not null,
  success boolean not null,
  streak int not null default 0,
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (habit_id, entry_date)
);

-- ثبت ورودی روزانه + محاسبه‌ی امتیاز و استریک (تنها راه نوشتن در daily_entries)
create or replace function record_entry(p_habit_id uuid, p_date date, p_success boolean)
returns daily_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_habit habits;
  v_prev_streak int := 0;
  v_new_streak int := 0;
  v_points int := 0;
  v_row daily_entries;
begin
  select * into v_habit from habits where id = p_habit_id;
  if v_habit.id is null or v_habit.user_id <> auth.uid() then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if p_success then
    select streak into v_prev_streak from daily_entries
      where habit_id = p_habit_id and entry_date = p_date - 1 and success = true;
    v_new_streak := coalesce(v_prev_streak, 0) + 1;
    v_points := v_habit.base_points;
    if v_new_streak % v_habit.streak_bonus_every = 0 then
      v_points := v_points + v_habit.streak_bonus_points;
    end if;
  else
    v_new_streak := 0;
    v_points := -v_habit.penalty_points;
  end if;

  insert into daily_entries (habit_id, entry_date, success, streak, points)
  values (p_habit_id, p_date, p_success, v_new_streak, v_points)
  on conflict (habit_id, entry_date)
    do update set success = excluded.success, streak = excluded.streak, points = excluded.points
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------- دسته‌بندی‌های قابل‌ویرایش کاربر ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  color text not null default '#8A8578',
  created_at timestamptz not null default now()
);

-- ---------- کارهای شخصی (To Do) — بدون امتیازدهی ----------
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  category_id uuid references categories(id) on delete set null,
  priority int not null default 3 check (priority between 1 and 5),
  due_date date,
  due_time text,
  description text,
  completed_at timestamptz,
  recurrence_group uuid,
  created_at timestamptz not null default now()
);

-- ---------- جدول امتیازات لیگ ----------
create or replace view league_leaderboard as
select
  l.id as league_id,
  p.id as user_id,
  p.display_name,
  coalesce(sum(de.points), 0)::int as total_points
from leagues l
join league_members lm on lm.league_id = l.id
join profiles p on p.id = lm.user_id
left join habits h on h.user_id = p.id and h.league_id = l.id and h.archived = false
left join daily_entries de on de.habit_id = h.id
group by l.id, p.id, p.display_name;

-- ===================================================================
-- Row Level Security
-- ===================================================================
alter table profiles enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table habits enable row level security;
alter table daily_entries enable row level security;
alter table todos enable row level security;
alter table categories enable row level security;

-- profiles: هر کاربر لاگین‌کرده می‌تواند همه‌ی پروفایل‌ها را ببیند (برای نمایش نام در لیدربورد)، فقط پروفایل خودش را ویرایش کند
create policy "profiles_select_all" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- تابع کمکی SECURITY DEFINER: لیگ‌هایی که کاربر عضوشونه را برمی‌گرداند.
-- چون این تابع RLS را دور می‌زند، استفاده ازش داخل policy خودِ league_members
-- از خطای «infinite recursion detected in policy» جلوگیری می‌کند.
create or replace function my_league_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select league_id from league_members where user_id = auth.uid();
$$;

-- leagues: فقط اعضا می‌بینند
create policy "leagues_select_member" on leagues for select using (
  id in (select my_league_ids())
);

-- league_members: فقط اعضای همان لیگ می‌بینند (بدون subquery مستقیم روی خودِ جدول)
create policy "league_members_select_same_league" on league_members for select using (
  league_id in (select my_league_ids())
);

-- habits: مالک یا هم‌لیگی‌ها می‌بینند؛ فقط مالک می‌نویسد
create policy "habits_select_own_or_league" on habits for select using (
  user_id = auth.uid()
  or (league_id is not null and league_id in (select my_league_ids()))
);
create policy "habits_insert_own" on habits for insert with check (user_id = auth.uid());
create policy "habits_update_own" on habits for update using (user_id = auth.uid());
create policy "habits_delete_own" on habits for delete using (user_id = auth.uid());

-- daily_entries: مالک یا هم‌لیگی‌ها می‌بینند؛ نوشتن مستقیم بسته است (فقط از طریق record_entry)
create policy "entries_select_own_or_league" on daily_entries for select using (
  exists (
    select 1 from habits h
    where h.id = daily_entries.habit_id
      and (h.user_id = auth.uid()
        or (h.league_id is not null and exists (
          select 1 from league_members m where m.league_id = h.league_id and m.user_id = auth.uid()
        )))
  )
);

-- todos: فقط خود کاربر
create policy "todos_all_own" on todos for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: فقط خود کاربر
create policy "categories_all_own" on categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
