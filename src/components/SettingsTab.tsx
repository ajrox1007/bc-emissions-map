"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";

const CATEGORIES = [
  "Emissions Data",
  "Project Data",
  "Market Research",
  "Regulatory",
  "Client Data",
  "Financial",
  "Other",
];

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/msword": "Word",
  "text/csv": "CSV",
  "text/plain": "Text",
};

function detectCategory(filename: string, mimeType: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() || "";

  if (
    ext === "xlsx" ||
    ext === "csv" ||
    lower.includes("emissions") ||
    lower.includes("energy")
  )
    return "Emissions Data";
  if (
    lower.includes("project") ||
    lower.includes("construction") ||
    lower.includes("mpi")
  )
    return "Project Data";
  if (
    lower.includes("market") ||
    lower.includes("competitor") ||
    lower.includes("analysis")
  )
    return "Market Research";
  if (
    lower.includes("regulation") ||
    lower.includes("policy") ||
    lower.includes("code") ||
    lower.includes("bylaw")
  )
    return "Regulatory";
  if (
    lower.includes("client") ||
    lower.includes("customer") ||
    lower.includes("account")
  )
    return "Client Data";
  if (
    lower.includes("financial") ||
    lower.includes("budget") ||
    lower.includes("cost") ||
    lower.includes("invoice")
  )
    return "Financial";

  return "Other";
}

const CATEGORY_ICONS: Record<string, string> = {
  "Emissions Data": "🌿",
  "Project Data": "🏗️",
  "Market Research": "📈",
  "Regulatory": "⚖️",
  "Client Data": "👤",
  "Financial": "💰",
  "Other": "📁",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VectorizationBadge({
  status,
  chunkCount,
  error,
  onRetry,
}: {
  status: string;
  chunkCount: number;
  error: string | null;
  onRetry: () => void;
}) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Vectorized ({chunkCount} chunks)
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          Processing...
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
          Failed
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="ml-1 underline hover:no-underline font-medium"
          >
            Retry
          </button>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          Pending
        </span>
      );
  }
}

