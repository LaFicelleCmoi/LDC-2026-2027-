-- =======================================================================
-- Ligues de pronostics (page prono.html) — schéma Supabase
-- Projet : jcqpnhovhdxtystdarif (tables isolées, préfixe ldc_)
-- Sécurité : RLS activé SANS policy (tout accès direct refusé) ;
-- seules les fonctions SECURITY DEFINER ci-dessous sont exposées à `anon`.
-- Chaque joueur s'authentifie par un secret local (localStorage).
-- =======================================================================

create table if not exists public.ldc_leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  season int not null default 2026,
  created_at timestamptz not null default now()
);
create table if not exists public.ldc_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.ldc_leagues(id) on delete cascade,
  pseudo text not null,
  secret text not null,
  pts int not null default 0,
  good int not null default 0,
  exact int not null default 0,
  played int not null default 0,
  updated_at timestamptz not null default now(),
  unique(league_id, pseudo)
);
create index if not exists ldc_members_league_idx on public.ldc_members(league_id);

alter table public.ldc_leagues enable row level security;
alter table public.ldc_members enable row level security;

-- Classement d'une ligue (privé : il faut connaître le code)
create or replace function public.ldc_get_league(p_code text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_league public.ldc_leagues;
begin
  select * into v_league from public.ldc_leagues where code = upper(trim(p_code));
  if v_league.id is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  return json_build_object('ok', true, 'code', v_league.code, 'name', v_league.name,
    'standings', coalesce((select json_agg(row_to_json(s)) from (
      select pseudo, pts, good, exact, played, updated_at
      from public.ldc_members where league_id = v_league.id
      order by pts desc, exact desc, good desc, updated_at asc, pseudo asc
    ) s), '[]'::json));
end $$;

-- Création d'une ligue (le créateur en devient le 1er membre)
create or replace function public.ldc_create_league(p_name text, p_pseudo text, p_secret text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text := left(trim(coalesce(p_name,'')), 40);
        v_pseudo text := left(trim(coalesce(p_pseudo,'')), 20);
        v_secret text := left(trim(coalesce(p_secret,'')), 64);
        v_code text; v_id uuid; v_try int := 0;
begin
  if length(v_name) < 2 or length(v_pseudo) < 2 or length(v_secret) < 8 then
    return json_build_object('ok', false, 'error', 'invalid_input');
  end if;
  loop
    v_try := v_try + 1;
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '') from generate_series(1,6));
    begin
      insert into public.ldc_leagues(code, name) values (v_code, v_name) returning id into v_id;
      exit;
    exception when unique_violation then
      if v_try > 5 then return json_build_object('ok', false, 'error', 'retry'); end if;
    end;
  end loop;
  insert into public.ldc_members(league_id, pseudo, secret) values (v_id, v_pseudo, v_secret);
  return public.ldc_get_league(v_code);
end $$;

-- Rejoindre une ligue par code (pseudo unique par ligue, 50 membres max)
create or replace function public.ldc_join_league(p_code text, p_pseudo text, p_secret text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_league public.ldc_leagues;
        v_pseudo text := left(trim(coalesce(p_pseudo,'')), 20);
        v_secret text := left(trim(coalesce(p_secret,'')), 64);
        v_count int;
begin
  if length(v_pseudo) < 2 or length(v_secret) < 8 then return json_build_object('ok', false, 'error', 'invalid_input'); end if;
  select * into v_league from public.ldc_leagues where code = upper(trim(p_code));
  if v_league.id is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  select count(*) into v_count from public.ldc_members where league_id = v_league.id;
  if v_count >= 50 then return json_build_object('ok', false, 'error', 'full'); end if;
  begin
    insert into public.ldc_members(league_id, pseudo, secret) values (v_league.id, v_pseudo, v_secret);
  exception when unique_violation then
    if not exists(select 1 from public.ldc_members where league_id = v_league.id and pseudo = v_pseudo and secret = v_secret) then
      return json_build_object('ok', false, 'error', 'pseudo_taken');
    end if;
  end;
  return public.ldc_get_league(v_league.code);
end $$;

-- Pousser son score (authentifié par le secret du joueur)
create or replace function public.ldc_push_score(p_code text, p_pseudo text, p_secret text, p_pts int, p_good int, p_exact int, p_played int)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_league public.ldc_leagues; v_n int;
begin
  select * into v_league from public.ldc_leagues where code = upper(trim(p_code));
  if v_league.id is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  update public.ldc_members
     set pts = greatest(0, least(coalesce(p_pts,0), 100000)),
         good = greatest(0, least(coalesce(p_good,0), 10000)),
         exact = greatest(0, least(coalesce(p_exact,0), 10000)),
         played = greatest(0, least(coalesce(p_played,0), 10000)),
         updated_at = now()
   where league_id = v_league.id and pseudo = left(trim(coalesce(p_pseudo,'')),20) and secret = left(trim(coalesce(p_secret,'')),64);
  get diagnostics v_n = row_count;
  if v_n = 0 then return json_build_object('ok', false, 'error', 'unauthorized'); end if;
  return public.ldc_get_league(v_league.code);
end $$;

-- Quitter une ligue (la ligue vide est purgée)
create or replace function public.ldc_leave_league(p_code text, p_pseudo text, p_secret text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_league public.ldc_leagues; v_n int;
begin
  select * into v_league from public.ldc_leagues where code = upper(trim(p_code));
  if v_league.id is null then return json_build_object('ok', true); end if;
  delete from public.ldc_members
   where league_id = v_league.id and pseudo = left(trim(coalesce(p_pseudo,'')),20) and secret = left(trim(coalesce(p_secret,'')),64);
  get diagnostics v_n = row_count;
  delete from public.ldc_leagues l where l.id = v_league.id and not exists(select 1 from public.ldc_members m where m.league_id = l.id);
  return json_build_object('ok', v_n > 0);
end $$;

revoke all on function public.ldc_get_league(text) from public;
revoke all on function public.ldc_create_league(text, text, text) from public;
revoke all on function public.ldc_join_league(text, text, text) from public;
revoke all on function public.ldc_push_score(text, text, text, int, int, int, int) from public;
revoke all on function public.ldc_leave_league(text, text, text) from public;
grant execute on function public.ldc_get_league(text) to anon, authenticated;
grant execute on function public.ldc_create_league(text, text, text) to anon, authenticated;
grant execute on function public.ldc_join_league(text, text, text) to anon, authenticated;
grant execute on function public.ldc_push_score(text, text, text, int, int, int, int) to anon, authenticated;
grant execute on function public.ldc_leave_league(text, text, text) to anon, authenticated;
