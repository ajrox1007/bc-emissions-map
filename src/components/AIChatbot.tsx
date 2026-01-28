"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: UploadedFile[];
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

// Reasoning steps for the thinking animation
const REASONING_STEPS = [
  { id: 1, icon: "🔍", text: "Searching the web for relevant information...", duration: 2000 },
  { id: 2, icon: "📊", text: "Analyzing data sources and citations...", duration: 2500 },
  { id: 3, icon: "🧠", text: "Processing and reasoning through findings...", duration: 3000 },
  { id: 4, icon: "✨", text: "Synthesizing comprehensive response...", duration: 2000 },
  { id: 5, icon: "📝", text: "Formatting and finalizing answer...", duration: 1500 },
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
  const [currentReasoningStep, setCurrentReasoningStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
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

  // Reasoning steps animation
  useEffect(() => {
    if (!isLoading) {
      setCurrentReasoningStep(0);
      setCompletedSteps([]);
      return;
    }

    // Start with first step
    setCurrentReasoningStep(0);
    setCompletedSteps([]);

    const stepTimers: NodeJS.Timeout[] = [];
    let cumulativeTime = 0;

    REASONING_STEPS.forEach((step, index) => {
      // Timer to mark current step as active
      const activateTimer = setTimeout(() => {
        setCurrentReasoningStep(index);
      }, cumulativeTime);
      stepTimers.push(activateTimer);

      // Timer to mark step as completed (before moving to next)
      const completeTimer = setTimeout(() => {
        setCompletedSteps(prev => [...prev, step.id]);
      }, cumulativeTime + step.duration - 300);
      stepTimers.push(completeTimer);

      cumulativeTime += step.duration;
    });

    // Loop back to continue animation if still loading
    const loopTimer = setTimeout(() => {
      if (isLoading) {
        setCurrentReasoningStep(0);
        setCompletedSteps([]);
      }
    }, cumulativeTime + 500);
    stepTimers.push(loopTimer);

    return () => {
      stepTimers.forEach(timer => clearTimeout(timer));
    };
  }, [isLoading]);

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

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage: Message = { 
      role: "user", 
      content: input,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const filesToSend = [...uploadedFiles];
    setUploadedFiles([]);
    setIsLoading(true);
    setError(null);

    try {
      // Build the content with file context
      let fullContent = input;
      
      if (filesToSend.length > 0) {
        fullContent += "\n\n[ATTACHED FILES]\n";
        for (const file of filesToSend) {
          if (file.type.startsWith('image/')) {
            fullContent += `\n[Image: ${file.name}]\n`;
          } else if (file.type === 'application/pdf') {
            fullContent += `\n[PDF Document: ${file.name}]\n`;
          } else {
            fullContent += `\n[File: ${file.name}]\n${file.content.slice(0, 50000)}\n`; // Limit text content
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

      if (data.citations) {
        setCitations(data.citations);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantContent },
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
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (showModelSelector) {
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

  const MarkdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-bold text-gray-900 mt-5 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">{children}</h4>
    ),
    p: ({ children }: any) => (
      <p className="text-sm text-gray-700 mb-3 leading-relaxed last:mb-0">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-relaxed ml-2">{children}</li>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-gray-50">{children}</thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{children}</td>
    ),
    code: ({ inline, children }: any) =>
      inline ? (
        <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      ) : (
        <code className="block bg-gray-100 text-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
          {children}
        </code>
      ),
    pre: ({ children }: any) => (
      <pre className="bg-gray-100 rounded-lg overflow-x-auto my-2">{children}</pre>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-gray-700">{children}</em>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 py-2 my-3 text-gray-700 italic bg-gray-50 rounded-r">
        {children}
      </blockquote>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-4 border-gray-200" />,
  };

  return (
    <>
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

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-6xl mx-auto px-8 py-8">
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
                    </p>
                    <p className="text-sm text-gray-400 mb-8">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Drag & drop files anywhere to upload
                      </span>
                    </p>
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
                          className={`${msg.role === "user" ? "max-w-[70%]" : "max-w-[95%]"} ${
                            msg.role === "user"
                              ? "bg-black text-white rounded-2xl rounded-br-md px-4 py-3"
                              : "bg-white rounded-2xl rounded-bl-md px-5 py-5 border border-gray-200 shadow-sm"
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
                            </>
                          ) : (
                            <div className="markdown-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={MarkdownComponents}
                              >
                                {msg.content}
                              </ReactMarkdown>
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
                              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900">Thinking with {selectedModelInfo?.name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">{selectedModelInfo?.provider}</span>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-emerald-500 font-medium">Processing</span>
                              </div>
                            </div>
                          </div>

                          {/* Reasoning Steps */}
                          <div className="space-y-2">
                            {REASONING_STEPS.map((step, index) => {
                              const isActive = currentReasoningStep === index;
                              const isCompleted = completedSteps.includes(step.id);
                              const isPending = index > currentReasoningStep && !isCompleted;

                              return (
                                <motion.div
                                  key={step.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ 
                                    opacity: isPending ? 0.4 : 1, 
                                    x: 0,
                                    scale: isActive ? 1.02 : 1
                                  }}
                                  transition={{ 
                                    duration: 0.3, 
                                    delay: index * 0.1,
                                    scale: { duration: 0.2 }
                                  }}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300 ${
                                    isActive 
                                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' 
                                      : isCompleted 
                                        ? 'bg-gray-50' 
                                        : 'bg-transparent'
                                  }`}
                                >
                                  {/* Step indicator */}
                                  <div className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    isCompleted 
                                      ? 'bg-emerald-500' 
                                      : isActive 
                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
                                        : 'bg-gray-200'
                                  }`}>
                                    {isCompleted ? (
                                      <motion.svg 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-4 h-4 text-white" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </motion.svg>
                                    ) : isActive ? (
                                      <>
                                        <span className="text-sm">{step.icon}</span>
                                        <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
                                      </>
                                    ) : (
                                      <span className="text-sm opacity-50">{step.icon}</span>
                                    )}
                                  </div>

                                  {/* Step text */}
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm transition-colors duration-300 ${
                                      isActive 
                                        ? 'text-emerald-700 font-medium' 
                                        : isCompleted 
                                          ? 'text-gray-500 line-through decoration-emerald-400' 
                                          : 'text-gray-400'
                                    }`}>
                                      {step.text}
                                    </span>
                                  </div>

                                  {/* Progress indicator for active step */}
                                  {isActive && (
                                    <div className="flex-shrink-0">
                                      <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                      </div>
                                    </div>
                                  )}

                                  {/* Checkmark for completed */}
                                  {isCompleted && (
                                    <motion.span 
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className="text-xs text-emerald-500 font-medium"
                                    >
                                      Done
                                    </motion.span>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-400">Progress</span>
                              <span className="text-xs font-medium text-emerald-600">
                                {Math.min(completedSteps.length + 1, REASONING_STEPS.length)}/{REASONING_STEPS.length}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: `${((completedSteps.length + (currentReasoningStep >= 0 ? 0.5 : 0)) / REASONING_STEPS.length) * 100}%` 
                                }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </main>

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
    </>
  );
}
