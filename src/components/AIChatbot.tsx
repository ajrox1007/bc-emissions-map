"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpc } from "@/lib/trpc";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, AlignmentType, TableCell, TableRow, Table, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// Chart data interface
interface ChartData {
  type: "bar" | "pie" | "line" | "area";
  title: string;
  subtitle?: string;
  data: Record<string, any>[];
  xKey?: string;
  yKey?: string;
  series?: string[];
  colors?: string[];
}

// Default chart colors
const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

// Chart renderer component - using Recharts with hex colors for html2canvas compatibility
const ChartRenderer = React.memo(({ chartData }: { chartData: ChartData }) => {
  const colors = chartData.colors || CHART_COLORS;
  
  // Format large numbers for Y axis
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  // Custom tooltip with hex colors (no CSS variables)
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '8px 12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ fontWeight: 600, marginBottom: '4px', color: '#111827' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
              <span style={{ color: '#6b7280', fontSize: '12px' }}>{entry.name}:</span>
              <span style={{ fontWeight: 500, color: '#111827', fontSize: '12px' }}>
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom legend with hex colors
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', paddingTop: '8px', flexWrap: 'wrap' }}>
        {payload?.map((entry: any, index: number) => (
          <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: entry.color }} />
            <span style={{ fontSize: '12px', color: '#374151' }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    switch (chartData.type) {
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={chartData.data}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey={chartData.yKey || "value"}
                nameKey={chartData.xKey || "name"}
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                isAnimationActive={false}
              >
                {chartData.data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || colors[index % colors.length]}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart 
              data={chartData.data} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey={chartData.xKey || "name"} 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickMargin={8}
              />
              <YAxis 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickFormatter={formatYAxis}
                width={60}
                tickMargin={8}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
              {chartData.series ? (
                chartData.series.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ fill: colors[index % colors.length], r: 4 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={chartData.yKey || "value"}
                  name={chartData.yKey || "Value"}
                  stroke={colors[0]}
                  strokeWidth={2}
                  dot={{ fill: colors[0], r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart 
              data={chartData.data} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <defs>
                {(chartData.series || [chartData.yKey || "value"]).map((key, index) => (
                  <linearGradient key={`gradient-${key}`} id={`fill-${key}-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.6}/>
                    <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey={chartData.xKey || "name"} 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickMargin={8}
              />
              <YAxis 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickFormatter={formatYAxis}
                width={60}
                tickMargin={8}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
              {chartData.series ? (
                chartData.series.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={colors[index % colors.length]}
                    fill={`url(#fill-${key}-${index})`}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey={chartData.yKey || "value"}
                  name={chartData.yKey || "Value"}
                  stroke={colors[0]}
                  fill={`url(#fill-${chartData.yKey || "value"}-0)`}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "bar":
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={chartData.data} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey={chartData.xKey || "name"} 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickMargin={8}
              />
              <YAxis 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickFormatter={formatYAxis}
                width={60}
                tickMargin={8}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Legend content={renderLegend} />
              {chartData.series ? (
                chartData.series.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key}
                    fill={colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                ))
              ) : (
                <Bar
                  dataKey={chartData.yKey || "value"}
                  name={chartData.yKey || "Value"}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || colors[index % colors.length]}
                    />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div 
      className="my-5 rounded-xl border bg-white shadow-sm" 
      data-chart-container="true"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="p-4 border-b border-gray-100">
        <h4 className="text-base font-semibold text-gray-900">{chartData.title}</h4>
        {chartData.subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{chartData.subtitle}</p>
        )}
      </div>
      <div className="p-4 overflow-x-auto">
        {renderChart()}
      </div>
    </div>
  );
});

// Metrics data interface
interface MetricsData {
  metrics: {
    label: string;
    value: string | number;
    change?: string;
    changeType?: "positive" | "negative" | "neutral";
    icon?: string;
  }[];
}

// Metrics card component for key statistics - memoized to prevent re-renders
const MetricsRenderer = React.memo(({ metricsData }: { metricsData: MetricsData }) => {
  const getChangeColor = (type?: string) => {
    switch (type) {
      case "positive": return "text-emerald-600 bg-emerald-50";
      case "negative": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case "currency":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "chart":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case "users":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case "building":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
    }
  };

  return (
    <div className="my-5 grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricsData.metrics.map((metric, index) => (
        <div 
          key={index}
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {metric.label}
            </span>
            <span className="text-emerald-500">
              {getIcon(metric.icon)}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metric.value}
          </div>
          {metric.change && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getChangeColor(metric.changeType)}`}>
              {metric.change}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: UploadedFile[];
  thinking?: string;
  researchMode?: boolean;
  citations?: APACitation[];
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content: string; // Base64 or text content
}

interface Citation {
  url: string;
  title?: string;
}

interface APACitation {
  number: number;
  url: string;
  title?: string;
  author?: string;
  date?: string;
  siteName?: string;
}

// Available models from Perplexity API
const AVAILABLE_MODELS = [
  // Agentic Research API Models (GPT-5.x via /v1/responses)
  { id: "openai/gpt-5.2", name: "GPT-5.2", provider: "OpenAI", tier: "premium", description: "Most capable reasoning model" },
  { id: "openai/gpt-5.1", name: "GPT-5.1", provider: "OpenAI", tier: "premium", description: "Previous generation GPT" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "OpenAI", tier: "standard", description: "Fast, lightweight model" },
  // Anthropic Models
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", tier: "premium", description: "Most capable Claude" },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", tier: "standard", description: "Fast Claude variant" },
  // Google Gemini Models
  { id: "google/gemini-3-pro", name: "Gemini 3 Pro", provider: "Google", tier: "premium", description: "Latest Gemini flagship model" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", tier: "standard", description: "Fast, efficient Gemini" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", tier: "standard", description: "Previous Gemini reasoning" },
  // Perplexity Native Models (via /chat/completions)
  { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", provider: "Perplexity", tier: "premium", description: "Deep reasoning + web search" },
  { id: "sonar-pro", name: "Sonar Pro", provider: "Perplexity", tier: "standard", description: "Enhanced web search" },
  { id: "sonar", name: "Sonar", provider: "Perplexity", tier: "basic", description: "Fast web search" },
];

const QUICK_PROMPTS = [
  "What are the top 5 communities by emissions?",
  "Show me all LNG projects over $1B",
  "Which areas have the highest fossil fuel usage?",
  "Generate a market opportunity report for Vancouver",
  "Compare residential vs commercial emissions across BC",
];

// Supported file types
const SUPPORTED_FILE_TYPES = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/json": ".json",
  "text/markdown": ".md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Simulated thinking steps when no real thinking is available
const FALLBACK_THINKING_STEPS = [
  "Analyzing your question and context...",
  "Searching for relevant information...",
  "Processing data and findings...",
  "Formulating response...",
];

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedModel, setSelectedModel] = useState("sonar-pro");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string>("");
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceResponse, setVoiceResponse] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceUserText, setVoiceUserText] = useState("");
  const [emailingIndex, setEmailingIndex] = useState<number | null>(null);
  const [emailToast, setEmailToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const voiceMessagesRef = useRef<{ role: string; content: string }[]>([]);

  // Voice assistant hook — onTranscript fires with the final recognized text
  const voice = useVoiceAssistant({
    onTranscript: (text: string) => {
      if (voiceMode) {
        handleVoiceModeSend(text);
      }
    },
  });

  // Auto-resume listening after AI finishes speaking in voice mode
  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    // Detect transition from playing → not playing
    if (prevIsPlayingRef.current && !voice.isPlaying && voiceMode && !voiceLoading) {
      // Small delay to avoid mic picking up speaker output
      const timer = setTimeout(() => {
        if (voiceMode) {
          voice.startListening();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
    prevIsPlayingRef.current = voice.isPlaying;
  }, [voice.isPlaying, voiceMode, voiceLoading]);

  // Conversation history queries
  const { data: conversations, refetch: refetchConversations } = trpc.ai.getConversations.useQuery(undefined, {
    enabled: isOpen,
  });
  const deleteConversationMutation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => refetchConversations(),
  });
  const deleteAllConversationsMutation = trpc.ai.deleteAllConversations.useMutation({
    onSuccess: () => {
      refetchConversations();
      handleNewConversation();
    },
  });
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fallback thinking animation when no real thinking is streamed
  useEffect(() => {
    if (!isLoading) {
      // Clear thinking when done loading
      if (!currentThinking) {
        setThinkingSteps([]);
      }
      return;
    }

    // Only show fallback steps if no real thinking is being displayed
    if (currentThinking) return;

    let stepIndex = 0;
    const intervalId = setInterval(() => {
      if (stepIndex < FALLBACK_THINKING_STEPS.length) {
        setThinkingSteps(prev => [...prev, FALLBACK_THINKING_STEPS[stepIndex]]);
        stepIndex++;
      } else {
        // Loop through steps
        setThinkingSteps([]);
        stepIndex = 0;
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isLoading, currentThinking]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // File processing
  const processFile = async (file: File): Promise<UploadedFile | null> => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`File ${file.name} exceeds 10MB limit`);
      return null;
    }

    const supportedTypes = Object.keys(SUPPORTED_FILE_TYPES);
    if (!supportedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setError(`Unsupported file type: ${file.type || file.name.split('.').pop()}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      
      if (file.type.startsWith('image/')) {
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            content: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDFs, we'll send as base64 and let the API handle it
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            content: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else {
        // Text-based files
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type || 'text/plain',
            size: file.size,
            content: reader.result as string,
          });
        };
        reader.readAsText(file);
      }
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const processedFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      const processed = await processFile(file);
      if (processed) {
        processedFiles.push(processed);
      }
    }

    setUploadedFiles((prev) => [...prev, ...processedFiles]);
    setError(null);
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert citations to APA format
  const convertToAPACitations = (rawCitations: any[]): APACitation[] => {
    if (!rawCitations || !Array.isArray(rawCitations)) return [];
    
    return rawCitations.map((citation, index) => {
      const url = typeof citation === 'string' ? citation : citation.url || citation;
      let siteName = "Unknown";
      let title = "Untitled";
      
      try {
        const urlObj = new URL(url);
        siteName = urlObj.hostname.replace('www.', '');
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          title = pathParts[pathParts.length - 1]
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\.\w+$/, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      } catch (e) {}
      
      return {
        number: index + 1,
        url,
        title: typeof citation === 'object' && citation.title ? citation.title : title,
        author: typeof citation === 'object' && citation.author ? citation.author : siteName,
        date: typeof citation === 'object' && citation.date ? citation.date : new Date().getFullYear().toString(),
        siteName,
      };
    });
  };

  // Export message to DOCX with proper markdown parsing and chart images
  const exportToDocx = async (content: string, citations: APACitation[] = [], messageIndex?: number) => {
    try {
      const children: any[] = [];
      const lines = content.split('\n');
      let i = 0;
      
      // Capture chart images from DOM if message index provided (with dimensions)
      const chartImages: { data: Uint8Array; width: number; height: number }[] = [];
      if (messageIndex !== undefined) {
        const messageEl = document.querySelector(`[data-message-index="${messageIndex}"]`);
        if (messageEl) {
          const chartContainers = messageEl.querySelectorAll('[data-chart-container="true"]');
          for (const container of Array.from(chartContainers)) {
            try {
              const canvas = await html2canvas(container as HTMLElement, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                // Convert oklch/lab colors to hex before capture
                onclone: (clonedDoc) => {
                  const allElements = clonedDoc.querySelectorAll('*');
                  allElements.forEach((el) => {
                    const style = window.getComputedStyle(el as Element);
                    const htmlEl = el as HTMLElement;
                    // Set explicit colors to avoid oklch/lab parsing issues
                    if (style.color) htmlEl.style.color = style.color;
                    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                      htmlEl.style.backgroundColor = style.backgroundColor;
                    }
                    if (style.borderColor) htmlEl.style.borderColor = style.borderColor;
                    if (style.fill && style.fill !== 'none') htmlEl.style.fill = style.fill;
                    if (style.stroke && style.stroke !== 'none') htmlEl.style.stroke = style.stroke;
                  });
                },
              });
              const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), 'image/png');
              });
              const arrayBuffer = await blob.arrayBuffer();
              chartImages.push({
                data: new Uint8Array(arrayBuffer),
                width: canvas.width,
                height: canvas.height,
              });
            } catch (e) {
              console.error('Failed to capture chart:', e);
            }
          }
        }
      }
      let chartImageIndex = 0;

      // Helper to parse inline markdown (bold, italic, links)
      const parseInlineMarkdown = (text: string, apaCitations: APACitation[] = []): any[] => {
        const runs: any[] = [];
        let remaining = text;

        while (remaining.length > 0) {
          // Check for citation [1], [2], etc.
          const citationMatch = remaining.match(/^\[(\d+)\]/);
          if (citationMatch) {
            const citationNum = parseInt(citationMatch[1]);
            const citation = apaCitations.find(c => c.number === citationNum);
            if (citation) {
              runs.push(
                new ExternalHyperlink({
                  children: [new TextRun({ text: `(${citation.author || citation.siteName}, ${citation.date})`, style: "Hyperlink", size: 22 })],
                  link: citation.url,
                })
              );
            } else {
              runs.push(new TextRun({ text: citationMatch[0], size: 22 }));
            }
            remaining = remaining.slice(citationMatch[0].length);
            continue;
          }

          // Check for bold **text**
          const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
          if (boldMatch) {
            runs.push(new TextRun({ text: boldMatch[1], bold: true, size: 22 }));
            remaining = remaining.slice(boldMatch[0].length);
            continue;
          }

          // Check for italic *text*
          const italicMatch = remaining.match(/^\*(.+?)\*/);
          if (italicMatch) {
            runs.push(new TextRun({ text: italicMatch[1], italics: true, size: 22 }));
            remaining = remaining.slice(italicMatch[0].length);
            continue;
          }

          // Check for links [text](url)
          const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);
          if (linkMatch) {
            runs.push(
              new ExternalHyperlink({
                children: [new TextRun({ text: linkMatch[1], style: "Hyperlink", size: 22 })],
                link: linkMatch[2],
              })
            );
            remaining = remaining.slice(linkMatch[0].length);
            continue;
          }

          // Regular text - find next special character
          const nextSpecial = remaining.search(/\*|\[/);
          if (nextSpecial === -1) {
            runs.push(new TextRun({ text: remaining, size: 22 }));
            break;
          } else if (nextSpecial === 0) {
            runs.push(new TextRun({ text: remaining[0], size: 22 }));
            remaining = remaining.slice(1);
          } else {
            runs.push(new TextRun({ text: remaining.slice(0, nextSpecial), size: 22 }));
            remaining = remaining.slice(nextSpecial);
          }
        }

        return runs.length > 0 ? runs : [new TextRun({ text: text, size: 22 })];
      };

      // Title
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Research Report", bold: true, size: 36 })],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      // Date
      children.push(
        new Paragraph({
          children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), italics: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Parse content
      while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (!line.trim()) {
          children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
          i++;
          continue;
        }

        // Handle chart blocks - embed captured image
        if (line.trim().startsWith('```chart')) {
          // Skip to end of chart block
          i++;
          let chartTitle = "Data Visualization";
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            try {
              const chartJson = JSON.parse(lines.slice(i - 1, i + 10).join('\n').replace('```chart', '').replace('```', ''));
              if (chartJson.title) chartTitle = chartJson.title;
            } catch {}
            i++;
          }
          i++; // Skip closing ```
          
          // Add chart title
          children.push(
            new Paragraph({
              children: [new TextRun({ text: chartTitle, bold: true, size: 24 })],
              spacing: { before: 200, after: 100 },
            })
          );
          
          // Add captured chart image if available
          if (chartImages[chartImageIndex]) {
            const img = chartImages[chartImageIndex];
            // Calculate scaled dimensions maintaining aspect ratio
            // Target max width: 500 points, scale proportionally
            const maxDocWidth = 500;
            const aspectRatio = img.width / img.height;
            const scaledWidth = maxDocWidth;
            const scaledHeight = Math.round(maxDocWidth / aspectRatio);
            
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: img.data,
                    transformation: { width: scaledWidth, height: scaledHeight },
                    type: 'png',
                  }),
                ],
                spacing: { after: 200 },
              })
            );
            chartImageIndex++;
          } else {
            // Fallback placeholder if image capture failed
            children.push(
              new Paragraph({
                children: [new TextRun({ text: "(Chart image not available)", italics: true, size: 18, color: "6B7280" })],
                spacing: { after: 200 },
              })
            );
          }
          continue;
        }

        // Handle metrics blocks - embed captured image
        if (line.trim().startsWith('```metrics')) {
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            i++;
          }
          i++; // Skip closing ```
          
          // Metrics cards are also captured as chart images
          if (chartImages[chartImageIndex]) {
            const img = chartImages[chartImageIndex];
            // Calculate scaled dimensions maintaining aspect ratio
            const maxDocWidth = 500;
            const aspectRatio = img.width / img.height;
            const scaledWidth = maxDocWidth;
            const scaledHeight = Math.round(maxDocWidth / aspectRatio);
            
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: img.data,
                    transformation: { width: scaledWidth, height: scaledHeight },
                    type: 'png',
                  }),
                ],
                spacing: { before: 200, after: 200 },
              })
            );
            chartImageIndex++;
          }
          continue;
        }

        // Skip regular code blocks
        if (line.trim().startsWith('```')) {
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            i++;
          }
          i++;
          continue;
        }

        // Headings
        if (line.startsWith('#### ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('#### ', ''), citations), heading: HeadingLevel.HEADING_4, spacing: { before: 200, after: 100 } }));
          i++;
          continue;
        }
        if (line.startsWith('### ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('### ', ''), citations), heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 } }));
          i++;
          continue;
        }
        if (line.startsWith('## ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('## ', ''), citations), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
          i++;
          continue;
        }
        if (line.startsWith('# ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('# ', ''), citations), heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
          i++;
          continue;
        }

        // Tables (detect | at start)
        if (line.trim().startsWith('|') && line.includes('|')) {
          const tableRows: any[] = [];
          let j = i;
          
          while (j < lines.length && lines[j].trim().startsWith('|')) {
            const rowLine = lines[j].trim();
            // Skip separator rows
            if (rowLine.match(/^\|[-:\s|]+\|$/)) {
              j++;
              continue;
            }
            
            const cells = rowLine.split('|').filter(c => c.trim() !== '');
            const isHeader = j === i;
            
            tableRows.push(
              new TableRow({
                children: cells.map(cell => 
                  new TableCell({
                    children: [new Paragraph({ children: parseInlineMarkdown(cell.trim(), citations) })],
                    shading: isHeader ? { fill: "E8E8E8" } : undefined,
                  })
                ),
              })
            );
            j++;
          }
          
          if (tableRows.length > 0) {
            children.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
            children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
          }
          i = j;
          continue;
        }

        // Bullet points
        if (line.match(/^[\s]*[-*•]\s/)) {
          const bulletText = line.replace(/^[\s]*[-*•]\s/, '');
          children.push(
            new Paragraph({
              children: [new TextRun({ text: "• " }), ...parseInlineMarkdown(bulletText, citations)],
              spacing: { before: 50, after: 50 },
              indent: { left: 720 },
            })
          );
          i++;
          continue;
        }

        // Numbered lists
        if (line.match(/^[\s]*\d+\.\s/)) {
          children.push(
            new Paragraph({
              children: parseInlineMarkdown(line, citations),
              spacing: { before: 50, after: 50 },
              indent: { left: 720 },
            })
          );
          i++;
          continue;
        }

        // Regular paragraph
        children.push(
          new Paragraph({
            children: parseInlineMarkdown(line, citations),
            spacing: { before: 100, after: 100 },
          })
        );
        i++;
      }

      // References section
      if (citations.length > 0) {
        children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "References", bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        for (const citation of citations) {
          children.push(
            new Paragraph({
              children: [
                new ExternalHyperlink({
                  children: [
                    new TextRun({ text: `${citation.author || citation.siteName}. (${citation.date}). `, size: 20 }),
                    new TextRun({ text: citation.title, italics: true, size: 20 }),
                    new TextRun({ text: `. Retrieved from ${citation.url}`, size: 20, style: "Hyperlink" }),
                  ],
                  link: citation.url,
                }),
              ],
              spacing: { before: 80, after: 80 },
              indent: { left: 720, hanging: 720 },
            })
          );
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Research_Report_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (error) {
      console.error("DOCX export error:", error);
      alert("Failed to export DOCX. Please try again.");
    }
  };

  // Generate PDF document (shared helper for export + email)
  const generatePdfDocument = async (content: string, citations: APACitation[] = [], messageIndex?: number): Promise<jsPDF> => {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      // Colors
      const primaryColor = { r: 16, g: 185, b: 129 }; // Emerald
      const textColor = { r: 55, g: 65, b: 81 };
      const lightGray = { r: 243, g: 244, b: 246 };
      
      // Capture chart images from DOM (with dimensions for proper scaling)
      const chartImages: { dataUrl: string; width: number; height: number }[] = [];
      if (messageIndex !== undefined) {
        const messageEl = document.querySelector(`[data-message-index="${messageIndex}"]`);
        if (messageEl) {
          const chartContainers = messageEl.querySelectorAll('[data-chart-container="true"]');
          for (const container of Array.from(chartContainers)) {
            try {
              const canvas = await html2canvas(container as HTMLElement, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                // Convert oklch/lab colors to hex before capture
                onclone: (clonedDoc) => {
                  const allElements = clonedDoc.querySelectorAll('*');
                  allElements.forEach((el) => {
                    const style = window.getComputedStyle(el as Element);
                    const htmlEl = el as HTMLElement;
                    // Set explicit colors to avoid oklch/lab parsing issues
                    if (style.color) htmlEl.style.color = style.color;
                    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                      htmlEl.style.backgroundColor = style.backgroundColor;
                    }
                    if (style.borderColor) htmlEl.style.borderColor = style.borderColor;
                    if (style.fill && style.fill !== 'none') htmlEl.style.fill = style.fill;
                    if (style.stroke && style.stroke !== 'none') htmlEl.style.stroke = style.stroke;
                  });
                },
              });
              chartImages.push({
                dataUrl: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height,
              });
            } catch (e) {
              console.error('Failed to capture chart:', e);
            }
          }
        }
      }
      let chartImageIndex = 0;

      // Helper to check and add page break
      const checkPageBreak = (requiredHeight: number) => {
        if (y + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // Helper to clean markdown text
      const cleanMarkdown = (text: string) => {
        return text
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/\[(\d+)\]/g, '')
          .replace(/\[(.+?)\]\(.+?\)/g, '$1')
          .replace(/`(.+?)`/g, '$1');
      };

      // Title header with branding
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("Research Report", margin, 20);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Elevate Edge | AI-Powered Analysis", margin, 28);
      
      pdf.setFontSize(10);
      pdf.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin, 28, { align: 'right' });
      
      y = 45;
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);

      // Parse content into sections
      const lines = content.split('\n');
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (!line.trim()) {
          y += 3;
          i++;
          continue;
        }

        // Handle chart JSON blocks - add captured image
        if (line.trim().startsWith('```chart') || line.trim().startsWith('```metrics')) {
          // Get chart title
          let chartTitle = "";
          const startI = i;
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            try {
              const jsonStr = lines.slice(startI, i + 5).join('\n').replace(/```chart|```metrics|```/g, '');
              const chartJson = JSON.parse(jsonStr);
              if (chartJson.title) chartTitle = chartJson.title;
            } catch {}
            i++;
          }
          i++; // Skip closing ```
          
          // Add chart image if available
          if (chartImages[chartImageIndex]) {
            const img = chartImages[chartImageIndex];
            
            // Add title
            if (chartTitle) {
              checkPageBreak(10);
              pdf.setFontSize(12);
              pdf.setFont("helvetica", "bold");
              pdf.text(chartTitle, margin, y);
              y += 6;
            }
            
            // Calculate scaled dimensions maintaining aspect ratio
            const aspectRatio = img.width / img.height;
            let imgWidth = maxWidth;
            let imgHeight = maxWidth / aspectRatio;
            
            // If too tall, scale by height instead
            const maxImgHeight = 80; // mm - max height for a chart
            if (imgHeight > maxImgHeight) {
              imgHeight = maxImgHeight;
              imgWidth = maxImgHeight * aspectRatio;
            }
            
            checkPageBreak(imgHeight + 10);
            // Center the image if it's narrower than maxWidth
            const imgX = margin + (maxWidth - imgWidth) / 2;
            pdf.addImage(img.dataUrl, 'PNG', imgX, y, imgWidth, imgHeight);
            y += imgHeight + 8;
            chartImageIndex++;
          }
          continue;
        }

        // Headings
        if (line.startsWith('# ')) {
          checkPageBreak(15);
          pdf.setFontSize(18);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(textColor.r, textColor.g, textColor.b);
          pdf.text(cleanMarkdown(line.replace('# ', '')), margin, y);
          y += 10;
          i++;
          continue;
        }
        if (line.startsWith('## ')) {
          checkPageBreak(12);
          y += 3;
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
          pdf.text(cleanMarkdown(line.replace('## ', '')), margin, y);
          y += 8;
          pdf.setTextColor(textColor.r, textColor.g, textColor.b);
          i++;
          continue;
        }
        if (line.startsWith('### ')) {
          checkPageBreak(10);
          y += 2;
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text(cleanMarkdown(line.replace('### ', '')), margin, y);
          y += 7;
          i++;
          continue;
        }
        if (line.startsWith('#### ')) {
          checkPageBreak(8);
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text(cleanMarkdown(line.replace('#### ', '')), margin, y);
          y += 6;
          i++;
          continue;
        }

        // Tables
        if (line.trim().startsWith('|') && line.includes('|')) {
          const tableData: string[][] = [];
          let tableStart = i;
          
          // Collect all table rows
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            const rowLine = lines[i].trim();
            // Skip separator rows
            if (!rowLine.match(/^\|[-:\s|]+\|$/)) {
              const cells = rowLine.split('|').filter(c => c !== '').map(c => cleanMarkdown(c.trim()));
              if (cells.length > 0) {
                tableData.push(cells);
              }
            }
            i++;
          }

          if (tableData.length > 0) {
            const colCount = Math.max(...tableData.map(row => row.length));
            const colWidth = maxWidth / colCount;
            const rowHeight = 8;
            const cellPadding = 2;
            
            checkPageBreak(tableData.length * rowHeight + 10);

            // Draw table
            tableData.forEach((row, rowIndex) => {
              const rowY = y + rowIndex * rowHeight;
              
              // Check for page break within table
              if (rowY > pageHeight - margin - rowHeight) {
                pdf.addPage();
                y = margin;
              }
              
              const actualY = y + rowIndex * rowHeight;
              
              // Header row background
              if (rowIndex === 0) {
                pdf.setFillColor(lightGray.r, lightGray.g, lightGray.b);
                pdf.rect(margin, actualY - 5, maxWidth, rowHeight, 'F');
              }
              
              // Draw cells
              row.forEach((cell, colIndex) => {
                const cellX = margin + colIndex * colWidth + cellPadding;
                pdf.setFontSize(9);
                pdf.setFont("helvetica", rowIndex === 0 ? "bold" : "normal");
                
                // Truncate text if too long
                const maxCellWidth = colWidth - cellPadding * 2;
                let displayText = cell;
                while (pdf.getTextWidth(displayText) > maxCellWidth && displayText.length > 3) {
                  displayText = displayText.slice(0, -4) + '...';
                }
                
                pdf.text(displayText, cellX, actualY);
              });
              
              // Draw row border
              pdf.setDrawColor(229, 231, 235);
              pdf.line(margin, actualY + 2, margin + maxWidth, actualY + 2);
            });

            y += tableData.length * rowHeight + 5;
          }
          continue;
        }

        // Bullet points
        if (line.match(/^[\s]*[-*•]\s/)) {
          checkPageBreak(6);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const bulletText = cleanMarkdown(line.replace(/^[\s]*[-*•]\s/, ''));
          const wrappedText = pdf.splitTextToSize(bulletText, maxWidth - 10);
          
          pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
          pdf.circle(margin + 2, y - 1, 1, 'F');
          
          wrappedText.forEach((textLine: string, idx: number) => {
            checkPageBreak(5);
            pdf.text(textLine, margin + 8, y + idx * 5);
          });
          y += wrappedText.length * 5 + 2;
          i++;
          continue;
        }

        // Numbered lists
        if (line.match(/^[\s]*\d+\.\s/)) {
          checkPageBreak(6);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const wrappedText = pdf.splitTextToSize(cleanMarkdown(line), maxWidth - 5);
          wrappedText.forEach((textLine: string, idx: number) => {
            checkPageBreak(5);
            pdf.text(textLine, margin + 5, y + idx * 5);
          });
          y += wrappedText.length * 5 + 2;
          i++;
          continue;
        }

        // Regular paragraph
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const wrappedText = pdf.splitTextToSize(cleanMarkdown(line), maxWidth);
        wrappedText.forEach((textLine: string, idx: number) => {
          checkPageBreak(5);
          pdf.text(textLine, margin, y + idx * 5);
        });
        y += wrappedText.length * 5 + 2;
        i++;
      }

      // References section
      if (citations.length > 0) {
        checkPageBreak(20);
        y += 10;
        
        // References header
        pdf.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        pdf.rect(margin, y - 5, maxWidth, 10, 'F');
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(textColor.r, textColor.g, textColor.b);
        pdf.text("References", margin + 3, y);
        y += 12;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        
        for (const citation of citations) {
          checkPageBreak(10);
          const refText = `${citation.author || citation.siteName}. (${citation.date}). ${citation.title}. ${citation.url}`;
          const wrappedRef = pdf.splitTextToSize(refText, maxWidth - 10);
          wrappedRef.forEach((textLine: string, idx: number) => {
            checkPageBreak(4);
            pdf.text(textLine, margin + (idx === 0 ? 0 : 5), y + idx * 4);
          });
          y += wrappedRef.length * 4 + 3;
        }
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        pdf.text('Generated by Elevate Edge', pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      return pdf;
  };

  // Export message to PDF
  const exportToPdf = async (content: string, citations: APACitation[] = [], messageIndex?: number) => {
    try {
      const pdf = await generatePdfDocument(content, citations, messageIndex);
      pdf.save(`Research_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  // Send email report
  const sendEmailReport = async (content: string, citations: APACitation[] = [], messageIndex?: number) => {
    try {
      const pdf = await generatePdfDocument(content, citations, messageIndex);
      const pdfBase64 = pdf.output("datauristring");

      // Build styled HTML body
      const plainText = content
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\[\d+\]/g, "")
        .trim();
      const preview = plainText.slice(0, 300).replace(/\n/g, "<br>");

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981, #0d9488); padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Elevate Edge</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">AI-Powered Research Report</p>
          </div>
          <div style="padding: 24px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">${preview}...</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">Full report attached as PDF.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 11px;">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} by Elevate Edge</p>
          </div>
        </div>
      `;

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Research Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          htmlBody,
          pdfBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      return { success: true };
    } catch (err: any) {
      console.error("Email send error:", err);
      return { success: false, error: err.message };
    }
  };

  // Detect if user wants to email a report via voice
  const detectEmailIntent = (text: string): { isEmail: boolean; topic: string } => {
    const lower = text.toLowerCase();
    const patterns = [
      /email\s+(?:me\s+)?(?:a\s+)?(?:report|summary|analysis|brief)\s+(?:on|about|regarding|for)\s+(.+)/i,
      /send\s+(?:me\s+)?(?:a\s+)?(?:an?\s+)?(?:email|report|summary)\s+(?:on|about|regarding|for)\s+(.+)/i,
      /email\s+(?:me\s+)?(?:this|that|the\s+report)/i,
      /send\s+(?:me\s+)?(?:this|that)\s+(?:to\s+)?(?:my\s+)?email/i,
      /email\s+me\s+(?:this|that)/i,
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        return { isEmail: true, topic: match[1]?.trim() || "" };
      }
    }

    // Simple keyword check
    if (
      (lower.includes("email") && (lower.includes("report") || lower.includes("send"))) ||
      (lower.includes("send") && lower.includes("email"))
    ) {
      return { isEmail: true, topic: lower.replace(/email|send|me|a|an|report|please/gi, "").trim() };
    }

    return { isEmail: false, topic: "" };
  };

  // Voice mode send — separate from chat, only updates voice overlay
  const handleVoiceModeSend = async (voiceText: string) => {
    if (!voiceText.trim() || voiceLoading) return;
    setVoiceUserText(voiceText);
    setVoiceResponse("");
    setVoiceLoading(true);

    voiceMessagesRef.current.push({ role: "user", content: voiceText });

    // Check for email intent
    const emailIntent = detectEmailIntent(voiceText);

    if (emailIntent.isEmail) {
      // Email flow: get a FULL detailed report (not short voice answer)
      setVoiceResponse("Generating your report...");

      try {
        const reportPrompt = emailIntent.topic
          ? `Write a detailed research report about: ${emailIntent.topic}. Include specific numbers, contacts, equipment recommendations, and budget estimates where relevant.`
          : voiceText;

        const response = await fetch("/api/c1-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: reportPrompt },
            ],
            model: selectedModel,
            researchMode: true,
            voiceMode: false, // full report, not short voice
          }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        const reportContent = data.choices?.[0]?.message?.content || data.content || "";

        if (!reportContent) throw new Error("No report content generated");

        // Generate PDF and send email
        const result = await sendEmailReport(reportContent);

        if (result.success) {
          const confirmMsg = "I've sent the report to your email.";
          setVoiceResponse(confirmMsg);
          setVoiceLoading(false);
          if (voice.isSupported) voice.speak(confirmMsg);
        } else {
          const errMsg = result.error?.includes("No email recipient")
            ? "Please set your email address in Settings first."
            : "Sorry, I couldn't send the email. Please check your settings.";
          setVoiceResponse(errMsg);
          setVoiceLoading(false);
          if (voice.isSupported) voice.speak(errMsg);
        }
      } catch (err: any) {
        console.error("Voice email error:", err);
        setVoiceResponse("Sorry, something went wrong generating the report.");
        setVoiceLoading(false);
      }
      return;
    }

    // Normal voice flow: short conversational response
    const voiceSystemMsg = {
      role: "system",
      content: "You are a helpful voice assistant for BC emissions and HVAC intelligence. IMPORTANT: You are speaking aloud to the user in a voice conversation. Keep responses SHORT (2-4 sentences max). Be conversational and natural — no markdown, no bullet points, no headers, no citations, no numbered lists. Speak as if you're talking to someone. Get straight to the point.",
    };

    try {
      const response = await fetch("/api/c1-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            voiceSystemMsg,
            ...voiceMessagesRef.current.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
          model: selectedModel,
          researchMode: false,
          voiceMode: true,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || data.content || "I couldn't generate a response.";

      voiceMessagesRef.current.push({ role: "assistant", content: assistantContent });

      // Clean for display (strip any residual markdown)
      const cleanDisplay = assistantContent
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\[\d+\]/g, "")
        .trim();

      setVoiceResponse(cleanDisplay);
      setVoiceLoading(false);

      // Speak the response
      if (voice.isSupported) {
        voice.speak(cleanDisplay);
      }
    } catch (err: any) {
      console.error("Voice mode error:", err);
      setVoiceResponse("Sorry, something went wrong. Tap the mic to try again.");
      setVoiceLoading(false);
    }
  };

  const openVoiceMode = () => {
    setVoiceMode(true);
    setVoiceResponse("");
    setVoiceUserText("");
    voiceMessagesRef.current = [];
    // Auto-start listening when entering voice mode
    setTimeout(() => voice.startListening(), 300);
  };

  const closeVoiceMode = () => {
    voice.stopListening();
    voice.stopSpeaking();
    setVoiceMode(false);
    setVoiceResponse("");
    setVoiceUserText("");
    setVoiceLoading(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      researchMode,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const filesToSend = [...uploadedFiles];
    setUploadedFiles([]);
    setIsLoading(true);
    setError(null);
    setCurrentThinking("");
    setThinkingSteps([]);

    try {
      let fullContent = input;
      
      if (filesToSend.length > 0) {
        fullContent += "\n\n[ATTACHED FILES]\n";
        for (const file of filesToSend) {
          if (file.type.startsWith('image/')) {
            fullContent += `\n[Image: ${file.name}]\n`;
          } else if (file.type === 'application/pdf') {
            fullContent += `\n[PDF Document: ${file.name}]\n`;
          } else {
            fullContent += `\n[File: ${file.name}]\n${file.content.slice(0, 50000)}\n`;
          }
        }
      }

      const response = await fetch("/api/c1-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: fullContent }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          researchMode,
          files: filesToSend.filter(f => f.type.startsWith('image/')).map(f => ({
            type: "image",
            data: f.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || data.content || "I couldn't generate a response.";
      const thinkingContent = data.thinking || null;
      const apaCitations = convertToAPACitations(data.citations || []);
      
      if (apaCitations.length > 0) {
        setCitations(data.citations);
      }

      if (thinkingContent) {
        setCurrentThinking(thinkingContent);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantContent,
          thinking: thinkingContent,
          researchMode: data.researchMode,
          citations: apaCitations,
        },
      ]);

    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to send message");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentThinking("");
      refetchConversations();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleNewConversation = () => {
    setMessages([]);
    setError(null);
    setCitations([]);
    setUploadedFiles([]);
    setActiveConversationId(null);
  };

  const handleLoadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/trpc/ai.getConversation?input=${encodeURIComponent(JSON.stringify({ id: conversationId }))}`);
      const json = await response.json();
      const conversation = json?.result?.data;
      if (conversation?.messages) {
        const loaded: Message[] = conversation.messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        setMessages(loaded);
        setActiveConversationId(conversationId);
        setError(null);
        setCitations([]);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (voiceMode) {
        closeVoiceMode();
      } else if (showModelSelector) {
        setShowModelSelector(false);
      } else {
        handleClose();
      }
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type === 'application/pdf') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);

  // Convert citation numbers [1], [2] to APA hyperlinks
  const renderContentWithAPACitations = (content: string, citations: APACitation[] = []) => {
    if (!citations || citations.length === 0) {
      return content;
    }

    // Replace [1], [2], etc. with hyperlinked (Author, Year) format
    let processedContent = content;
    citations.forEach((citation) => {
      const pattern = new RegExp(`\\[${citation.number}\\]`, 'g');
      // Extract author/site name - clean it up for display
      const rawAuthor = citation.author || citation.siteName || "Source";
      const author = rawAuthor.split('.')[0].split(',')[0].trim(); // Get first part of author
      const year = citation.date || new Date().getFullYear().toString();
      // Create APA-style in-text citation as hyperlink: (Author, Year)
      const apaLink = `[(${author}, ${year})](${citation.url})`;
      processedContent = processedContent.replace(pattern, apaLink);
    });

    return processedContent;
  };

  // Format APA reference list entry
  const formatAPAReference = (citation: APACitation): string => {
    const author = citation.author || citation.siteName || "Unknown";
    const date = citation.date || "n.d.";
    const title = citation.title || "Untitled";
    return `${author}. (${date}). *${title}*. Retrieved from ${citation.url}`;
  };

  // Enhanced Markdown Components with modern UI - memoized to prevent re-renders
  const MarkdownComponents = useMemo(() => ({
    h1: ({ children }: any) => (
      <div className="mt-6 mb-4 first:mt-0">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span className="w-1.5 h-8 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full"></span>
          {children}
        </h1>
        <div className="h-px bg-gradient-to-r from-emerald-500/50 to-transparent mt-2"></div>
      </div>
    ),
    h2: ({ children }: any) => (
      <div className="mt-6 mb-3 first:mt-0">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          {children}
        </h2>
      </div>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2 first:mt-0 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-2 first:mt-0">{children}</h4>
    ),
    p: ({ children }: any) => {
      // Check if paragraph contains a metric pattern like "**4.6%**" or "$4,000M"
      const text = String(children);
      const hasMetric = /\*\*[\d.,]+%?\*\*|\$[\d,]+[MBK]?/.test(text);
      
      return (
        <p className={`text-sm text-gray-600 mb-3 leading-relaxed last:mb-0 ${hasMetric ? 'text-base' : ''}`}>
          {children}
        </p>
      );
    },
    ul: ({ children }: any) => (
      <ul className="space-y-2 mb-4 text-sm text-gray-600">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="space-y-3 mb-4 text-sm text-gray-600 counter-reset-item">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start gap-3 leading-relaxed">
        <span className="mt-2 w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></span>
        <span className="flex-1">{children}</span>
      </li>
    ),
    table: ({ children }: any) => (
      <div className="my-5 rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">{children}</table>
        </div>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">{children}</thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="hover:bg-emerald-50/50 transition-colors">{children}</tr>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }: any) => {
      // Style numeric cells differently
      const text = String(children);
      const isNumeric = /^[\d$%.,]+[MBK]?$/.test(text.trim());
      const isPositive = text.includes('+') || (text.includes('%') && !text.includes('-'));
      const isNegative = text.includes('-');
      
      return (
        <td className={`px-4 py-3 text-sm ${
          isNumeric 
            ? `font-medium ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-gray-900'}` 
            : 'text-gray-600'
        }`}>
          {children}
        </td>
      );
    },
    code: ({ inline, className, children }: any) => {
      const codeContent = String(children).replace(/\n$/, '');
      
      // Check if this is a chart block
      if (!inline && className === 'language-chart') {
        try {
          const chartData = JSON.parse(codeContent) as ChartData;
          return <ChartRenderer chartData={chartData} />;
        } catch (e) {
          console.error('Failed to parse chart JSON:', e);
        }
      }
      
      // Check if this is a metrics block
      if (!inline && className === 'language-metrics') {
        try {
          const metricsData = JSON.parse(codeContent) as MetricsData;
          return <MetricsRenderer metricsData={metricsData} />;
        } catch (e) {
          console.error('Failed to parse metrics JSON:', e);
        }
      }
      
      return inline ? (
        <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-mono border border-emerald-100">
          {children}
        </code>
      ) : (
        <div className="my-3 rounded-lg overflow-hidden border border-gray-200">
          <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs text-gray-400 ml-2">Code</span>
          </div>
          <code className="block bg-gray-900 text-gray-100 p-4 text-xs font-mono overflow-x-auto">
            {children}
          </code>
        </div>
      );
    },
    pre: ({ children }: any) => <>{children}</>,
    strong: ({ children }: any) => {
      // Check if this is a metric/number to highlight
      const text = String(children);
      const isMetric = /^[\d.,]+%?$/.test(text) || /^\$[\d,]+[MBK]?$/.test(text);
      
      if (isMetric) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
            <span className="text-lg font-bold text-emerald-700">{children}</span>
          </span>
        );
      }
      
      return <strong className="font-semibold text-gray-900">{children}</strong>;
    },
    em: ({ children }: any) => (
      <em className="text-gray-600 not-italic bg-gray-50 px-1 rounded">{children}</em>
    ),
    blockquote: ({ children }: any) => (
      <div className="my-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500 p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 14.725c0-5.141 3.892-10.519 10-11.725l.984 2.126c-2.215.835-4.163 3.742-4.38 5.746 2.491.392 4.396 2.547 4.396 5.149 0 3.182-2.584 4.979-5.199 4.979-3.015 0-5.801-2.305-5.801-6.275zm-13 0c0-5.141 3.892-10.519 10-11.725l.984 2.126c-2.215.835-4.163 3.742-4.38 5.746 2.491.392 4.396 2.547 4.396 5.149 0 3.182-2.584 4.979-5.199 4.979-3.015 0-5.801-2.305-5.801-6.275z"/>
          </svg>
          <div className="text-gray-700 italic">{children}</div>
        </div>
      </div>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-500 transition-colors inline-flex items-center gap-1"
      >
        {children}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    ),
    hr: () => (
      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
      </div>
    ),
  }), []);

  return (
    <>
      {/* Email Toast Notification */}
      <AnimatePresence>
        {emailToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
              emailToast.type === "success"
                ? "bg-emerald-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {emailToast.type === "success" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {emailToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-xl z-40 flex items-center justify-center hover:bg-gray-800 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </motion.button>

      {/* Fullscreen Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropZoneRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-50 bg-white flex flex-col ${isDragging ? 'ring-4 ring-inset ring-blue-500' : ''}`}
            onKeyDown={handleKeyDown}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-blue-500/10 z-50 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-dashed border-blue-500">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-xl font-semibold text-gray-900">Drop files here</p>
                      <p className="text-sm text-gray-500 mt-1">PDF, images, text files up to 10MB</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-16 flex-shrink-0 border-b border-gray-200 flex items-center justify-between px-8 bg-white">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="font-semibold text-gray-900">Elevate Edge</h1>
                    <p className="text-xs text-gray-500">Powered by Perplexity Agentic Research API</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* History Toggle */}
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showHistory ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                  title={showHistory ? "Hide history" : "Show history"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Research Mode Toggle */}
                <button
                  onClick={() => setResearchMode(!researchMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all ${
                    researchMode 
                      ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  title={researchMode ? "Research mode enabled - deeper web search" : "Enable research mode for thorough analysis"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="font-medium">Research</span>
                  {researchMode && (
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  )}
                </button>

                {/* Voice Mode Button */}
                {voice.isSupported && (
                  <button
                    onClick={openVoiceMode}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title="Open voice assistant"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="font-medium">Voice</span>
                  </button>
                )}

                {/* Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      selectedModelInfo?.tier === 'premium' ? 'bg-purple-500' :
                      selectedModelInfo?.tier === 'standard' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <span className="font-medium text-gray-700">{selectedModelInfo?.name || 'Select Model'}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {showModelSelector && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Model</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {['OpenAI', 'Anthropic', 'Google', 'Perplexity'].map((provider) => (
                            <div key={provider}>
                              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                <p className="text-xs font-semibold text-gray-500">{provider}</p>
                              </div>
                              {AVAILABLE_MODELS.filter(m => m.provider === provider).map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => {
                                    setSelectedModel(model.id);
                                    setShowModelSelector(false);
                                  }}
                                  className={`w-full px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left ${
                                    selectedModel === model.id ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                    model.tier === 'premium' ? 'bg-purple-500' :
                                    model.tier === 'standard' ? 'bg-blue-500' : 'bg-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900 text-sm">{model.name}</span>
                                      {model.tier === 'premium' && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">PRO</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{model.description}</p>
                                  </div>
                                  {selectedModel === model.id && (
                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleNewConversation}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  New Chat
                </button>
                <a
                  href="/settings"
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Settings
                </a>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Main Content with History Sidebar */}
            <div className="flex-1 flex overflow-hidden">
              {/* History Sidebar */}
              {showHistory && (
                <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
                  <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">History</span>
                    <div className="flex items-center gap-1">
                      {confirmClearAll ? (
                        <>
                          <button
                            onClick={() => {
                              deleteAllConversationsMutation.mutate();
                              setConfirmClearAll(false);
                            }}
                            className="px-2 py-0.5 text-[10px] text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmClearAll(false)}
                            className="px-2 py-0.5 text-[10px] text-gray-500 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmClearAll(true)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-200 rounded transition-colors"
                          title="Clear all history"
                          disabled={!conversations?.length}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={handleNewConversation}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                        title="New chat"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {!conversations || conversations.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">
                        No conversations yet
                      </div>
                    ) : (
                      <div className="py-1">
                        {conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                              activeConversationId === conv.id
                                ? "bg-white border-r-2 border-black"
                                : "hover:bg-gray-100"
                            }`}
                            onClick={() => handleLoadConversation(conv.id)}
                          >
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{conv.title}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(conv.updatedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversationMutation.mutate({ id: conv.id });
                                if (activeConversationId === conv.id) {
                                  handleNewConversation();
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              )}

              <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
              <div className="max-w-5xl mx-auto px-6 py-6">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      How can I help you today?
                    </h2>
                    <p className="text-gray-500 mb-4 max-w-xl mx-auto">
                      Ask me about BC emissions data, major projects, HVAC opportunities, or market intelligence.
                      {researchMode && (
                        <span className="block mt-2 text-purple-600 font-medium">
                          Research mode is ON - I'll conduct thorough web research for your questions.
                        </span>
                      )}
                    </p>

                    {/* Voice Orb — opens immersive voice mode */}
                    {voice.isSupported && (
                      <div className="my-8 flex flex-col items-center">
                        <button
                          onClick={openVoiceMode}
                          className="relative group"
                          style={{ width: 100, height: 100 }}
                        >
                          {/* Glow */}
                          <div
                            className="absolute inset-0 rounded-full animate-pulse opacity-20"
                            style={{
                              background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)',
                              filter: 'blur(12px)',
                              animationDuration: '3s',
                            }}
                          />
                          {/* Sphere */}
                          <div className="absolute inset-1 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-300"
                            style={{
                              boxShadow: '0 0 30px rgba(139,92,246,0.3), inset 0 0 20px rgba(255,255,255,0.1)',
                            }}
                          >
                            <div className="absolute inset-0 rounded-full animate-spin" style={{
                              background: 'conic-gradient(from 0deg, #6366f1, #8b5cf6, #a78bfa, #60a5fa, #34d399, #a78bfa, #8b5cf6, #6366f1)',
                              animationDuration: '12s',
                            }} />
                            <div className="absolute inset-0 rounded-full" style={{
                              background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 40%, transparent 60%)',
                            }} />
                            <div className="absolute inset-0 rounded-full" style={{
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                            }} />
                            <div className="absolute inset-0 rounded-full" style={{
                              boxShadow: 'inset 0 -6px 16px rgba(0,0,0,0.2), inset 0 3px 10px rgba(255,255,255,0.15)',
                            }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-7 h-7 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                            </div>
                          </div>
                        </button>
                        <p className="mt-3 text-sm text-gray-400">Tap to speak</p>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-400 mb-8">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Drag & drop files
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Enable Research mode for deep analysis
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Context from uploaded docs
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                      {QUICK_PROMPTS.slice(0, 4).map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuickPrompt(prompt)}
                          className="text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          data-message-index={i}
                          className={`${msg.role === "user" ? "max-w-[70%]" : "max-w-full w-full"} ${
                            msg.role === "user"
                              ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-md"
                              : "bg-white rounded-2xl rounded-bl-md px-6 py-6 border border-gray-100 shadow-lg"
                          }`}
                        >
                          {msg.role === "user" ? (
                            <>
                              <p className="text-sm">{msg.content}</p>
                              {msg.files && msg.files.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {msg.files.map((file, fi) => (
                                    <div key={fi} className="flex items-center gap-1.5 text-xs bg-white/10 px-2 py-1 rounded">
                                      {getFileIcon(file.type)}
                                      <span className="truncate max-w-[100px]">{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {msg.researchMode && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-purple-300">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <span>Research mode</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4">
                              {/* Thinking/Reasoning Section */}
                              {msg.thinking && (
                                <details className="group">
                                  <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                    <svg className="w-4 h-4 transform transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <span className="font-medium">View AI Thinking Process</span>
                                    {msg.researchMode && (
                                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">Research</span>
                                    )}
                                  </summary>
                                  <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                                      {msg.thinking}
                                    </div>
                                  </div>
                                </details>
                              )}
                              
                              {/* Main Response Content with APA Citations */}
                              <div className="markdown-content">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={MarkdownComponents}
                                >
                                  {renderContentWithAPACitations(msg.content, msg.citations)}
                                </ReactMarkdown>
                              </div>

                              {/* APA References Section */}
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                  <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                      <svg className="w-4 h-4 transform transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      <span className="font-medium">References ({msg.citations.length})</span>
                                    </summary>
                                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                      <div className="space-y-2">
                                        {msg.citations.map((citation) => (
                                          <div key={citation.number} className="text-xs text-gray-700 leading-relaxed">
                                            <a
                                              href={citation.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="hover:text-blue-600 transition-colors"
                                            >
                                              {citation.author || citation.siteName || "Unknown"}. ({citation.date || "n.d."}). <em>{citation.title || "Untitled"}</em>. Retrieved from {citation.url}
                                            </a>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              )}

                              {/* Export Buttons */}
                              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                                <span className="text-xs text-gray-400">Export:</span>
                                <button
                                  onClick={() => {
                                    setExportingIndex(i);
                                    exportToDocx(msg.content, msg.citations || [], i).finally(() => setExportingIndex(null));
                                  }}
                                  disabled={exportingIndex === i}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {exportingIndex === i ? 'Exporting...' : 'DOCX'}
                                </button>
                                <button
                                  onClick={() => {
                                    setExportingIndex(i);
                                    exportToPdf(msg.content, msg.citations || [], i).finally(() => setExportingIndex(null));
                                  }}
                                  disabled={exportingIndex === i}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  PDF
                                </button>
                                <button
                                  onClick={async () => {
                                    setEmailingIndex(i);
                                    const result = await sendEmailReport(msg.content, msg.citations || [], i);
                                    setEmailingIndex(null);
                                    if (result.success) {
                                      setEmailToast({ type: "success", message: "Report sent to your email!" });
                                    } else {
                                      setEmailToast({ type: "error", message: result.error || "Failed to send email" });
                                    }
                                    setTimeout(() => setEmailToast(null), 4000);
                                  }}
                                  disabled={emailingIndex === i}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {emailingIndex === i ? 'Sending...' : 'Email'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start w-full max-w-[95%]"
                      >
                        <div className="bg-white rounded-2xl rounded-bl-md px-5 py-4 border border-gray-200 shadow-sm w-full">
                          {/* Header with model info */}
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                            <div className="relative">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                researchMode 
                                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                                  : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                              }`}>
                                {researchMode ? (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                )}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full animate-pulse ${
                                researchMode ? 'bg-purple-400' : 'bg-emerald-400'
                              }`} />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {researchMode ? 'Deep Research' : 'Thinking'} with {selectedModelInfo?.name}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">{selectedModelInfo?.provider}</span>
                                <span className="text-xs text-gray-300">|</span>
                                <span className={`text-xs font-medium ${researchMode ? 'text-purple-500' : 'text-emerald-500'}`}>
                                  {researchMode ? 'Research Mode' : 'Processing'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Real Thinking Display */}
                          <div className="space-y-2">
                            {currentThinking ? (
                              // Show real thinking from API
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">AI Thinking Process</span>
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                                  {currentThinking}
                                </div>
                              </div>
                            ) : (
                              // Fallback: Show animated steps
                              <div className="space-y-2">
                                {thinkingSteps.map((step, index) => (
                                  <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50"
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                      index === thinkingSteps.length - 1 
                                        ? (researchMode ? 'bg-purple-500' : 'bg-emerald-500')
                                        : 'bg-gray-300'
                                    }`}>
                                      {index === thinkingSteps.length - 1 ? (
                                        <div className="flex gap-0.5">
                                          <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                          <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                          <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                      ) : (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`text-sm ${
                                      index === thinkingSteps.length - 1 
                                        ? (researchMode ? 'text-purple-700 font-medium' : 'text-emerald-700 font-medium')
                                        : 'text-gray-500'
                                    }`}>
                                      {step}
                                    </span>
                                  </motion.div>
                                ))}
                                {thinkingSteps.length === 0 && (
                                  <div className="flex items-center gap-3 p-2.5">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                      researchMode ? 'bg-purple-500' : 'bg-emerald-500'
                                    }`}>
                                      <div className="flex gap-0.5">
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                      </div>
                                    </div>
                                    <span className={`text-sm font-medium ${researchMode ? 'text-purple-700' : 'text-emerald-700'}`}>
                                      Starting analysis...
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Research mode indicator */}
                          {researchMode && (
                            <div className="mt-4 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2 text-xs text-purple-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Deep research mode - searching multiple sources for comprehensive analysis</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </main>
            </div>{/* end flex wrapper for sidebar + main */}

            {/* Input Footer */}
            <footer className="flex-shrink-0 border-t border-gray-200 bg-white">
              {/* Uploaded Files Preview */}
              {uploadedFiles.length > 0 && (
                <div className="px-8 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="max-w-6xl mx-auto flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <span className="text-gray-500">{getFileIcon(file.type)}</span>
                        <span className="truncate max-w-[150px] text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-20 px-8 flex items-center">
                <div className="max-w-6xl mx-auto w-full flex gap-3 items-center">
                  {/* File Upload Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.csv,.json,.md,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Upload files"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>

                  {/* Voice Mode Button */}
                  {voice.isSupported && (
                    <button
                      onClick={openVoiceMode}
                      className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Voice assistant"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  )}

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Ask about emissions, projects, opportunities..."
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                    className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoading ? (
                      "Thinking..."
                    ) : (
                      <>
                        Send
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </footer>

            {/* Error Toast */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow-lg"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immersive Voice Mode Overlay */}
      <AnimatePresence>
        {voiceMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-gradient-to-b from-gray-900 via-gray-950 to-black flex flex-col items-center justify-center"
          >
            {/* Close button */}
            <button
              onClick={closeVoiceMode}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Branding */}
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-white/60 text-sm font-medium">Elevate Edge Voice</span>
            </div>

            {/* Main content area */}
            <div className="flex flex-col items-center gap-8 max-w-lg px-6 w-full">

              {/* User's spoken text (small, above orb) */}
              {voiceUserText && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-white/40 text-sm text-center"
                >
                  {voiceUserText}
                </motion.p>
              )}

              {/* The Orb — glassmorphic iridescent sphere */}
              <button
                onClick={() => {
                  if (voice.isPlaying) {
                    voice.stopSpeaking();
                  } else if (voice.isListening) {
                    voice.stopListening();
                  } else if (!voiceLoading) {
                    voice.startListening();
                  }
                }}
                className="relative cursor-pointer"
                style={{ width: 180, height: 180 }}
              >
                {/* Ambient glow — amplifies when speaking */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{
                    scale: voice.isPlaying ? [1, 1.6, 1] : voice.isListening ? [1, 1.3, 1] : [1, 1.1, 1],
                    opacity: voice.isPlaying ? [0.3, 0.6, 0.3] : voice.isListening ? [0.2, 0.4, 0.2] : [0.1, 0.15, 0.1],
                  }}
                  transition={{
                    duration: voice.isPlaying ? 0.8 : voice.isListening ? 2 : 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(59,130,246,0.2) 40%, transparent 70%)',
                    filter: 'blur(20px)',
                  }}
                />

                {/* Sound wave rings when speaking */}
                {voice.isPlaying && (
                  <>
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={`ring-${i}`}
                        className="absolute inset-0 rounded-full border"
                        style={{ borderColor: 'rgba(139,92,246,0.3)' }}
                        initial={{ scale: 1, opacity: 0.4 }}
                        animate={{ scale: [1, 2 + i * 0.3], opacity: [0.4, 0] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.4,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Main orb container */}
                <motion.div
                  className="absolute inset-4 rounded-full overflow-hidden"
                  animate={{
                    scale: voice.isPlaying ? [1, 1.08, 0.96, 1.05, 1] : voice.isListening ? [1, 1.04, 1] : voiceLoading ? [1, 0.97, 1] : 1,
                  }}
                  transition={{
                    duration: voice.isPlaying ? 0.6 : voice.isListening ? 2.5 : 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    boxShadow: voice.isPlaying
                      ? '0 0 60px rgba(139,92,246,0.5), 0 0 120px rgba(59,130,246,0.3), inset 0 0 40px rgba(255,255,255,0.1)'
                      : '0 0 40px rgba(139,92,246,0.3), 0 0 80px rgba(59,130,246,0.15), inset 0 0 30px rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Iridescent gradient base */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ rotate: voice.isPlaying ? [0, 360] : [0, 360] }}
                    transition={{
                      duration: voice.isPlaying ? 3 : 12,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{
                      background: 'conic-gradient(from 0deg, #6366f1, #8b5cf6, #a78bfa, #60a5fa, #34d399, #a78bfa, #8b5cf6, #6366f1)',
                    }}
                  />

                  {/* Glass overlay with depth */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 40%, transparent 60%)',
                    }}
                  />

                  {/* Secondary light refraction */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ rotate: voice.isPlaying ? [360, 0] : [360, 0] }}
                    transition={{
                      duration: voice.isPlaying ? 5 : 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{
                      background: 'radial-gradient(circle at 65% 70%, rgba(96,165,250,0.4) 0%, transparent 50%)',
                    }}
                  />

                  {/* Glass sheen on top */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                    }}
                  />

                  {/* Inner shadow for depth */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      boxShadow: 'inset 0 -8px 20px rgba(0,0,0,0.2), inset 0 4px 12px rgba(255,255,255,0.15)',
                    }}
                  />

                  {/* Center icon — only visible in idle/loading states */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {voiceLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <svg className="w-8 h-8 text-white/70" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </motion.div>
                    ) : !voice.isListening && !voice.isPlaying ? (
                      <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    ) : null}
                  </div>
                </motion.div>
              </button>

              {/* Status text */}
              <p className="text-white/50 text-sm">
                {voice.isListening
                  ? voice.transcript || 'Listening...'
                  : voice.isPlaying
                  ? 'Speaking...'
                  : voiceLoading
                  ? 'Thinking...'
                  : 'Tap to speak'}
              </p>

              {/* AI Response transcription */}
              {voiceResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-h-60 overflow-y-auto"
                >
                  <p className="text-white/80 text-center text-base leading-relaxed">
                    {voiceResponse}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Bottom hint */}
            <div className="absolute bottom-8 text-white/30 text-xs text-center">
              <p>{voice.isPlaying ? 'Tap orb to stop' : voice.isListening ? 'Listening... tap orb to cancel' : 'Tap the orb to speak'}</p>
              <p className="mt-1">Press <span className="bg-white/10 px-1.5 py-0.5 rounded">Esc</span> to close</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
