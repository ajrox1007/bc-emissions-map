"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface Message {
  role: "user" | "assistant";
  content: string;
  researchMode?: boolean;
}

const QUICK_PROMPTS = [
  "What are the top 5 communities by emissions?",
  "Show me all LNG projects over $1B",
  "Which areas have the highest fossil fuel usage?",
  "Generate a market opportunity report for Vancouver",
  "Compare residential vs commercial emissions across BC",
];

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [researchMode, setResearchMode] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    },
  });

  const { data: conversations } = trpc.ai.getConversations.useQuery(undefined, {
    enabled: showHistory,
  });

  const loadConversation = trpc.ai.getConversation.useQuery(
    { id: conversationId || "" },
    { enabled: false }
  );

  const deleteConversation = trpc.ai.deleteConversation.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = { 
      role: "user", 
      content: input,
      researchMode 
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    chatMutation.mutate({
      messages: [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: input },
      ],
      conversationId: conversationId || undefined,
      researchMode,
    });
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
  };

  const handleLoadConversation = async (id: string) => {
    setConversationId(id);
    const result = await loadConversation.refetch();
    if (result.data?.messages) {
      setMessages(
        result.data.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          researchMode: m.researchMode,
        }))
      );
    }
    setShowHistory(false);
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split("\n")
      .map((line, i) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="font-bold text-sm mt-2 mb-1">
              {line.replace("### ", "")}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="font-bold mt-3 mb-1">
              {line.replace("## ", "")}
            </h3>
          );
        }
        // Bullet points
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <li key={i} className="ml-4 text-sm">
              {line.replace(/^[-•] /, "")}
            </li>
          );
        }
        // Numbered lists
        if (/^\d+\. /.test(line)) {
          return (
            <li key={i} className="ml-4 text-sm list-decimal">
              {line.replace(/^\d+\. /, "")}
            </li>
          );
        }
        // Bold text
        if (line.includes("**")) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i} className="text-sm">
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j}>{part}</strong>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
            </p>
          );
        }
        // Regular paragraph
        if (line.trim()) {
          return (
            <p key={i} className="text-sm mb-1">
              {line}
            </p>
          );
        }
        return null;
      });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:scale-110 transition-transform z-50 flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 w-[420px] h-[650px] bg-white shadow-2xl rounded-lg border-2 border-black z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-black text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">
                    BC Emissions AI
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs hover:underline opacity-70 hover:opacity-100"
                    title="Chat History"
                  >
                    📚
                  </button>
                  <button
                    onClick={handleNewConversation}
                    className="text-xs hover:underline opacity-70 hover:opacity-100"
                    title="New Chat"
                  >
                    ➕
                  </button>
                </div>
              </div>

              {/* Research Mode Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs opacity-70">
                  {researchMode ? "🌐 Research Mode" : "📊 Data Mode"}
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs opacity-70">Web Search</span>
                  <div
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      researchMode ? "bg-green-500" : "bg-gray-600"
                    }`}
                    onClick={() => setResearchMode(!researchMode)}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        researchMode ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* History Panel */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-gray-200 overflow-hidden"
                >
                  <div className="p-3 bg-gray-50 max-h-48 overflow-y-auto">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Recent Conversations
                    </div>
                    {conversations?.length === 0 && (
                      <p className="text-xs text-gray-400">No conversations yet</p>
                    )}
                    {conversations?.map((conv) => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between p-2 hover:bg-white rounded cursor-pointer group"
                        onClick={() => handleLoadConversation(conv.id)}
                      >
                        <span className="text-xs truncate flex-1">
                          {conv.title || "Untitled"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation.mutate({ id: conv.id });
                          }}
                          className="text-red-500 opacity-0 group-hover:opacity-100 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-4">
                  <div className="text-4xl mb-4">🤖</div>
                  <p className="text-sm mb-4">
                    Ask me anything about BC emissions, projects, or HVAC opportunities
                  </p>
                  <div className="text-xs text-gray-500 mb-4">
                    {researchMode
                      ? "🌐 Research Mode: I'll search the web for current info"
                      : "📊 Data Mode: I'll query our database"}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">Try asking:</p>
                    {QUICK_PROMPTS.slice(0, 3).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="block w-full text-left p-2 hover:bg-gray-100 rounded text-xs border border-gray-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <div className="prose-sm">{formatMessage(msg.content)}</div>
                    )}
                    {msg.researchMode && msg.role === "user" && (
                      <div className="text-xs opacity-50 mt-1">🌐 with web search</div>
                    )}
                  </div>
                </motion.div>
              ))}

              {chatMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={researchMode ? "Ask with web research..." : "Ask about emissions, projects..."}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  disabled={chatMutation.isPending}
                />
                <button
                  onClick={handleSend}
                  disabled={chatMutation.isPending || !input.trim()}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {chatMutation.isPending ? "..." : "Send"}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  Powered by Thesys C1
                </span>
                <a
                  href="/settings"
                  className="text-xs text-blue-600 hover:underline"
                >
                  ⚙️ Settings
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

