"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Newspaper,
  BookOpen,
  Radar,
  Clock,
  AlertCircle,
} from "lucide-react";

interface FutureTopic {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

interface FeedItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  topicId: string;
  topicLabel: string;
  category: "news" | "research";
}

const FUTURE_TOPICS: FutureTopic[] = [
  {
    id: "generative-agentic-ai",
    label: "Generative & Agentic AI",
    shortLabel: "Agentic AI",
    description: "Autonomous AI agents, reasoning models, and enterprise GenAI deployments.",
  },
  {
    id: "quantum-computing",
    label: "Quantum Computing",
    shortLabel: "Quantum",
    description: "Qubit scaling, fault-tolerant architectures, and quantum advantage.",
  },
  {
    id: "neuromorphic-computing",
    label: "Neuromorphic Computing",
    shortLabel: "Neuromorphic",
    description: "Brain-inspired spiking neural networks and ultra-low-power silicon.",
  },
  {
    id: "hyperautomation",
    label: "Hyperautomation",
    shortLabel: "Hyperautomation",
    description: "End-to-end AI process orchestration, RPA, and autonomous workflows.",
  },
  {
    id: "autonomous-vehicles",
    label: "Autonomous Vehicles",
    shortLabel: "Autonomous EV",
    description: "Self-driving fleets, robotaxis, and spatial perception systems.",
  },
  {
    id: "battery-technologies",
    label: "Battery Technologies",
    shortLabel: "Batteries",
    description: "Solid-state cells, sodium-ion storage, and grid-scale energy density.",
  },
  {
    id: "synthetic-biology",
    label: "Synthetic Biology",
    shortLabel: "SynBio",
    description: "Programmable organisms, biodesign, and sustainable biomanufacturing.",
  },
  {
    id: "brain-computer-interfaces",
    label: "Brain-Computer Interfaces (BCIs)",
    shortLabel: "BCIs",
    description: "Neural implants, non-invasive neurotech, and cognitive decoding.",
  },
  {
    id: "digital-trust",
    label: "Digital Trust Technologies",
    shortLabel: "Digital Trust",
    description: "Post-quantum cryptography, zero-knowledge proofs, and AI provenance.",
  },
  {
    id: "zero-latency-connectivity",
    label: "Zero-Latency Connectivity",
    shortLabel: "6G & Edge",
    description: "6G wireless research, satellite-to-cell, and deterministic edge networks.",
  },
  {
    id: "voice-activated-tech",
    label: "Voice-Activated Technology",
    shortLabel: "Voice AI",
    description: "Real-time conversational voice agents and multimodal audio interfaces.",
  },
  {
    id: "nuclear-fusion",
    label: "Nuclear Fusion",
    shortLabel: "Fusion",
    description: "Magnetic confinement, inertial fusion milestones, and commercial reactors.",
  },
  {
    id: "preventive-medicine",
    label: "Preventive Medicine & Wellbeing",
    shortLabel: "Preventive Med",
    description: "AI diagnostics, longevity biomarkers, and personalized genomics.",
  },
  {
    id: "climate-tech",
    label: "Climate Tech",
    shortLabel: "Climate Tech",
    description: "Direct air capture, green hydrogen, and industrial decarbonization.",
  },
  {
    id: "space-exploration",
    label: "Space Exploration",
    shortLabel: "Space Tech",
    description: "Reusable launch vehicles, orbital infrastructure, and lunar economy.",
  },
  {
    id: "nanotechnology",
    label: "Nanotechnology",
    shortLabel: "Nanotech",
    description: "Metamaterials, carbon nanotubes, and nanoscale drug delivery.",
  },
];

function formatDate(dateString: string) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}

export default function HomePage() {
  const [articles, setArticles] = useState<FeedItem[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "news" | "research">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchArticles = useCallback(
    async (topicId: string, category: "all" | "news" | "research", force = false) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("topic", topicId);
        params.set("type", category);
        if (force) params.set("force", "true");
        params.set("_t", String(Date.now()));

        const res = await fetch(`/api/news?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const data = await res.json();
        setArticles(data.articles || []);
        setUpdatedAt(data.updatedAt || null);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Unable to load intelligence feed right now. Please try refreshing.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchArticles(selectedTopic, selectedCategory, false);
  }, [selectedTopic, selectedCategory, fetchArticles]);

  const activeTopicObj = useMemo(
    () => FUTURE_TOPICS.find((t) => t.id === selectedTopic),
    [selectedTopic]
  );

  const filteredArticles = useMemo(() => {
    return articles.filter((item) => {
      if (selectedTopic !== "all" && item.topicId !== selectedTopic) {
        return false;
      }
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q) ||
          item.topicLabel.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [articles, selectedTopic, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070b14]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Radar className="w-5 h-5" />
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

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter headlines or sources..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900/90 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={() => fetchArticles(selectedTopic, selectedCategory, true)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Category Tabs + Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedCategory === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              All Updates
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("news")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedCategory === "news"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              News & Business
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("research")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedCategory === "research"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Research & Breakthroughs
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{filteredArticles.length} saved findings</span>
            {updatedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Synced {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* 16 Technology Topic Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTopic("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              selectedTopic === "all"
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                : "bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            All 16 Technologies
          </button>
          {FUTURE_TOPICS.map((topic) => (
            <button
              type="button"
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                selectedTopic === topic.id
                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                  : "bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {topic.shortLabel}
            </button>
          ))}
        </div>

        {/* Active Topic Banner */}
        {activeTopicObj && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">{activeTopicObj.label}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{activeTopicObj.description}</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-slate-900/50 border border-slate-800/80 p-5 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-4 w-24 bg-slate-800 rounded" />
                  <div className="h-5 w-full bg-slate-800 rounded" />
                  <div className="h-4 w-3/4 bg-slate-800 rounded" />
                </div>
                <div className="h-3 w-32 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-400 text-sm">
              No articles matched your current filters. Try clearing the search box or clicking Refresh.
            </p>
          </div>
        ) : (
          /* Articles Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArticles.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/50 p-5 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {article.topicLabel}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        article.category === "research"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                      }`}
                    >
                      {article.category === "research" ? "Research" : "News"}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition line-clamp-2 leading-snug">
                    {article.title}
                  </h3>

                  {article.summary && (
                    <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate max-w-[160px] font-medium text-slate-400">
                    {article.source}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span>{formatDate(article.publishedAt)}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
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
