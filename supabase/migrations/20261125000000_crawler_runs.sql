-- Durable execution history for the scheduled FutureTech Radar crawler.
create table if not exists public.crawler_runs (
  id uuid primary key,
  trigger_source text not null,
  sync_scope text not null default 'all',
  status text not null check (status in ('started', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  fetched_count integer not null default 0 check (fetched_count >= 0),
  persisted_count integer not null default 0 check (persisted_count >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists crawler_runs_started_at_idx
  on public.crawler_runs (started_at desc);
create index if not exists crawler_runs_status_started_at_idx
  on public.crawler_runs (status, started_at desc);

alter table public.crawler_runs enable row level security;
grant select, insert, update on public.crawler_runs to service_role;

-- Keep the successful run record and sync watermark in one transaction.
create or replace function public.complete_crawler_run(
  p_run_id uuid,
  p_scope text,
  p_fetched_count integer,
  p_persisted_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_fetched_count <= 0 or p_persisted_count <> p_fetched_count then
    raise exception 'Invalid crawler completion counts';
  end if;

  update public.crawler_runs
  set status = 'succeeded',
      completed_at = now(),
      fetched_count = p_fetched_count,
      persisted_count = p_persisted_count,
      error_message = null
  where id = p_run_id
    and status = 'started';

  if not found then
    raise exception 'Crawler run % was not found or is not in started state', p_run_id;
  end if;

  insert into public.sync_state (scope, last_synced_at)
  values (p_scope, now())
  on conflict (scope)
  do update set last_synced_at = excluded.last_synced_at;
end;
$$;

revoke all on function public.complete_crawler_run(uuid, text, integer, integer) from public;
grant execute on function public.complete_crawler_run(uuid, text, integer, integer) to service_role;
