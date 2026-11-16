"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Atom,
  BookOpen,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { FUTURE_TOPICS } from "@/lib/topics";
import type { ArticleCategory, NewsArticle } from "@/lib/crawler";

export default function HomePage() {
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | ArticleCategory>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [crawledAt, setCrawledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchFeed(topic: string, type: "all" | ArticleCategory) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/news?topic=${encodeURIComponent(topic)}&type=${encodeURIComponent(type)}`
      );
      if (!res.ok) throw new Error("Failed to load feed");
      const data = await res.json();
      setArticles(data.articles ?? []);
      setCrawledAt(data.crawledAt ?? null);
    } catch {
      setError("Could not crawl live sources right now. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeed(selectedTopic, selectedType);
  }, [selectedTopic, selectedType]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q) ||
        a.topicName.toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  const activeTopicObj = FUTURE_TOPICS.find((t) => t.id === selectedTopic);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
              <Atom className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                FutureTech Radar
              </h1>
              <p className="text-xs text-slate-400">
                Live intelligence across 16 emerging technologies
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter headlines or sources..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => fetchFeed(selectedTopic, selectedType)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Category Tabs & Status */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/80 p-1">
            <button
              onClick={() => setSelectedType("all")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                selectedType === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              All Updates
            </button>
            <button
              onClick={() => setSelectedType("news")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                selectedType === "news"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Newspaper className="h-3.5 w-3.5" />
              News & Business
            </button>
            <button
              onClick={() => setSelectedType("research")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                selectedType === "research"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Research & Breakthroughs
            </button>
          </div>

          <div className="text-xs text-slate-400">
            {loading
              ? "Crawling live feeds..."
              : `${filteredArticles.length} articles${
                  crawledAt
                    ? ` · Updated ${new Date(crawledAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""
                }`}
          </div>
        </div>

        {/* 16 Future Technology Filter Pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTopic("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedTopic === "all"
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            All 16 Technologies
          </button>
          {FUTURE_TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedTopic === topic.id
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                  : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {topic.shortName}
            </button>
          ))}
        </div>

        {/* Selected Topic Banner */}
        {activeTopicObj && (
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-base font-semibold text-white">
              {activeTopicObj.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {activeTopicObj.description}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-48 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60 p-5"
              />
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
            No articles matched your filter. Try clearing the search box or clicking Refresh.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 p-5 transition hover:border-indigo-500/50 hover:bg-slate-900"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${article.badgeColor}`}
                    >
                      {article.topicName}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      {article.category === "research" ? "Research" : "News"}
                    </span>
                  </div>

                  <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-slate-100 group-hover:text-indigo-300">
                    {article.title}
                  </h3>

                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-500">
                  <span className="truncate font-medium text-slate-400">
                    {article.source}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
