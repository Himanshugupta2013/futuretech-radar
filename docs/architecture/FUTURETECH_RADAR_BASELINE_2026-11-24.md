# FutureTech Radar — Architecture Baseline

**Baseline ID:** FTR-ARCH-BASELINE-2026-11-24  
**Review date:** 2026-11-24  
**Status:** Read-only architecture review snapshot  
**Purpose:** Reference point for subsequent design decisions, implementation changes, and validation.

> This document records the observed system state at the review date. It is not a claim that all target-state components are implemented. Re-verify live configuration before relying on time-sensitive status.

## 1. Scope and evidence boundaries

The review covered GitHub branches and source, Vercel project and deployments, Supabase project/schema/functions/jobs, and Gemini integration evidence available from application source, runtime logs, and the user's Google AI Studio screenshot.

Secrets were not retrieved or recorded. No Production deployment, Production environment variable, or Production database schema was changed during the review.

Gemini account-level settings and full per-model quota configuration were not independently inspected. Gemini usage figures below are transcribed from the user's screenshot.

## 2. System identity

- GitHub repository: `Himanshugupta2013/futuretech-radar`
- Vercel project: `futuretech-radar`
- Production URL: `https://futuretech-radar.vercel.app`
- Supabase project ref: `pfhwcwyycqaouckfjczq`
- Supabase URL: `https://pfhwcwyycqaouckfjczq.supabase.co`
- Supabase region: `ap-south-1`
- Gemini model configured in application source: `gemini-3.1-flash-lite`

## 3. GitHub baseline

### Branches and pull request

- `main` baseline commit: `0e00325ff8f73b2e30abd6230bd9ef58f6aa3a85`
- `feat/executive-dashboard-redesign`: 34 commits ahead of main, 0 behind at review time.
- Feature branch head at review time: `2e03acb` (short SHA as returned by the review tool).
- `fix/supabase-secure-ingestion`: separate security branch.
- PR #1, “Fix secure Supabase article ingestion”: open, Draft, not merged, mergeable at review time; head `cae2d2be9cdd21657d5ea8392351bf287a9924d3`.

The feature branch contains the redesigned dashboard, crawler changes, Gemini analysis API, intelligence processor, Preview test endpoint, and Preview intelligence migration. These changes are not part of the main branch baseline.

### Important source files on the feature branch

- `src/app/api/news/route.ts` — saved-article read API.
- `src/app/api/analyze/route.ts` — on-demand article analysis.
- `src/app/api/cron/news/route.ts` — scheduled/manual crawler entry point.
- `src/app/api/cron/process-intelligence/route.ts` — persisted intelligence processor.
- `src/app/api/preview-intelligence-test/route.ts` — guarded Preview test trigger.
- `src/lib/crawler.ts` — source discovery and normalization.
- `src/lib/supabase.ts` — Supabase access layer.
- `src/lib/intelligence.ts` — Gemini structured-output engine.
- `src/lib/topics.ts` — topic catalogue.
- `supabase/migrations/20261124123000_create_preview_article_intelligence.sql` — Preview intelligence table migration.

### GitHub findings

1. README/documentation is behind the current implementation.
2. Two Gemini workflows exist: on-demand analysis and persisted intelligence processing.
3. The current crawler fetches Hacker News top-story data repeatedly per topic; this can be optimized by fetching once and matching across topics.
4. The feature branch is a development baseline, not a Production release.

## 4. Vercel baseline

