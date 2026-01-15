"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import * as XLSX from "xlsx";

interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  summary: string | null;
  category: string | null;
  createdAt: string;
}

const CATEGORIES = [
  "Emissions Data",
  "Project Data",
  "Market Research",
  "Regulatory",
  "Client Data",
  "Financial",
  "Other",
];

const ACCEPTED_TYPES = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/msword": "Word",
  "text/csv": "CSV",
  "text/plain": "Text",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);

  const { data: documents, refetch: refetchDocuments } = trpc.ai.getDocuments.useQuery();
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

  const extractTextFromFile = async (file: File): Promise<string> => {
    const mimeType = file.type;

    // Handle Excel files
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
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

    // Handle CSV files
    if (mimeType === "text/csv" || file.name.endsWith(".csv")) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    // Handle text files
    if (mimeType === "text/plain") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    // Handle Word documents (basic text extraction)
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      // For Word docs, we'll extract as much text as possible client-side
      // In a production app, you'd use a server-side library like mammoth
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            // Simple extraction for .docx files
            const text = await extractDocxText(arrayBuffer);
            resolve(text);
          } catch (err) {
            resolve(`[Word document: ${file.name}]\n\nNote: Full text extraction for Word documents requires server-side processing. The AI will have limited access to this document's content.`);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    // Handle PDF files
    if (mimeType === "application/pdf") {
      // PDF extraction typically needs server-side processing
      return `[PDF Document: ${file.name}]\n\nNote: PDF text extraction requires server-side processing. The AI will have limited access to this document's content. For best results, use Excel or CSV format.`;
    }

    return `[File: ${file.name}]\n\nUnsupported file type for text extraction.`;
  };

  // Simple DOCX text extraction
  const extractDocxText = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(arrayBuffer);
      const xmlContent = await zip.file("word/document.xml")?.async("string");
      
      if (!xmlContent) {
        throw new Error("Could not find document.xml");
      }

      // Basic XML text extraction
      const textContent = xmlContent
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return textContent;
    } catch (error) {
      throw error;
    }
  };

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setUploading(true);
      setUploadError(null);

      for (const file of Array.from(files)) {
        try {
          const content = await extractTextFromFile(file);

          await uploadMutation.mutateAsync({
            filename: file.name,
            mimeType: file.type,
            content,
            category: selectedCategory || undefined,
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-black">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/"
                className="text-xs uppercase tracking-wider hover:underline"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold mt-2">Settings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage AI documents and configuration
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-lg border border-black p-6">
            <h2 className="text-lg font-bold mb-4">Upload Documents</h2>
            <p className="text-sm text-gray-500 mb-6">
              Upload documents that the AI can reference when answering questions.
              Supported formats: Excel, Word, PDF, CSV.
            </p>

            {/* Category Selector */}
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-wider font-semibold mb-2">
                Category (Optional)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:outline-none text-sm"
              >
                <option value="">Select a category...</option>
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
                id="file-upload"
                multiple
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                disabled={uploading}
              />

              <div className="text-4xl mb-4">📁</div>

              <label
                htmlFor="file-upload"
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

          {/* Documents List */}
          <div className="bg-white rounded-lg border border-black p-6">
            <h2 className="text-lg font-bold mb-4">
              Uploaded Documents ({documents?.length || 0})
            </h2>

            {!documents || documents.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-4">📄</div>
                <p className="text-sm">No documents uploaded yet</p>
                <p className="text-xs mt-2">
                  Upload documents to give the AI additional context
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {doc.mimeType.includes("excel") || doc.mimeType.includes("spreadsheet")
                              ? "📊"
                              : doc.mimeType.includes("pdf")
                              ? "📕"
                              : doc.mimeType.includes("word")
                              ? "📝"
                              : "📄"}
                          </span>
                          <h3 className="font-medium text-sm truncate">
                            {doc.filename}
                          </h3>
                        </div>

                        {doc.category && (
                          <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 rounded mt-1">
                            {doc.category}
                          </span>
                        )}

                        {doc.summary && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {doc.summary}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span>{formatDate(doc.createdAt)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteMutation.mutate({ id: doc.id })}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Configuration Section */}
        <div className="mt-8 bg-white rounded-lg border border-black p-6">
          <h2 className="text-lg font-bold mb-4">AI Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Data Sources */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-sm mb-3">📊 Data Sources</h3>
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
              <h3 className="font-semibold text-sm mb-3">🚀 Capabilities</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Query emissions & project data</li>
                <li>✓ Analyze market opportunities</li>
                <li>✓ Generate reports & summaries</li>
                <li>✓ Web research (when enabled)</li>
                <li>✓ Reference uploaded documents</li>
              </ul>
            </div>

            {/* API Status */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-sm mb-3">⚡ API Status</h3>
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

