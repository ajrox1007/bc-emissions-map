"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  RESEARCH_PROMPTS,
  DEFAULT_COMPETITORS,
  fillTemplate,
  getCompanyLogo,
  type ResearchCategory,
} from "@/lib/intelligence-prompts";

// ============= TYPES =============
interface Competitor {
  id: string;
  name: string;
  logoUrl?: string;
  territory: string[];
  estimatedMarketShare: number;
  manufacturersRepresented?: string[];
  pricingPositioning?: string;
  strengths?: string[];
  weaknesses?: string[];
  isActive: boolean;
  type?: "local" | "regional" | "national";
  createdAt: string;
  updatedAt: string;
}

interface ResearchData {
  category: ResearchCategory;
  loading: boolean;
  error?: string;
  data: any[];
  lastUpdated?: Date;
  noDataFound?: boolean;
}

interface IntelligenceUpdate {
  id: string;
  competitorId: string;
  category: string;
  title: string;
  description: string;
  source?: string;
  importance: "high" | "medium" | "low";
  dateDiscovered: string;
  createdBy?: string;
  pinned: boolean;
  dismissed: boolean;
  competitor?: {
    id: string;
    name: string;
    logoUrl?: string;
    territory?: string[];
  } | null;
  comments?: any[];
}

type IntelligenceView = "overview" | "competitors" | "updates";

