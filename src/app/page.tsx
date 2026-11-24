"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, RefreshCw, ExternalLink, Sparkles, Newspaper, BookOpen, Radar,
  Clock3, AlertCircle, LayoutDashboard, ChevronRight, Filter,
  ArrowUpRight, Zap, Cpu, Atom, Leaf, Menu, X, Sun, Moon
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
  { id: "generative-agentic-ai", label: "Generative & Agentic AI", shortLabel: "Agentic AI", description: "Autonomous agents, reasoning models and enterprise AI." },
  { id: "quantum-computing", label: "Quantum Computing", shortLabel: "Quantum", description: "Qubit scaling, fault tolerance and quantum advantage." },
  { id: "neuromorphic-computing", label: "Neuromorphic Computing", shortLabel: "Neuromorphic", description: "Brain-inspired computing and low-power silicon." },
  { id: "hyperautomation", label: "Hyperautomation", shortLabel: "Hyperautomation", description: "AI process orchestration and autonomous workflows." },
  { id: "autonomous-vehicles", label: "Autonomous Vehicles", shortLabel: "Autonomous EV", description: "Self-driving fleets, robotaxis and spatial perception." },
  { id: "battery-technologies", label: "Battery Technologies", shortLabel: "Batteries", description: "Solid-state cells and grid-scale energy storage." },
  { id: "synthetic-biology", label: "Synthetic Biology", shortLabel: "SynBio", description: "Programmable organisms and biomanufacturing." },
  { id: "brain-computer-interfaces", label: "Brain-Computer Interfaces (BCIs)", shortLabel: "BCIs", description: "Neural interfaces and cognitive decoding." },
  { id: "digital-trust", label: "Digital Trust Technologies", shortLabel: "Digital Trust", description: "Post-quantum security, provenance and verification." },
  { id: "zero-latency-connectivity", label: "Zero-Latency Connectivity", shortLabel: "6G & Edge", description: "6G research, satellite-to-cell and edge networks." },
  { id: "voice-activated-tech", label: "Voice-Activated Technology", shortLabel: "Voice AI", description: "Conversational voice agents and audio interfaces." },
  { id: "nuclear-fusion", label: "Nuclear Fusion", shortLabel: "Fusion", description: "Fusion milestones and next-generation reactors." },
  { id: "preventive-medicine", label: "Preventive Medicine & Wellbeing", shortLabel: "Preventive Med", description: "AI diagnostics and personalized health technologies." },
  { id: "climate-tech", label: "Climate Tech", shortLabel: "Climate Tech", description: "Carbon removal, green hydrogen and decarbonization." },
  { id: "space-exploration", label: "Space Exploration", shortLabel: "Space Tech", description: "Reusable launch, orbital infrastructure and lunar economy." },
  { id: "nanotechnology", label: "Nanotechnology", shortLabel: "Nanotech", description: "Advanced materials and nanoscale applications." },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently published" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function relativeTime(value: string | null) {
  if (!value) return "Waiting for first sync";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently synced";
  return "Synced " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HomePage() {
  const [articles, setArticles] = useState<FeedItem[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "news" | "research">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [analyses, setAnalyses] = useState<Record<string, { status: "loading" | "error" | "ready"; error?: string; data?: { whatHappened: string; whyItMatters: string; opportunities: string[]; risks: string[]; confidenceNote: string } }>>({});


  useEffect(() => {
    const savedTheme = window.localStorage.getItem("futuretech-radar-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("futuretech-radar-theme", theme);
  }, [theme]);
  const abortRef = useRef<AbortController | null>(null);

  const fetchArticles = useCallback(async (topicId: string, category: "all" | "news" | "research") => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ topic: topicId, type: category, _t: String(Date.now()) });
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setArticles(data.articles || []);
      setUpdatedAt(data.updatedAt || null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("We couldn't load the intelligence feed. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(selectedTopic, selectedCategory);
    return () => abortRef.current?.abort();
  }, [selectedTopic, selectedCategory, fetchArticles]);

  const activeTopic = useMemo(() => FUTURE_TOPICS.find(topic => topic.id === selectedTopic), [selectedTopic]);
  const filteredArticles = useMemo(() => articles.filter(item => {
    if (selectedTopic !== "all" && item.topicId !== selectedTopic) return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    const q = searchQuery.trim().toLowerCase();
    return !q || [item.title, item.summary, item.source, item.topicLabel].some(value => (value || "").toLowerCase().includes(q));
  }), [articles, selectedTopic, selectedCategory, searchQuery]);


  const analyseArticle = async (article: FeedItem) => {
    if (analyses[article.id]?.status === "loading" || analyses[article.id]?.status === "ready") return;
    setAnalyses(current => ({ ...current, [article.id]: { status: "loading" } }));
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          summary: article.summary || article.title,
          source: article.source,
          url: article.url,
          topicLabel: article.topicLabel,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analysis failed.");
      setAnalyses(current => ({ ...current, [article.id]: { status: "ready", data: result.analysis } }));
    } catch (err) {
      setAnalyses(current => ({
        ...current,
        [article.id]: { status: "error", error: err instanceof Error ? err.message : "Analysis failed." },
      }));
    }
  };

  const topicCount = new Set(articles.map(item => item.topicId)).size;
  const researchCount = articles.filter(item => item.category === "research").length;

  return (
    <div className={`app-shell min-h-screen text-slate-100 ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-white/[0.07] bg-[#0b1120] px-5 py-6 transition-transform lg:static lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between">
            <a href="#" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-300"><Radar size={21}/></span>
              <span><span className="block text-sm font-semibold tracking-wide text-white">FutureTech Radar</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Technology intelligence</span></span>
            </a>
            <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Close navigation"><X size={18}/></button>
          </div>

          <div className="mt-10">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            <div aria-current="page" className="flex w-full items-center gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-3 py-3 text-left text-sm font-medium text-indigo-200"><LayoutDashboard size={17}/> Intelligence overview</div>
            <button aria-pressed={selectedCategory === "all" && selectedTopic === "all"} onClick={() => { setSelectedCategory("all"); setSelectedTopic("all"); setMobileNavOpen(false); }} className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${selectedCategory === "all" && selectedTopic === "all" ? "border border-indigo-400/20 bg-indigo-400/10 font-medium text-indigo-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><Newspaper size={17}/> All signals</button>
            <button aria-pressed={selectedCategory === "research"} onClick={() => { setSelectedCategory("research"); setMobileNavOpen(false); }} className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${selectedCategory === "research" ? "border border-indigo-400/20 bg-indigo-400/10 font-medium text-indigo-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><BookOpen size={17}/> Research & breakthroughs</button>
          </div>

          <div className="mt-9 min-h-0 flex-1">
            <div className="mb-3 flex items-center justify-between px-3"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Technology radar</p><span className="text-[10px] text-slate-600">16 areas</span></div>
            <div className="space-y-1 overflow-y-auto pb-4">
              {FUTURE_TOPICS.map((topic, index) => (
                <button key={topic.id} onClick={() => { setSelectedTopic(topic.id); setMobileNavOpen(false); }} aria-pressed={selectedTopic === topic.id} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition ${selectedTopic === topic.id ? "bg-indigo-400/15 font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-300/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.05] text-[10px] text-slate-500">{String(index + 1).padStart(2, "0")}</span><span className="truncate">{topic.shortLabel}</span>{selectedTopic === topic.id && <ChevronRight className="ml-auto text-indigo-300" size={14}/>}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><Zap size={14} className="text-amber-300"/> Intelligence feed</div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Signals collected from tracked technology sources. Business analysis and AI briefings are planned next.</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Feed interface available</div>
          </div>
        </aside>

        {mobileNavOpen && <button aria-label="Close menu overlay" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden"/>}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#080d18]/90 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-7 xl:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"><Menu size={18}/></button>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Intelligence workspace</p><h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">Overview</h1></div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative hidden w-56 md:block xl:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search signals, sources..." className="w-full rounded-xl border border-white/10 bg-white/[0.035] py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/50"/>
                </div>
                <button onClick={() => fetchArticles(selectedTopic, selectedCategory)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/><span className="hidden sm:inline">Refresh</span></button>
                <button onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/10">{theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}<span className="hidden sm:inline">{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>
              </div>
            </div>
            <div className="px-4 pb-3 md:hidden"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input aria-label="Search signals and sources" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search signals, sources..." className="w-full rounded-xl border border-white/10 bg-white/[0.035] py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20"/></div></div>
          </header>

          <div className="mx-auto max-w-[1320px] space-y-7 px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
            <section className="relative overflow-hidden rounded-2xl border border-indigo-300/15 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.18),_transparent_48%),linear-gradient(120deg,#111a31_0%,#10182b_52%,#111629_100%)] p-6 sm:p-8">
              <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-indigo-300/[0.08]"/><div className="pointer-events-none absolute -right-2 -top-14 h-52 w-52 rounded-full border border-indigo-300/[0.08]"/>
              <div className="relative max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200"><Sparkles size={13}/> From technology signals to business decisions</div>
                <h2 className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">See what’s emerging.<br className="hidden sm:block"/> Understand what matters.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/75">Explore developments across the technologies shaping tomorrow. Discover the signals first; build a clearer view of their business relevance as intelligence features evolve.</p>
                <div className="mt-6 flex flex-wrap items-center gap-3"><button onClick={() => { setSelectedTopic("all"); setSelectedCategory("all"); document.getElementById("signals")?.scrollIntoView({ behavior: "smooth" }); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400">Explore latest signals <ArrowUpRight size={15}/></button><span className="text-[11px] text-slate-400">{relativeTime(updatedAt)}</span></div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] bg-[#0d1525] p-4"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Signals in this view</span><span className="rounded-lg bg-indigo-400/10 p-2 text-indigo-300"><Radar size={16}/></span></div><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{loading ? "—" : filteredArticles.length}</p><p className="mt-1 text-[10px] text-slate-500">Articles returned for current filters</p></div>
              <div className="rounded-xl border border-white/[0.07] bg-[#0d1525] p-4"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Technology areas represented</span><span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><Cpu size={16}/></span></div><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{loading ? "—" : topicCount}</p><p className="mt-1 text-[10px] text-slate-500">Within the currently loaded feed</p></div>
              <div className="rounded-xl border border-white/[0.07] bg-[#0d1525] p-4"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Research items</span><span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300"><Atom size={16}/></span></div><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{loading ? "—" : researchCount}</p><p className="mt-1 text-[10px] text-slate-500">Research in the currently loaded feed</p></div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div id="signals" className="min-w-0">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Discover</p><h2 className="mt-1 text-lg font-semibold text-white">Latest technology signals</h2><p className="mt-1 text-xs text-slate-500">A source-led view of developments across the radar.</p></div><div className="flex items-center gap-2 text-[11px] text-slate-500"><Clock3 size={13}/>{relativeTime(updatedAt)}</div></div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {(["all", "news", "research"] as const).map(category => <button key={category} onClick={() => setSelectedCategory(category)} aria-pressed={selectedCategory === category} className={`rounded-lg border px-3 py-2 text-[11px] font-medium transition ${selectedCategory === category ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-200" : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]"}`}>{category === "all" ? "All signals" : category === "news" ? "News & business" : "Research"}</button>)}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-slate-500"><Filter size={12}/>{filteredArticles.length} results</span>
                </div>
                {activeTopic && <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-indigo-300/15 bg-indigo-300/[0.05] p-3"><div><p className="text-xs font-semibold text-indigo-100">{activeTopic.label}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-400">{activeTopic.description}</p></div><button onClick={() => setSelectedTopic("all")} className="shrink-0 text-[10px] text-indigo-300 hover:text-white">Clear filter</button></div>}
                {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-xs text-rose-200"><AlertCircle size={15}/>{error}</div>}
                {loading ? <div className="grid gap-3 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025] p-5"><div className="h-3 w-24 rounded bg-white/10"/><div className="mt-5 h-4 w-full rounded bg-white/10"/><div className="mt-2 h-4 w-3/4 rounded bg-white/10"/><div className="mt-5 h-3 w-1/2 rounded bg-white/10"/></div>)}</div>
                : filteredArticles.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 px-5 py-14 text-center"><Search className="mx-auto text-slate-600" size={22}/><p className="mt-3 text-sm font-medium text-slate-300">No matching signals</p><p className="mt-1 text-xs text-slate-500">Try another search or clear one of your filters.</p><button onClick={() => {setSearchQuery("");setSelectedTopic("all");setSelectedCategory("all");}} className="mt-4 text-xs font-medium text-indigo-300 hover:text-white">Clear all filters</button></div>
                : <div className="grid gap-3 md:grid-cols-2">{filteredArticles.map(article => {
                  const analysis = analyses[article.id];
                  return <article key={article.id} className="flex min-h-[205px] flex-col rounded-xl border border-white/[0.07] bg-[#0d1525] p-4 transition duration-200 hover:border-indigo-300/30">
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-md border border-indigo-300/15 bg-indigo-300/[0.08] px-2 py-1 text-[10px] font-medium text-indigo-200">{article.topicLabel}</span><span className={`rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${article.category === "research" ? "bg-emerald-300/10 text-emerald-300" : "bg-sky-300/10 text-sky-300"}`}>{article.category === "research" ? "Research" : "News"}</span></div>
                      <h3 className="text-sm font-semibold leading-5 text-slate-100">{article.title}</h3>
                      {article.summary && <p className="mt-2 line-clamp-3 text-[11px] leading-[1.65] text-slate-400">{article.summary}</p>}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                      <div className="min-w-0"><p className="truncate text-[10px] font-medium text-slate-300">{article.source}</p><p className="mt-1 text-[10px] text-slate-600">{formatDate(article.publishedAt)}</p></div>
                      <a href={article.url} target="_blank" rel="noopener noreferrer" aria-label={`Read original article: ${article.title}`} className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-300 hover:text-indigo-200">Source <ExternalLink size={12}/></a>
                    </div>
                    <button onClick={() => analyseArticle(article)} disabled={analysis?.status === "loading" || analysis?.status === "ready"} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.08] px-3 py-2.5 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-300/[0.14] disabled:cursor-not-allowed disabled:opacity-70">
                      <Sparkles size={13}/>{analysis?.status === "loading" ? "Analysing with Gemini…" : analysis?.status === "ready" ? "AI analysis ready" : "Analyse with AI"}
                    </button>
                    {analysis?.status === "error" && <p role="alert" className="mt-2 text-[10px] text-rose-300">{analysis.error}</p>}
                    {analysis?.status === "ready" && analysis.data && <div className="mt-3 space-y-3 rounded-lg border border-violet-300/15 bg-violet-300/[0.045] p-3">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">What happened</p><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{analysis.data.whatHappened}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">Why it matters</p><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{analysis.data.whyItMatters}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">Potential opportunities</p><ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">{analysis.data.opportunities.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">Risks & uncertainties</p><ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">{analysis.data.risks.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                      <p className="border-t border-white/[0.07] pt-2 text-[10px] leading-relaxed text-slate-500">Evidence note: {analysis.data.confidenceNote}</p>
                      <p className="text-[9px] text-slate-600">AI-generated interpretation. Check the linked source before making decisions.</p>
                    </div>}
                  </article>;
                })}</div>}
              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-white/[0.07] bg-[#0d1525] p-4"><div className="flex items-center gap-2"><Sparkles size={15} className="text-violet-300"/><h3 className="text-xs font-semibold text-slate-100">Intelligence layer</h3></div><p className="mt-3 text-xs leading-relaxed text-slate-400">The current feed brings together published signals. AI synthesis, business implications and evidence-backed priority scoring are planned enhancements—not yet active.</p><div className="mt-4 space-y-2"><div className="flex items-center justify-between text-[10px]"><span className="text-slate-500">Source discovery</span><span className="text-emerald-300">Available</span></div><div className="h-1 rounded-full bg-white/10"><div className="h-1 w-full rounded-full bg-emerald-400/70"/></div><div className="flex items-center justify-between text-[10px]"><span className="text-slate-500">AI business analysis</span><span className="text-slate-500">Planned</span></div><div className="h-1 rounded-full bg-white/10"/></div></div>
                <div className="rounded-xl border border-white/[0.07] bg-[#0d1525] p-4"><div className="flex items-center gap-2"><Leaf size={15} className="text-emerald-300"/><h3 className="text-xs font-semibold text-slate-100">Explore the radar</h3></div><p className="mt-2 text-[11px] leading-relaxed text-slate-500">Choose a technology area to focus the signal feed.</p><div className="mt-3 flex flex-wrap gap-1.5">{FUTURE_TOPICS.slice(0,8).map(topic=><button key={topic.id} aria-pressed={selectedTopic === topic.id} onClick={()=>setSelectedTopic(topic.id)} className={`rounded-md border px-2 py-1.5 text-[10px] transition ${selectedTopic === topic.id ? "border-indigo-300/30 bg-indigo-300/10 text-indigo-200" : "border-white/[0.07] text-slate-400 hover:border-white/20 hover:text-white"}`}>{topic.shortLabel}</button>)}</div><button onClick={()=>setSelectedTopic("all")} className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-300 hover:text-white">View all technology areas <ChevronRight size={12}/></button></div>
              </aside>
            </section>
            <footer className="border-t border-white/[0.06] pt-5 text-[10px] text-slate-600"><div className="flex flex-wrap items-center justify-between gap-2"><span>FutureTech Radar · Technology intelligence workspace</span><span>Source-led insights · More intelligence capabilities coming soon</span></div></footer>
          </div>
        </main>
      </div>
    </div>
  );
}