export default function SettingsTab() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSaveStatus, setEmailSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [emailErrorMsg, setEmailErrorMsg] = useState("");

  const { data: documents, refetch: refetchDocuments } =
    trpc.ai.getDocuments.useQuery(undefined, {
      refetchInterval: 5000,
    });

  const { data: conversations } = trpc.ai.getConversations.useQuery();

  const uploadMutation = trpc.ai.uploadDocument.useMutation({
    onSuccess: () => {
      refetchDocuments();
      setUploadError(null);
    },
    onError: (error) => {
      setUploadError(error.message);
    },
  });

  const deleteMutation = trpc.ai.deleteDocument.useMutation({
    onSuccess: () => refetchDocuments(),
  });

  const vectorizeMutation = trpc.ai.vectorizeDocument.useMutation({
    onSuccess: () => refetchDocuments(),
  });

  const deleteAllConversationsMutation = trpc.ai.deleteAllConversations.useMutation({
    onSuccess: () => {
      setConfirmClearHistory(false);
    },
  });

  // Email settings
  const { data: savedEmail } = trpc.ai.getSettings.useQuery({ key: "email_recipient" });
  const emailMutation = trpc.ai.updateSettings.useMutation({
    onSuccess: () => {
      setEmailSaveStatus("saved");
      setTimeout(() => setEmailSaveStatus("idle"), 2000);
    },
    onError: (err) => {
      setEmailSaveStatus("error");
      setEmailErrorMsg(err.message || "Failed to save");
      setTimeout(() => setEmailSaveStatus("idle"), 4000);
    },
  });

  // Keep input in sync when server data arrives
  const emailSynced = useRef(false);
  if (savedEmail && !emailSynced.current) {
    emailSynced.current = true;
    if (!emailInput) setEmailInput(savedEmail);
  }

  // Group documents by category
  const groupedDocuments = useMemo(() => {
    if (!documents) return {};
    const groups: Record<string, typeof documents> = {};
    for (const doc of documents) {
      const cat = doc.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    }
    return groups;
  }, [documents]);

  const toggleFolder = (category: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Stop polling when all docs are in a terminal state
  const hasActiveJobs = documents?.some(
    (d) => d.vectorizationStatus === "pending" || d.vectorizationStatus === "processing"
  );

  const extractTextFromFile = async (file: File): Promise<string> => {
    const mimeType = file.type;

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            let text = "";
            workbook.SheetNames.forEach((sheetName) => {
              const sheet = workbook.Sheets[sheetName];
              text += `\n=== Sheet: ${sheetName} ===\n`;
              text += XLSX.utils.sheet_to_csv(sheet);
            });
            resolve(text);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    if (mimeType === "text/csv" || file.name.endsWith(".csv")) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    if (mimeType === "text/plain") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const JSZip = (await import("jszip")).default;
            const zip = await JSZip.loadAsync(arrayBuffer);
            const xmlContent = await zip
              .file("word/document.xml")
              ?.async("string");
            if (!xmlContent) throw new Error("Could not find document.xml");
            const textContent = xmlContent
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            resolve(textContent);
          } catch {
            resolve(
              `[Word document: ${file.name}]\n\nNote: Full text extraction for Word documents requires server-side processing.`
            );
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    if (mimeType === "application/pdf") {
      return `[PDF Document: ${file.name}]\n\nNote: PDF text extraction requires server-side processing. For best results, use Excel or CSV format.`;
    }

    return `[File: ${file.name}]\n\nUnsupported file type for text extraction.`;
  };

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setUploading(true);
      setUploadError(null);

      for (const file of Array.from(files)) {
        try {
          const content = await extractTextFromFile(file);
          const category =
            selectedCategory || detectCategory(file.name, file.type);
          await uploadMutation.mutateAsync({
            filename: file.name,
            mimeType: file.type,
            content,
            category,
          });
        } catch (error: any) {
          setUploadError(`Error uploading ${file.name}: ${error.message}`);
        }
      }

      setUploading(false);
    },
    [selectedCategory, uploadMutation]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage AI documents and configuration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white rounded-lg border border-black p-6">
          <h3 className="text-lg font-bold mb-4">Upload Documents</h3>
          <p className="text-sm text-gray-500 mb-6">
            Upload documents that the AI can reference when answering questions.
            Supported formats: Excel, Word, PDF, CSV. Files are auto-categorized
            if no category is selected.
          </p>

          {/* Category Selector */}
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-wider font-semibold mb-2">
              Category (Optional — auto-detected if empty)
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:outline-none text-sm"
            >
              <option value="">Auto-detect from filename</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-black bg-gray-100"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="settings-file-upload"
              multiple
              accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              disabled={uploading}
            />

            <div className="text-4xl mb-4">📁</div>

            <label
              htmlFor="settings-file-upload"
              className={`btn btn-primary cursor-pointer ${
                uploading ? "opacity-50" : ""
              }`}
            >
              {uploading ? "Uploading..." : "Choose Files"}
            </label>

            <p className="text-sm text-gray-500 mt-4">
              or drag and drop files here
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {Object.entries(ACCEPTED_TYPES).map(([mime, label]) => (
                <span
                  key={mime}
                  className="px-2 py-1 text-xs bg-gray-100 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"
              >
                {uploadError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Documents List — Folder Grouped */}
        <div className="bg-white rounded-lg border border-black p-6">
          <h3 className="text-lg font-bold mb-4">
            Uploaded Documents ({documents?.length || 0})
          </h3>

          {!documents || documents.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs mt-2">
                Upload documents to give the AI additional context
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {CATEGORIES.filter((cat) => groupedDocuments[cat]?.length > 0).map(
                (cat) => {
                  const docs = groupedDocuments[cat];
                  const isCollapsed = collapsedFolders.has(cat);
                  return (
                    <div key={cat} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Folder Header */}
                      <button
                        onClick={() => toggleFolder(cat)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            isCollapsed ? "" : "rotate-90"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <span className="text-base">
                          {CATEGORY_ICONS[cat] || "📁"}
                        </span>
                        <span className="font-semibold text-sm text-gray-700 flex-1">
                          {cat}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                          {docs.length}
                        </span>
                      </button>

                      {/* Folder Contents */}
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="divide-y divide-gray-100">
                              {docs.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="p-4 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">
                                          {doc.mimetype.includes("excel") ||
                                          doc.mimetype.includes("spreadsheet")
                                            ? "📊"
                                            : doc.mimetype.includes("pdf")
                                            ? "📕"
                                            : doc.mimetype.includes("word")
                                            ? "📝"
                                            : "📄"}
                                        </span>
                                        <h4 className="font-medium text-sm truncate">
                                          {doc.filename}
                                        </h4>
                                      </div>

                                      <div className="flex items-center gap-2 mt-1.5">
                                        <VectorizationBadge
                                          status={doc.vectorizationStatus}
                                          chunkCount={doc.chunkCount}
                                          error={doc.vectorizationError}
                                          onRetry={() =>
                                            vectorizeMutation.mutate({
                                              id: doc.id,
                                            })
                                          }
                                        />
                                      </div>

                                      {doc.vectorizationError && (
                                        <p
                                          className="text-xs text-red-500 mt-1 truncate"
                                          title={doc.vectorizationError}
                                        >
                                          {doc.vectorizationError}
                                        </p>
                                      )}

                                      {doc.summary && (
                                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                          {doc.summary}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                        <span>{formatFileSize(doc.size)}</span>
                                        <span>·</span>
                                        <span>{formatDate(doc.createdAt)}</span>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() =>
                                        deleteMutation.mutate({ id: doc.id })
                                      }
                                      className="text-red-500 hover:text-red-700 p-1"
                                      title="Delete document"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Configuration Section */}
      <div className="mt-8 bg-white rounded-lg border border-black p-6">
        <h3 className="text-lg font-bold mb-4">AI Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Data Sources */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-3">📊 Data Sources</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                BC Community Emissions (221)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Major Projects (830+)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                CleanBC Benchmarks
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Uploaded Documents ({documents?.length || 0})
              </li>
            </ul>
          </div>

          {/* Capabilities */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-3">🚀 Capabilities</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✓ Query emissions & project data</li>
              <li>✓ Analyze market opportunities</li>
              <li>✓ Generate reports & summaries</li>
              <li>✓ Web research (when enabled)</li>
              <li>✓ Reference uploaded documents</li>
              <li>✓ Semantic search via vectorization</li>
            </ul>
          </div>

          {/* API Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-3">⚡ API Status</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Thesys C1</span>
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Model</span>
                <span className="text-xs text-gray-500">c1-nightly</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Web Search</span>
                <span className="text-xs text-gray-500">DuckDuckGo API</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Vectorization</span>
                <span className="text-xs text-gray-500">
                  OpenAI + Pinecone
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Email Reports */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <h4 className="font-semibold text-sm">Email Reports</h4>
              <p className="text-xs text-gray-500 mt-1">
                Set the recipient email for AI-generated reports sent via chat or voice command
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-black focus:outline-none"
              />
              <button
                onClick={() => {
                  if (!emailInput.trim()) return;
                  setEmailSaveStatus("saving");
                  emailMutation.mutate({ key: "email_recipient", value: emailInput.trim() });
                }}
                disabled={emailSaveStatus === "saving" || !emailInput.trim()}
                className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {emailSaveStatus === "saving" ? "Saving..." : emailSaveStatus === "saved" ? "Saved!" : "Save"}
              </button>
              {emailSaveStatus === "error" && (
                <span className="text-xs text-red-600">{emailErrorMsg || "Failed to save"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Clear Chat History */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">Clear Chat History</h4>
              <p className="text-xs text-gray-500 mt-1">
                {conversations?.length
                  ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""} stored`
                  : "No conversations stored"}
              </p>
            </div>
            {!confirmClearHistory ? (
              <button
                onClick={() => setConfirmClearHistory(true)}
                disabled={!conversations?.length}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear All History
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Are you sure?</span>
                <button
                  onClick={() => deleteAllConversationsMutation.mutate()}
                  className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, delete all
                </button>
                <button
                  onClick={() => setConfirmClearHistory(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