// ============= SVG ICONS =============
const Icon = {
  building: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  search: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  refresh: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  x: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  arrowLeft: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  externalLink: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  lightning: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  trendUp: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  trendDown: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
  chart: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  megaphone: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  dollar: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  target: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  users: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  sparkles: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4m0 0H1m4 0h4M12 8l2 2m0 0l2-2m-2 2v4m6-2h4m-4 0v4m0-4h-4M12 20l-2-2m0 0l-2 2m2-2v-4" /></svg>,
  bell: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatShortDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Tab configuration
const RESEARCH_TABS: { id: ResearchCategory; name: string; icon: React.ReactNode }[] = [
  { id: "product_strategy", name: "Products", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
  { id: "sales_marketing", name: "Marketing", icon: Icon.megaphone },
  { id: "financial_performance", name: "Financials", icon: Icon.chart },
  { id: "technology_roadmap", name: "Technology", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg> },
  { id: "partnerships_ma", name: "Partnerships", icon: Icon.users },
  { id: "regulatory", name: "Regulatory", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
];

// ============= COMPANY LOGO COMPONENT =============
function CompanyLogo({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-16 h-16",
  };
  
  // Try to get logo from various sources
  const logoSrc = logoUrl || getCompanyLogo(name);
  
  if (!logoSrc || imgError) {
    return (
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center border border-slate-200`}>
        <span className={`font-bold text-slate-400 ${size === "lg" ? "text-xl" : size === "md" ? "text-lg" : "text-sm"}`}>
          {name.substring(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} bg-white rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden p-1.5`}>
      <img 
        src={logoSrc} 
        alt={name} 
        className="w-full h-full object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// ============= ARTICLE THUMBNAIL =============
function ArticleThumbnail({ url, title }: { url: string; title?: string }) {
  const [imgError, setImgError] = useState(false);
  
  // Extract domain for favicon
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    return null;
  }
  
  // Use Google favicon service as fallback
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  
  return (
    <div className="flex-shrink-0 w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
      {!imgError ? (
        <img 
          src={faviconUrl} 
          alt={domain}
          className="w-8 h-8 object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-xs text-slate-400 font-medium">{domain.substring(0, 3).toUpperCase()}</span>
      )}
    </div>
  );
}

// Helper to safely convert any value to a string for rendering
function safeStringify(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeStringify).join(", ");
  if (typeof value === "object") {
    // Convert object to readable format
    return Object.entries(value)
      .map(([k, v]) => `**${k}:** ${safeStringify(v)}`)
      .join("\n\n");
  }
  return String(value);
}

function extractMarkdownSections(markdown: string) {
  const lines = markdown.split("\n");
  const sections: { title: string; content: string; excerpt: string }[] = [];
  let currentTitle = "Overview";
  let currentLines: string[] = [];

  const pushSection = () => {
    if (currentLines.length === 0) return;
    const content = currentLines.join("\n").trim();
    if (!content) return;
    const excerptLine = content
      .split("\n")
      .find((line) => line.trim().length > 0 && !/^#+\s+/.test(line));
    const excerpt = (excerptLine || content).replace(/\s+/g, " ").slice(0, 140);
    sections.push({ title: currentTitle, content, excerpt });
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (headingMatch) {
      pushSection();
      currentTitle = headingMatch[2].trim();
      currentLines = [line];
      return;
    }
    if (currentLines.length === 0) {
      currentLines = [];
    }
    currentLines.push(line);
  });

  pushSection();

  if (sections.length === 0) {
    return [{ title: "Report", content: markdown, excerpt: "Full report" }];
  }

  return sections;
}

// ============= FINANCIAL DASHBOARD =============
function FinancialDashboard({ data }: { data: any }) {
  const d = data[0] || data;
  const financials = d.financials || {};
  const segments = d.segmentBreakdown || [];
  const quarters = d.quarterlyTrend || [];
  const metrics = d.keyMetrics || [];
  const activities = d.recentActivity || [];
  const guidance = d.guidance || {};
  const sources = d.sources || (d.source ? [d.source] : []);

  // Find max for segment bars
  const maxSegment = Math.max(...segments.map((s: any) => s.revenuePercent || 0), 1);
  
  // Safely extract financial values
  const revenueDisplay = safeStringify(financials.revenueBillions || financials.revenue || "N/A");
  const marketShareDisplay = safeStringify(financials.marketSharePercent || financials.marketShare || "N/A");
  const grossMarginDisplay = safeStringify(financials.grossMarginPercent || "N/A");
  const opMarginDisplay = safeStringify(financials.operatingMarginPercent || "N/A");
  const fiscalYear = safeStringify(financials.fiscalYear || "2025");
  const revenueGrowth = typeof financials.revenueGrowthPercent === "number" ? financials.revenueGrowthPercent : undefined;
  
  return (
    <div className="space-y-6">
      {/* Key Financial Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">Revenue</div>
          <div className="text-2xl font-bold text-slate-900">{revenueDisplay}</div>
          {revenueGrowth !== undefined && (
            <div className={`flex items-center gap-1 text-sm mt-1 ${revenueGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {revenueGrowth >= 0 ? Icon.trendUp : Icon.trendDown}
              {revenueGrowth >= 0 ? "+" : ""}{revenueGrowth}% YoY
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">Market Share</div>
          <div className="text-2xl font-bold text-slate-900">{marketShareDisplay}%</div>
          <div className="text-sm text-slate-400 mt-1">Est. HVAC market</div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">Gross Margin</div>
          <div className="text-2xl font-bold text-slate-900">{grossMarginDisplay}%</div>
          <div className="text-sm text-slate-400 mt-1">FY {fiscalYear}</div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">Operating Margin</div>
          <div className="text-2xl font-bold text-slate-900">{opMarginDisplay}%</div>
          <div className="text-sm text-slate-400 mt-1">FY {fiscalYear}</div>
        </div>
      </div>

      {/* Revenue by Segment */}
      {segments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue by Segment</h3>
          <div className="space-y-4">
            {segments.map((seg: any, i: number) => {
              const segmentName = typeof seg.segment === "string" ? seg.segment : safeStringify(seg.segment);
              const revPercent = typeof seg.revenuePercent === "number" ? seg.revenuePercent : 0;
              const growth = typeof seg.growth === "number" ? seg.growth : undefined;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{segmentName}</span>
                    <span className="text-slate-500">{revPercent}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(revPercent / maxSegment) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className={`h-full rounded-full ${
                        i === 0 ? "bg-blue-500" : i === 1 ? "bg-emerald-500" : i === 2 ? "bg-amber-500" : "bg-purple-500"
                      }`}
                    />
                  </div>
                  {growth !== undefined && (
                    <div className={`text-xs mt-1 ${growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {growth >= 0 ? "+" : ""}{growth}% growth
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quarterly Trend */}
      {quarters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Quarterly Revenue Trend</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {quarters.map((q: any, i: number) => {
              const revBillions = typeof q.revenueBillions === "number" ? q.revenueBillions : 0;
              const quarterLabel = typeof q.quarter === "string" ? q.quarter : safeStringify(q.quarter);
              const growthPct = typeof q.growthPercent === "number" ? q.growthPercent : undefined;
              const maxRev = Math.max(...quarters.map((x: any) => typeof x.revenueBillions === "number" ? x.revenueBillions : 0));
              const height = maxRev > 0 ? (revBillions / maxRev) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs font-medium text-slate-600">${revBillions}B</div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="w-full bg-blue-500 rounded-t-lg min-h-[4px]"
                  />
                  <div className="text-xs text-slate-500">{quarterLabel}</div>
                  {growthPct !== undefined && (
                    <div className={`text-xs ${growthPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {growthPct >= 0 ? "+" : ""}{growthPct}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((m: any, i: number) => {
            const metricStr = typeof m.metric === "string" ? m.metric : safeStringify(m.metric);
            const valueStr = typeof m.value === "string" ? m.value : safeStringify(m.value);
            const changeStr = typeof m.change === "string" ? m.change : safeStringify(m.change);
            return (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">{metricStr}</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{valueStr}</div>
                {changeStr && (
                  <div className={`text-sm mt-1 ${changeStr.startsWith("+") ? "text-emerald-600" : changeStr.startsWith("-") ? "text-red-600" : "text-slate-500"}`}>
                    {changeStr}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Guidance */}
      {(guidance.revenueGuidance || guidance.marginGuidance) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <h3 className="font-semibold text-slate-900 mb-3">Forward Guidance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guidance.revenueGuidance && (
              <div>
                <div className="text-sm text-slate-500">Revenue Outlook</div>
                <div className="font-medium text-slate-900">
                  <RenderValue value={guidance.revenueGuidance} />
                </div>
              </div>
            )}
            {guidance.marginGuidance && (
              <div>
                <div className="text-sm text-slate-500">Margin Outlook</div>
                <div className="font-medium text-slate-900">
                  <RenderValue value={guidance.marginGuidance} />
                </div>
              </div>
            )}
          </div>
          {guidance.keyInitiatives && guidance.keyInitiatives.length > 0 && (
            <div className="mt-3">
              <div className="text-sm text-slate-500 mb-1">Key Initiatives</div>
              <div className="flex flex-wrap gap-2">
                {guidance.keyInitiatives.map((init: any, i: number) => (
                  <span key={i} className="px-2 py-1 bg-white text-sm text-blue-700 rounded-lg">
                    {typeof init === "string" ? init : safeStringify(init)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activities.map((act: any, i: number) => {
              const typeStr = typeof act.type === "string" ? act.type : safeStringify(act.type);
              const descStr = typeof act.description === "string" ? act.description : safeStringify(act.description);
              const valueStr = typeof act.value === "string" ? act.value : safeStringify(act.value);
              const dateStr = typeof act.date === "string" ? act.date : safeStringify(act.date);
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className={`px-2 py-1 text-xs font-medium rounded ${
                    typeStr === "acquisition" ? "bg-purple-100 text-purple-700" :
                    typeStr === "divestiture" ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {typeStr}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-700">{descStr}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {valueStr && <span className="font-medium text-slate-700">{valueStr}</span>}
                      {dateStr && <span>{dateStr}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sources</h4>
          <div className="flex flex-wrap gap-2">
            {sources.map((source: string, i: number) => (
              <a
                key={i}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {Icon.externalLink}
                <span className="truncate max-w-xs">{source.includes("://") ? new URL(source).hostname : source}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============= RENDER VALUE HELPER =============
function RenderValue({ value, className = "" }: { value: any; className?: string }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className={className}>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className={`list-disc list-inside space-y-1 ${className}`}>
        {value.map((item, i) => (
          <li key={i}><RenderValue value={item} /></li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={`space-y-2 ${className}`}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <span className="font-medium text-slate-700 capitalize">{k.replace(/_/g, " ")}: </span>
            <RenderValue value={v} className="text-slate-600" />
          </div>
        ))}
      </div>
    );
  }
  return <span className={className}>{String(value)}</span>;
}

// ============= MARKETING DATA RENDERER =============
function MarketingDataView({ data }: { data: any }) {
  const d = data[0] || data;
  
  return (
    <div className="space-y-6">
      {(d.messaging || d.positioning) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {d.messaging && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                {Icon.megaphone}
                <h3 className="font-semibold text-slate-900">Core Messaging</h3>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed">
                <RenderValue value={d.messaging} />
              </div>
            </div>
          )}
          {d.positioning && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                {Icon.target}
                <h3 className="font-semibold text-slate-900">Market Positioning</h3>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed">
                <RenderValue value={d.positioning} />
              </div>
            </div>
          )}
        </div>
      )}

      {d.targetAudience && d.targetAudience.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            {Icon.users}
            <h3 className="font-semibold text-slate-900">Target Audience</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.targetAudience.map((audience: any, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-lg">
                {typeof audience === "string" ? audience : safeStringify(audience)}
              </span>
            ))}
          </div>
        </div>
      )}

      {d.channels && d.channels.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Sales Channels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {d.channels.map((ch: any, i: number) => (
              <div key={i} className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-1">
                  <RenderValue value={typeof ch === "string" ? ch : ch.channel || ch.name} />
                </h4>
                {ch.strategy && (
                  <div className="text-sm text-slate-600"><RenderValue value={ch.strategy} /></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {d.recentCampaigns && d.recentCampaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Campaigns</h3>
          <div className="space-y-3">
            {d.recentCampaigns.map((campaign: any, i: number) => (
              <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-slate-800">
                    <RenderValue value={typeof campaign === "string" ? campaign : campaign.campaign || campaign.name} />
                  </h4>
                  {campaign.date && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      <RenderValue value={campaign.date} />
                    </span>
                  )}
                </div>
                {campaign.description && (
                  <div className="text-sm text-slate-600 mt-1"><RenderValue value={campaign.description} /></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {d.pricingStrategy && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            {Icon.dollar}
            <h3 className="font-semibold text-slate-900">Pricing Strategy</h3>
          </div>
          <div className="text-sm text-slate-600 leading-relaxed">
            <RenderValue value={d.pricingStrategy} />
          </div>
        </div>
      )}

      {d.sources && d.sources.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sources</h4>
          <div className="flex flex-wrap gap-2">
            {d.sources.map((source: string, i: number) => (
              <a
                key={i}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {Icon.externalLink}
                <span className="truncate max-w-xs">{new URL(source).hostname}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============= SECTION MODAL COMPONENT =============
function SectionModal({ 
  isOpen, 
  onClose, 
  section, 
  allSections,
  citations 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  section: { title: string; content: string; excerpt: string } | null;
  allSections: { title: string; content: string; excerpt: string }[];
  citations?: string[];
}) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  
  useEffect(() => {
    if (section && allSections.length > 0) {
      const idx = allSections.findIndex(s => s.title === section.title);
      if (idx >= 0) setCurrentSectionIndex(idx);
    }
  }, [section, allSections]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, onClose]);

  if (!isOpen || !section) return null;
  
  const currentSection = allSections[currentSectionIndex] || section;
  const hasPrev = currentSectionIndex > 0;
  const hasNext = currentSectionIndex < allSections.length - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider">Research Section</p>
                    <h2 className="text-lg font-semibold text-white">{currentSection.title}</h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Section Navigation Pills */}
              {allSections.length > 1 && (
                <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                  {allSections.map((s, idx) => (
                    <button
                      key={`modal-nav-${idx}`}
                      onClick={() => setCurrentSectionIndex(idx)}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        idx === currentSectionIndex 
                          ? "bg-white text-slate-900" 
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-120px)] p-6">
              <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-strong:text-slate-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50/60 prose-blockquote:text-slate-600 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-table:w-full prose-table:text-sm prose-th:bg-slate-50 prose-th:text-slate-700 prose-th:font-semibold prose-th:p-2 prose-td:p-2 prose-td:border prose-th:border">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentSection.content}
                </ReactMarkdown>
              </div>
              
              {/* Citations in modal */}
              {citations && citations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {citations.slice(0, 6).map((citation: string, idx: number) => (
                      <a
                        key={`modal-cite-${idx}`}
                        href={citation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        <span>[{idx + 1}]</span>
                        <span>{new URL(citation).hostname}</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <button
                onClick={() => hasPrev && setCurrentSectionIndex(currentSectionIndex - 1)}
                disabled={!hasPrev}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasPrev 
                    ? "text-slate-700 hover:bg-slate-200" 
                    : "text-slate-300 cursor-not-allowed"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <span className="text-xs text-slate-500">
                {currentSectionIndex + 1} of {allSections.length}
              </span>
              <button
                onClick={() => hasNext && setCurrentSectionIndex(currentSectionIndex + 1)}
                disabled={!hasNext}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasNext 
                    ? "text-slate-700 hover:bg-slate-200" 
                    : "text-slate-300 cursor-not-allowed"
                }`}
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============= RESEARCH ITEM CARD WITH IMAGE =============
function ResearchItemCard({ item }: { item: any }) {
  const rawTitle = item.title || item.trend || item.initiative || item.regulation || 
                item.activity || item.finding || item.product || item.name || item.campaign;
  const rawDescription = item.description || item.rationale || item.impact || 
                      item.details || item.summary || item.overview;
  
  // Safely convert to strings
  const title = safeStringify(rawTitle);
  const description = safeStringify(rawDescription);
  const sourceUrl = item.source || "";
  const isMarkdown = item.isMarkdown || (typeof rawDescription === "object");
  // Extract image URLs - handle both string arrays and object arrays
  const imageUrls = Array.isArray(item.images) 
    ? item.images.map((img: any) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object') return img.image_url || img.url || img.src || '';
        return '';
      }).filter((url: string) => url && url.startsWith('http'))
    : [];
  const sections = useMemo(() => extractMarkdownSections(description), [description]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<{ title: string; content: string; excerpt: string } | null>(null);
  
  const handleSectionClick = (section: { title: string; content: string; excerpt: string }) => {
    setSelectedSection(section);
    setModalOpen(true);
  };

  // If this is markdown content, render with ReactMarkdown
  if (isMarkdown && description) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-slate-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Canada Focus</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1">{title}</h3>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            Verified sources
          </span>
        </div>
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {imageUrls.slice(0, 4).map((imageUrl: string, idx: number) => (
              <div key={`img-${idx}`} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img
                  src={imageUrl}
                  alt={`Visual ${idx + 1}`}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLElement).parentElement!.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        )}
        {/* Summary Section Boxes - Click to open modal */}
        {sections.length > 1 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em] mb-3">Summary</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sections.map((section, idx) => (
                <button
                  key={`section-btn-${idx}`}
                  onClick={() => handleSectionClick(section)}
                  className="group text-left rounded-xl border border-slate-200 px-4 py-3 transition-all hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">{section.title}</div>
                      <div className="text-xs text-slate-500 line-clamp-2">{section.excerpt}</div>
                    </div>
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Section Modal */}
        <SectionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          section={selectedSection}
          allSections={sections}
          citations={item.citations}
        />
        
        {/* Full Report - Always visible */}
        <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-semibold prose-h1:text-2xl prose-h1:mt-6 prose-h1:mb-3 prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-strong:text-slate-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50/60 prose-blockquote:text-slate-600 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:px-4 prose-pre:py-3 prose-code:text-slate-900 prose-table:w-full prose-table:text-sm prose-th:bg-slate-50 prose-th:text-slate-700 prose-th:font-semibold prose-th:p-2 prose-td:p-2 prose-td:border prose-th:border">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {description}
          </ReactMarkdown>
        </div>
        {item.citations && item.citations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {item.citations.slice(0, 5).map((citation: string, idx: number) => (
                <a
                  key={idx}
                  href={citation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  [{idx + 1}] {new URL(citation).hostname}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span>Powered by Perplexity AI</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        {/* Article thumbnail */}
        {sourceUrl && sourceUrl.startsWith("http") && (
          <ArticleThumbnail url={sourceUrl} title={title} />
        )}
        
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
          )}
          
          {description && (
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{description}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {item.importance && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                item.importance === "high" ? "bg-red-100 text-red-700" :
                item.importance === "medium" ? "bg-amber-100 text-amber-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {item.importance}
              </span>
            )}
            {item.type && (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                {item.type}
              </span>
            )}
            {item.category && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-600">
                {item.category}
              </span>
            )}
            {(item.date || item.timeline) && (
              <span className="text-xs text-slate-400">
                {item.date || item.timeline}
              </span>
            )}
          </div>

          {item.parties && item.parties.length > 0 && (
            <div className="text-sm text-slate-600 mb-3">
              <span className="font-medium">Parties:</span> {item.parties.join(", ")}
            </div>
          )}

          {item.leaders && item.leaders.length > 0 && (
            <div className="text-sm text-slate-600 mb-3">
              <span className="font-medium">Leaders:</span> {item.leaders.join(", ")}
            </div>
          )}

          {sourceUrl && (
            <a
              href={sourceUrl.startsWith("http") ? sourceUrl : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 pt-3 border-t border-slate-100"
            >
              {Icon.externalLink}
              <span className="truncate">{sourceUrl.startsWith("http") ? new URL(sourceUrl).hostname : sourceUrl}</span>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ImportanceBadge({ level }: { level: IntelligenceUpdate["importance"] }) {
  const styles = {
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  } as const;
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[level]}`}>
      {level} priority
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  if (!category) return null;
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
      {category.replace(/_/g, " ")}
    </span>
  );
}

function UpdateCard({ update, compact = false }: { update: IntelligenceUpdate; compact?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 ${compact ? "p-4" : "p-6"} hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-4">
        {update.competitor?.name ? (
          <CompanyLogo name={update.competitor.name} logoUrl={update.competitor.logoUrl} size={compact ? "sm" : "md"} />
        ) : (
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
            {Icon.bell}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`${compact ? "text-sm" : "text-base"} font-semibold text-slate-900`}>
                {update.title}
              </h3>
              {update.competitor?.name && (
                <p className="text-xs text-slate-500 mt-0.5">{update.competitor.name}</p>
              )}
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeTime(update.dateDiscovered)}</div>
          </div>
          <div className={`${compact ? "mt-2 text-sm" : "mt-3 text-sm"} text-slate-600 leading-relaxed`}>
            <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50/60 prose-blockquote:text-slate-600 prose-table:w-full prose-table:text-sm prose-th:bg-slate-50 prose-th:text-slate-700 prose-th:font-semibold prose-th:p-2 prose-td:p-2 prose-td:border prose-th:border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {safeStringify(update.description)}
              </ReactMarkdown>
            </div>
          </div>
          <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : "mt-4"}`}>
            <ImportanceBadge level={update.importance} />
            <CategoryBadge category={update.category} />
            {update.source && (
              <a
                href={update.source.startsWith("http") ? update.source : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {Icon.externalLink}
                <span className="truncate max-w-xs">{update.source.startsWith("http") ? new URL(update.source).hostname : update.source}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= COMPETITOR CARD =============
function CompetitorCard({
  competitor,
  onClick,
}: {
  competitor: Competitor;
  onClick: () => void;
}) {
  const typeColors = {
    local: { bg: "bg-green-100", text: "text-green-700", label: "Local" },
    regional: { bg: "bg-blue-100", text: "text-blue-700", label: "Regional" },
    national: { bg: "bg-purple-100", text: "text-purple-700", label: "National" },
  };
  const typeStyle = competitor.type ? typeColors[competitor.type] : typeColors.local;

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-200 p-6 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-4">
        <CompanyLogo name={competitor.name} logoUrl={competitor.logoUrl} size="lg" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-900 text-lg truncate">{competitor.name}</h3>
            {competitor.isActive && <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />}
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
              {typeStyle.label}
            </span>
            {competitor.estimatedMarketShare > 0 && (
              <span className="text-xs text-slate-500">{competitor.estimatedMarketShare}% market share</span>
            )}
          </div>
          
          <p className="text-sm text-slate-500 truncate">
            {competitor.territory?.slice(0, 3).join(", ") || "Click to research"}
          </p>
        </div>
        
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </motion.div>
  );
}

// ============= COMPETITOR DETAIL VIEW =============
function CompetitorDetailView({
  competitor,
  onBack,
}: {
  competitor: Competitor;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ResearchCategory>("product_strategy");
  const [researchData, setResearchData] = useState<Record<ResearchCategory, ResearchData>>({} as any);
  const hasStartedResearch = useRef(false);

  useEffect(() => {
    if (!hasStartedResearch.current) {
      hasStartedResearch.current = true;
      runAllResearch();
    }
  }, []);

  const runAllResearch = async () => {
    const initialState: Record<ResearchCategory, ResearchData> = {} as any;
    RESEARCH_TABS.forEach(tab => {
      initialState[tab.id] = { category: tab.id, loading: true, data: [] };
    });
    setResearchData(initialState);
    await Promise.all(RESEARCH_TABS.map((tab) => runResearchForCategory(tab.id)));
  };

  const runResearchForCategory = async (category: ResearchCategory) => {
    const prompt = RESEARCH_PROMPTS.find(p => p.id === category);
    if (!prompt) return;

    setResearchData(prev => ({
      ...prev,
      [category]: { ...prev[category], loading: true, error: undefined },
    }));

    try {
      const filledPrompt = fillTemplate(prompt.template, {
        COMPETITOR_NAME: competitor.name,
        COMPANY_NAME: competitor.name,
      });

      const response = await fetch("/api/intelligence-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: filledPrompt }],
          return_images: true,
          image_format_filter: ["png", "jpeg", "webp", "gif"],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // New API returns content directly
        const content = data.content || "";
        const isMarkdown = data.isMarkdown;
        const citations = data.citations || [];
        const images = data.images || [];
        
        let parsedData: any[] = [];
        let noDataFound = false;
        
        if (isMarkdown || !content.startsWith('{')) {
          // Content is markdown - store as a single research result
          parsedData = [{
            title: prompt.name,
            description: content,
            source: "Perplexity AI",
            isMarkdown: true,
            citations: citations,
            images: images,
          }];
        } else {
          // Try to parse as JSON
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
              
              if (parsed && typeof parsed === 'object' && 'noDataFound' in parsed && parsed.noDataFound === true) {
                noDataFound = true;
                parsedData = [];
              } else if (Array.isArray(parsed)) {
                parsedData = parsed.map((item: Record<string, unknown>) => ({ ...item, images }));
              } else if (parsed && typeof parsed === 'object' && (parsed.findings || parsed.activities || parsed.regulations || 
                         parsed.trends || parsed.gaps || parsed.techPriorities)) {
                const dataArray = (parsed.findings || parsed.activities || parsed.regulations ||
                            parsed.trends || parsed.gaps || parsed.techPriorities || []) as Record<string, unknown>[];
                parsedData = dataArray.length > 0 ? dataArray.map((item) => ({ ...item, images })) : [];
              } else if (parsed && typeof parsed === 'object') {
                parsedData = [{ ...parsed, images }];
              }
            }
          } catch {
            // JSON parsing failed - treat as markdown
            parsedData = [{
              title: prompt.name,
              description: content,
              source: "Perplexity AI",
              isMarkdown: true,
              citations: citations,
              images: images,
            }];
          }
        }

        setResearchData(prev => ({
          ...prev,
          [category]: { 
            category, 
            loading: false, 
            data: parsedData,
            lastUpdated: new Date(),
            noDataFound,
          },
        }));
      } else {
        throw new Error("API request failed");
      }
    } catch (error) {
      setResearchData(prev => ({
        ...prev,
        [category]: { 
          category, 
          loading: false, 
          error: "Failed to load data",
          data: [],
        },
      }));
    }
  };

  const currentTabData = researchData[activeTab] || { loading: true, data: [] };
  const loadingCount = Object.values(researchData).filter(d => d.loading).length;

  const isMarketingData = activeTab === "sales_marketing" && 
    currentTabData.data.length === 1 && 
    (currentTabData.data[0].messaging || currentTabData.data[0].channels || currentTabData.data[0].targetAudience);

  const isFinancialData = activeTab === "financial_performance" && 
    currentTabData.data.length === 1 && 
    (currentTabData.data[0].financials || currentTabData.data[0].segmentBreakdown || currentTabData.data[0].quarterlyTrend);

  const isMarkdownReport = currentTabData.data.length === 1 && Boolean(currentTabData.data[0]?.isMarkdown);

  const citationLinks = currentTabData.data
    .flatMap((item: any) => {
      if (Array.isArray(item?.citations)) return item.citations;
      if (Array.isArray(item?.sources)) return item.sources;
      if (item?.source) return [item.source];
      return [];
    })
    .filter((link: any) => typeof link === "string" && link.trim().length > 0);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {Icon.arrowLeft}
          </button>
          
          <CompanyLogo name={competitor.name} logoUrl={competitor.logoUrl} size="md" />
          
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">{competitor.name}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {competitor.estimatedMarketShare > 0 && (
                <span>{competitor.estimatedMarketShare}% market share</span>
              )}
              {competitor.pricingPositioning && (
                <span className="capitalize">{competitor.pricingPositioning} Pricing</span>
              )}
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Canada focus
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {loadingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Loading {loadingCount} of {RESEARCH_TABS.length}...
              </div>
            )}
            {loadingCount === 0 && (
              <button
                onClick={runAllResearch}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {Icon.refresh}
                Refresh All
              </button>
            )}
          </div>
        </div>

      </div>

      <div className="flex-1 overflow-hidden bg-slate-50">
        <div className="h-full flex">
          <aside className="w-64 border-r border-slate-200 bg-white">
            <div className="px-4 py-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Agents</p>
                <h2 className="text-sm font-semibold text-slate-900 mt-2">Research Streams</h2>
              </div>
              <div className="space-y-1">
                {RESEARCH_TABS.map(tab => {
                  const tabData = researchData[tab.id];
                  const isLoading = tabData?.loading;
                  const hasData = tabData?.data?.length > 0;
                  const hasError = tabData?.error;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                        activeTab === tab.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          tab.icon
                        )}
                        {tab.name}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        {hasData && !isLoading && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeTab === tab.id ? "bg-white/20" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {tabData.data.length}
                          </span>
                        )}
                        {hasError && !isLoading && (
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                Agents run in parallel using Sonar Reasoning Pro and prioritize Canada-first signals.
              </div>
            </div>
          </aside>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
          {currentTabData.loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Researching {RESEARCH_TABS.find(t => t.id === activeTab)?.name}...</p>
              <p className="text-sm text-slate-400 mt-1">Using Perplexity AI</p>
            </div>
          ) : currentTabData.error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                {Icon.x}
              </div>
              <p className="text-slate-600 font-medium">Failed to load data</p>
              <button
                onClick={() => runResearchForCategory(activeTab)}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : currentTabData.data.length === 0 || currentTabData.noDataFound ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-700 font-semibold mb-1">No specific data found for {competitor.name}</p>
              <p className="text-slate-500 text-sm text-center max-w-md mb-4">
                We couldn't find {RESEARCH_TABS.find(t => t.id === activeTab)?.name.toLowerCase()} information specifically about this company. 
                This could be because they're a smaller local business with limited public information.
              </p>
              <button
                onClick={() => runResearchForCategory(activeTab)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Try Research Again
              </button>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6">
              <div className="space-y-4">
                {currentTabData.lastUpdated && (
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Last updated: {currentTabData.lastUpdated.toLocaleString()}</span>
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-slate-200">
                      {Icon.sparkles}
                      Canada-focused output
                    </span>
                  </div>
                )}

                {isFinancialData ? (
                  <FinancialDashboard data={currentTabData.data} />
                ) : isMarketingData ? (
                  <MarketingDataView data={currentTabData.data} />
                ) : isMarkdownReport ? (
                  <div className="max-w-4xl">
                    <ResearchItemCard item={currentTabData.data[0]} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {currentTabData.data.map((item, idx) => (
                      <ResearchItemCard key={idx} item={item} />
                    ))}
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Research Coverage</h3>
                  <div className="space-y-2">
                    {RESEARCH_TABS.map((tab) => {
                      const tabData = researchData[tab.id];
                      const isLoading = tabData?.loading;
                      const hasError = tabData?.error;
                      const count = tabData?.data?.length || 0;
                      return (
                        <div key={tab.id} className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${tab.id === activeTab ? "text-slate-900" : "text-slate-500"}`}>
                            {tab.name}
                          </span>
                          {isLoading ? (
                            <span className="text-blue-600">Loading</span>
                          ) : hasError ? (
                            <span className="text-red-600">Error</span>
                          ) : (
                            <span className="text-emerald-600">{count} items</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Sources</h3>
                  {citationLinks.length === 0 ? (
                    <p className="text-xs text-slate-500">No sources available yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {citationLinks.slice(0, 6).map((link, idx) => (
                        <a
                          key={`${link}-${idx}`}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline block truncate"
                        >
                          [{idx + 1}] {link.includes("://") ? new URL(link).hostname : link}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= ADD COMPETITOR MODAL =============
function AddCompetitorModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (competitor: Partial<Competitor>) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<"local" | "regional" | "national">("local");
  const [isResearching, setIsResearching] = useState(false);

  const handleCreate = async () => {
    if (!companyName.trim()) return;
    setIsResearching(true);
    
    try {
      const response = await fetch("/api/c1-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Briefly research "${companyName}" in HVAC. Return ONLY JSON:
{"territory":["region1"],"estimatedMarketShare":5,"pricingPositioning":"mid-market","isActive":true}`,
          }],
        }),
      });

      let parsedData: any = {};
      if (response.ok) {
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "";
        
        // Strip out <think> tags from sonar-reasoning-pro responses
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse competitor data:", e);
        }
      }

      // Get logo URL
      const logoUrl = getCompanyLogo(companyName);

      onAdd({
        name: companyName,
        type: companyType,
        logoUrl: logoUrl || undefined,
        territory: parsedData.territory || ["Unknown"],
        estimatedMarketShare: parseFloat(parsedData.estimatedMarketShare) || 0,
        pricingPositioning: parsedData.pricingPositioning || "unknown",
        isActive: parsedData.isActive ?? true,
      });
    } catch {
      onAdd({ name: companyName, type: companyType, territory: ["Unknown"], estimatedMarketShare: 0, isActive: true });
    } finally {
      setIsResearching(false);
      setCompanyName("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add Competitor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">{Icon.close}</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <div className="flex gap-2">
              {(["local", "regional", "national"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCompanyType(type)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                    companyType === type
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!companyName.trim() || isResearching}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isResearching ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
              ) : (
                "Add Competitor"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============= MAIN COMPONENT =============
export default function CompetitiveIntelligence() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [updates, setUpdates] = useState<IntelligenceUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeView, setActiveView] = useState<IntelligenceView>("overview");
  const [competitorSearch, setCompetitorSearch] = useState("");
  const [updateSearch, setUpdateSearch] = useState("");
  const [updateImportance, setUpdateImportance] = useState<"all" | "high" | "medium" | "low">("all");
  const [updateCategory, setUpdateCategory] = useState("all");

  useEffect(() => {
    loadCompetitors();
    loadUpdates();
  }, []);

  const loadCompetitors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/intelligence/competitors");
      if (res.ok) setCompetitors(await res.json());
    } catch (error) {
      console.error("Error loading competitors:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUpdates = async () => {
    setUpdatesLoading(true);
    try {
      const res = await fetch("/api/intelligence/updates");
      if (res.ok) setUpdates(await res.json());
    } catch (error) {
      console.error("Error loading updates:", error);
    } finally {
      setUpdatesLoading(false);
    }
  };

  const handleAddCompetitor = async (competitor: Partial<Competitor>) => {
    try {
      const res = await fetch("/api/intelligence/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(competitor),
      });
      if (res.ok) {
        const newCompetitor = await res.json();
        setCompetitors(prev => [...prev, newCompetitor]);
      }
    } catch (error) {
      console.error("Error adding competitor:", error);
    }
  };

  const handleQuickAdd = async (name: string, type: "local" | "regional" | "national") => {
    const logoUrl = getCompanyLogo(name);
    handleAddCompetitor({ name, type, logoUrl: logoUrl || undefined, territory: ["Unknown"], estimatedMarketShare: 0, isActive: true });
  };

  if (selectedCompetitor) {
    return (
      <CompetitorDetailView
        competitor={selectedCompetitor}
        onBack={() => setSelectedCompetitor(null)}
      />
    );
  }

  const availableDefaults = DEFAULT_COMPETITORS.filter(
    (c) => !competitors.some((existing) => existing.name.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]))
  );

  const filteredCompetitors = competitors.filter((competitor) => {
    const query = competitorSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      competitor.name.toLowerCase().includes(query) ||
      competitor.territory?.some((t) => t.toLowerCase().includes(query))
    );
  });

  const filteredUpdates = updates.filter((update) => {
    if (updateImportance !== "all" && update.importance !== updateImportance) return false;
    if (updateCategory !== "all" && update.category !== updateCategory) return false;
    const query = updateSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      update.title.toLowerCase().includes(query) ||
      update.description.toLowerCase().includes(query) ||
      update.competitor?.name?.toLowerCase().includes(query)
    );
  });

  const updateCategories = Array.from(new Set(updates.map((u) => u.category).filter(Boolean)));
  const highPriorityCount = updates.filter((u) => u.importance === "high").length;
  const activeCompetitors = competitors.filter((c) => c.isActive).length;
  const updatesLast30Days = updates.filter((u) => {
    const date = new Date(u.dateDiscovered);
    if (Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() < 1000 * 60 * 60 * 24 * 30;
  }).length;
  const competitorsWithUpdates = new Set(updates.map((u) => u.competitorId)).size;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Intelligence</p>
              <h1 className="text-3xl font-semibold text-slate-900 mt-2">Competitive Intelligence Hub</h1>
              <p className="text-slate-500 mt-2">
                Centralize competitor profiles, market signals, and research outputs in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 text-xs text-slate-500 bg-slate-50">
                {Icon.sparkles}
                Perplexity Sonar Pro
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                {Icon.plus}
                Add Competitor
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            {([
              { id: "overview", label: "Overview" },
              { id: "competitors", label: "Competitors" },
              { id: "updates", label: "Intel Feed" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === tab.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {activeView === "overview" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500">Active Competitors</div>
                <div className="text-2xl font-semibold text-slate-900 mt-2">{activeCompetitors}</div>
                <div className="text-xs text-slate-400 mt-2">Tracked profiles</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500">Intel Updates (30d)</div>
                <div className="text-2xl font-semibold text-slate-900 mt-2">{updatesLast30Days}</div>
                <div className="text-xs text-slate-400 mt-2">Recent signals</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500">High Priority</div>
                <div className="text-2xl font-semibold text-slate-900 mt-2">{highPriorityCount}</div>
                <div className="text-xs text-slate-400 mt-2">Needs action</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500">Coverage</div>
                <div className="text-2xl font-semibold text-slate-900 mt-2">{competitorsWithUpdates}</div>
                <div className="text-xs text-slate-400 mt-2">Competitors with intel</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Latest Signals</h2>
                  <button
                    onClick={() => setActiveView("updates")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                </div>
                {updatesLoading ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-3 animate-pulse" />
                    <div className="h-3 bg-slate-200 rounded w-full mb-2 animate-pulse" />
                    <div className="h-3 bg-slate-200 rounded w-5/6 animate-pulse" />
                  </div>
                ) : updates.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                    No intelligence updates yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {updates.slice(0, 4).map((update) => (
                      <UpdateCard key={update.id} update={update} compact />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Top Competitors</h2>
                  <button
                    onClick={() => setActiveView("competitors")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  {competitors.slice(0, 4).map((competitor) => (
                    <button
                      key={competitor.id}
                      onClick={() => setSelectedCompetitor(competitor)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <CompanyLogo name={competitor.name} logoUrl={competitor.logoUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{competitor.name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {competitor.territory?.slice(0, 2).join(", ") || "No territory yet"}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{formatShortDate(competitor.updatedAt)}</span>
                    </button>
                  ))}
                  {competitors.length === 0 && (
                    <div className="text-sm text-slate-500 text-center py-6">Add competitors to get started.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeView === "competitors" && (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Competitor Profiles</h2>
                <p className="text-sm text-slate-500 mt-1">Click any profile to open the intelligence workspace.</p>
              </div>
              <div className="relative">
                <input
                  value={competitorSearch}
                  onChange={(e) => setCompetitorSearch(e.target.value)}
                  placeholder="Search competitors or territories..."
                  className="w-full lg:w-80 px-4 py-2.5 pl-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {Icon.search}
                </div>
              </div>
            </div>

            {availableDefaults.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-blue-600">{Icon.lightning}</span>
                  <span className="font-semibold text-slate-800">Quick Add Competitors</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableDefaults.slice(0, 8).map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleQuickAdd(c.name, c.type as any)}
                      className="px-4 py-2 text-sm font-medium bg-white border border-blue-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-colors text-slate-700"
                    >
                      + {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-slate-200 rounded-xl" />
                      <div className="flex-1">
                        <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
                        <div className="h-3 bg-slate-200 rounded w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCompetitors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                  {Icon.building}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">No competitors yet</h2>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                  Add your first competitor to start tracking their products, marketing, financials, and more.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Add Your First Competitor
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompetitors.map((competitor) => (
                  <CompetitorCard
                    key={competitor.id}
                    competitor={competitor}
                    onClick={() => setSelectedCompetitor(competitor)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === "updates" && (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Intel Feed</h2>
                <p className="text-sm text-slate-500 mt-1">Latest competitor signals and market movements.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <input
                    value={updateSearch}
                    onChange={(e) => setUpdateSearch(e.target.value)}
                    placeholder="Search updates..."
                    className="w-full lg:w-72 px-4 py-2.5 pl-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {Icon.search}
                  </div>
                </div>
                <select
                  value={updateImportance}
                  onChange={(e) => setUpdateImportance(e.target.value as any)}
                  className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600"
                >
                  <option value="all">All priorities</option>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
                <select
                  value={updateCategory}
                  onChange={(e) => setUpdateCategory(e.target.value)}
                  className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600"
                >
                  <option value="all">All categories</option>
                  {updateCategories.map((category) => (
                    <option key={category} value={category}>
                      {category.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {updatesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
                    <div className="h-3 bg-slate-200 rounded w-full mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-5/6" />
                  </div>
                ))}
              </div>
            ) : filteredUpdates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
                No intelligence updates match those filters.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUpdates.map((update) => (
                  <UpdateCard key={update.id} update={update} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AddCompetitorModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCompetitor}
      />
    </div>
  );
}
