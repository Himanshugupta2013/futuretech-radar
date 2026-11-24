-- Preview-only intelligence storage.
-- The FK intentionally targets preview_articles so Production articles remain untouched.

create table if not exists public.preview_article_intelligence (
  article_url text primary key
    references public.preview_articles(url)
    on delete cascade,
  primary_topic_id text,
  primary_topic_label text,
  secondary_topics jsonb not null default '[]'::jsonb
    check (jsonb_typeof(secondary_topics) = 'array'),
  relevance_score numeric(5,2)
    check (relevance_score is null or relevance_score between 0 and 100),
  confidence numeric(5,2)
    check (confidence is null or confidence between 0 and 100),
  classification_reason text,
  what_happened text,
  why_it_matters text,
  opportunities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(opportunities) = 'array'),
  risks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(risks) = 'array'),
  evidence_note text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','completed','failed','skipped')),
  processing_error text,
  content_hash text,
  model_name text,
  prompt_version text,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists preview_article_intelligence_status_idx
  on public.preview_article_intelligence (processing_status, created_at);

create index if not exists preview_article_intelligence_topic_idx
  on public.preview_article_intelligence (primary_topic_id, relevance_score desc);

alter table public.preview_article_intelligence enable row level security;

revoke all on table public.preview_article_intelligence from anon, authenticated;
grant select, insert, update, delete on table public.preview_article_intelligence to service_role;