- Project: `futuretech-radar`
- Production domain: `https://futuretech-radar.vercel.app`
- Production deployment at review time used main commit `0e00325`.
- Feature Preview deployment at review time was READY and used feature commit `2e03acb`.
- Preview environment variable names were verified without reading values: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_ARTICLES_TABLE`, `CRON_SECRET`.

### Vercel findings

1. The active Supabase Edge relay was configured to invoke a Vercel URL associated with the security branch, not the executive dashboard feature Preview. Branch-specific environment configuration for the security branch was not verified as complete.
2. The main-branch `vercel.json` Cron entry targeted `/api/news?force=true`, while the current `/api/news` handler is read-only. This does not establish a working crawler schedule.
3. The feature branch `vercel.json` was empty at review time.
4. The feature Preview deployment built successfully. A successful build does not prove an end-to-end scheduled workflow.

## 5. Supabase baseline

### Project and data

- Project active; region `ap-south-1`.
- `public.articles`: 42 rows at review time.
- `public.preview_articles`: 36 rows at review time.
  - 32 research records from arXiv.
  - 4 news records from Hacker News.
- `public.preview_article_intelligence`: 2 rows at review time.
  - Both rows had `processing_status = failed`.
  - Both had `attempt_count = 2`.
- `public.sync_state`: 0 rows at review time.

Counts are a snapshot and will naturally change.

### Security and extensions

- RLS enabled on Preview data tables.
- No public policies on the Preview article/intelligence tables; design is service-role/server-only.
- `pg_cron` and `pg_net` installed.
- Edge Function `preview-news-relay` active.
- `cron.job` returned zero active scheduled jobs at review time.
- The Preview intelligence migration exists in GitHub and the table exists remotely, but the migration did not appear in the remote migration history returned by Supabase. Reconcile before future schema releases.

### Supabase findings

1. The components for scheduled execution exist, but no active Supabase Cron schedule was found.
2. Relay existence does not prove relay scheduling or end-to-end execution.
3. Migration history and live schema are not fully reconciled.
4. Production `articles` and Preview tables are separate; preserve this boundary.

## 6. Gemini baseline

- Application model: `gemini-3.1-flash-lite`.
- API key is configured as a server-side Vercel Preview environment variable.
- Intelligence engine sends structured JSON requests and validates output against the allowed topic catalogue.
- Prompt treats supplied article text as untrusted and warns against inventing facts or claiming to have read the linked page.
- Application calls Gemini with title and supplied excerpt/summary; it does not fetch the linked page as part of this engine.

### Provider evidence

User-provided Google AI Studio screenshot, Free tier, last 7 days:
- Total requests: 10.
- Input tokens: 6,651.
- Output tokens: 560.
- Total API errors: 8.
- Error type shown: `503 ServiceUnavailable`.

Vercel runtime logs and Supabase failure records also showed HTTP 503 errors for both Preview test articles. The two articles each reached two attempts and remained failed. This supports a provider availability issue at the time; it does not prove every 503 in the seven-day chart came from this test.

## 7. Existing API responsibilities

| Endpoint | Observed responsibility |
|---|---|
| `GET /api/news` | Read saved articles from Supabase |
| `POST /api/analyze` | On-demand Gemini article analysis; response to caller |
| `GET /api/cron/news` | Crawler/retention entry point protected by Cron secret |
| `POST /api/cron/process-intelligence` | Process up to two research articles and persist structured results |
| `POST /api/preview-intelligence-test` | Preview-only browser test trigger with one controlled retry guard |

The on-demand and persisted intelligence paths are separate workflows and should be consolidated or explicitly differentiated in a future design.

## 8. Current-state architecture

~~~mermaid
flowchart TD
    U[User / Browser] --> UI[Next.js dashboard]
    UI --> READ[GET /api/news]
    UI --> ANALYZE[POST /api/analyze]
    UI --> TEST[Preview test endpoint]
    READ --> DB[(Supabase articles / preview_articles)]
    ANALYZE --> GEM[Gemini API]
    TEST --> PROC[Persisted intelligence processor]
    PROC --> GEM
    PROC --> INT[(preview_article_intelligence)]
    RELAY[preview-news-relay Edge Function] -. configured relay .-> CRON[Vercel cron endpoints]
    CRON -. no active Supabase cron jobs found .-> ING[Ingestion workflow]
~~~

This diagram records component relationships, not proof that the dashed scheduled path is operational.

## 9. Key gaps and risks

| Priority | Gap | Impact |
|---|---|---|
| P0 | Relay target and active Preview branch are misaligned | Scheduled execution can target the wrong deployment |
| P0 | No active Supabase Cron jobs | No verified recurring ingestion/processing |
| P0 | Failed intelligence records have no durable delayed retry schedule | Provider outages leave work failed |
| P1 | Supabase migration history differs from GitHub/live schema | Future migrations may be unsafe |
| P1 | Two separate Gemini workflows | Fragmented persistence, cost controls and observability |
| P1 | Hacker News synthetic discussion metadata may be treated like article evidence | Weak or misleading AI conclusions |
| P1 | Repeated Hacker News fetches per topic | Unnecessary upstream calls |
| P1 | Some dashboard capability indicators are static/planned | UI can imply operational readiness prematurely |
| P1 | README does not describe the current system | Onboarding and maintenance risk |

## 10. Target architecture decisions

1. Article discovery and AI analysis are independent workflows.
2. Article ingestion must continue during Gemini outages.
3. Supabase PostgreSQL is the system of record.
4. Queue processing must use atomic claims and durable retry timestamps.
5. Retry schedule must be delayed and bounded; do not hold Vercel functions open while waiting.
6. Completed work must not be reprocessed unless content hash or prompt/model version changes or an explicit reanalysis is requested.
7. Gemini output must be schema-validated and evidence-aware.
8. Preview and Production must have separate URLs, secrets, data and schedules.
9. Every scheduled execution must have a correlation ID and structured operational metrics.
10. No Production release or schema change without explicit user approval.

## 11. Recommended roadmap

### Phase 1 — Stabilize foundation
- Align Preview relay target and environment configuration.
- Correct Cron endpoint routing.
- Reconcile Supabase migration history.
- Configure and verify Preview-only schedules.
- Validate ingestion and retention end to end.

### Phase 2 — Reliable intelligence processing
- Introduce durable retry scheduling.
- Process pending queue items, not simply newest research records.
- Add atomic claims and stale-lock recovery.
- Consolidate Gemini workflows.
- Add processing and usage metrics.

### Phase 3 — Source quality and efficiency
- Fetch Hacker News data once per crawl.
- Preserve actual source excerpts separately from discussion metadata.
- Improve topic matching and deduplication.
- Add source quality indicators.

### Phase 4 — Executive intelligence
- Trend detection.
- Business impact assessment.
- Opportunity/risk prioritization.
- Evidence-backed executive briefings.
- Cross-article synthesis.

### Phase 5 — Production readiness
- End-to-end tests.
- Security/performance review.
- Cost and quota controls.
- Production migration and release plan.
- Explicit approval before Production promotion.

## 12. Baseline governance

For every subsequent change:
- Identify the relevant baseline component and gap.
- Record the GitHub files/commit affected.
- Record the Vercel Preview deployment used for validation.
- Record Supabase migration/schema/function/job changes.
- Record Gemini model/prompt/configuration changes without exposing secrets.
- Run a Preview acceptance test.
- Update this baseline or create a dated architecture decision/change record.
- Keep Production unchanged unless explicitly authorized.

**Baseline status:** Accepted as the architecture reference snapshot for FutureTech Radar as of 24 November 2026. Live service state must be rechecked before each implementation phase.
