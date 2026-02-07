"use client";

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";

interface ColumnMapping {
  [header: string]: string;
}

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: string[][];
}

const STANDARD_FIELDS = [
  { value: "name", label: "Name" },
  { value: "latitude", label: "Latitude" },
  { value: "longitude", label: "Longitude" },
  { value: "address", label: "Address / City" },
  { value: "category", label: "Category" },
  { value: "status", label: "Status" },
  { value: "estimatedCost", label: "Cost / Value" },
  { value: "description", label: "Description" },
  { value: "skip", label: "Skip" },
];

function getMappingLabel(value: string): string {
  const found = STANDARD_FIELDS.find((f) => f.value === value);
  if (found) return found.label;
  if (value.startsWith("metadata:")) return "Extra data";
  return value;
}

function getMappingColor(value: string): string {
  if (value === "name") return "bg-blue-100 text-blue-700";
  if (value === "address") return "bg-green-100 text-green-700";
  if (value === "estimatedCost") return "bg-amber-100 text-amber-700";
  if (value === "category") return "bg-purple-100 text-purple-700";
  if (value === "latitude" || value === "longitude") return "bg-cyan-100 text-cyan-700";
  if (value === "status") return "bg-orange-100 text-orange-700";
  if (value === "skip") return "bg-red-50 text-red-400";
  if (value.startsWith("metadata:")) return "bg-gray-100 text-gray-500";
  return "bg-gray-100 text-gray-600";
}

export default function CustomProjectsUpload({
  onUploadComplete,
}: {
  onUploadComplete?: () => void;
}) {
  const [step, setStep] = useState<"idle" | "preview" | "mapping" | "saving">("idle");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [rawContent, setRawContent] = useState<string>("");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAI = trpc.ai.parseProjectUpload.useMutation();
  const saveProjects = trpc.ai.saveCustomProjects.useMutation();
  const utils = trpc.useUtils();

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    setStep("preview");
    setFilename(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];

      const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (jsonData.length < 2) {
        setError("File must have at least a header row and one data row.");
        setStep("idle");
        return;
      }

      const headers = jsonData[0].map((h) => String(h || "").trim()).filter(Boolean);
      const dataRows = jsonData.slice(1).filter((row) =>
        row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "")
      );

      const csv = XLSX.utils.sheet_to_csv(sheet);
      setRawContent(csv);

      const rows = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = String(row[i] ?? "");
        });
        return obj;
      });

      const sampleRows = dataRows.slice(0, 3).map((row) =>
        headers.map((_, i) => String(row[i] ?? ""))
      );

      setParsedData({ headers, rows, sampleRows });

      // Auto-detect columns via AI
      try {
        const result = await parseAI.mutateAsync({ headers, sampleRows });
        const mapping: ColumnMapping = {};
        for (const [header, field] of Object.entries(result.mapping)) {
          mapping[header] = field;
        }
        headers.forEach((h) => {
          if (!mapping[h]) mapping[h] = `metadata:${h}`;
        });
        setColumnMapping(mapping);
      } catch {
        const fallback: ColumnMapping = {};
        headers.forEach((h) => {
          fallback[h] = `metadata:${h}`;
        });
        setColumnMapping(fallback);
      }

      setStep("mapping");
    } catch (err: any) {
      setError(err.message || "Failed to parse file");
      setStep("idle");
    }
  }, [parseAI]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleMappingChange = (header: string, value: string) => {
    setColumnMapping((prev) => ({ ...prev, [header]: value }));
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    setStep("saving");
    setError(null);

    try {
      await saveProjects.mutateAsync({
        filename,
        columnMapping,
        rows: parsedData.rows,
        rawContent,
      });

      utils.ai.getCustomProjectFiles.invalidate();
      utils.ai.getCustomProjects.invalidate();
      utils.ai.getCustomProjectStats.invalidate();

      setParsedData(null);
      setColumnMapping({});
      setRawContent("");
      setFilename("");
      setStep("idle");
      onUploadComplete?.();
    } catch (err: any) {
      setError(err.message || "Failed to save projects");
      setStep("mapping");
    }
  };

  const handleCancel = () => {
    setParsedData(null);
    setColumnMapping({});
    setRawContent("");
    setFilename("");
    setError(null);
    setStep("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      {step === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs font-medium text-gray-700">Drop CSV or Excel file</p>
          <p className="text-[10px] text-gray-400 mt-0.5">or click to browse</p>
        </div>
      )}

      {/* Loading State */}
      {step === "preview" && (
        <div className="card p-5 text-center">
          <div className="w-5 h-5 border-2 border-black border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-600">Detecting columns with AI...</p>
        </div>
      )}

      {/* Column Mapping */}
      {step === "mapping" && parsedData && (
        <div className="space-y-3">
          {/* File info */}
          <div className="card p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{filename}</p>
                <p className="text-[10px] text-gray-400">
                  {parsedData.rows.length} rows &middot; {parsedData.headers.length} columns
                </p>
              </div>
            </div>
          </div>

          {/* Column mapping cards */}
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Column Mapping
            </p>
            <div className="space-y-1.5">
              {parsedData.headers.map((header, idx) => {
                const mappedTo = columnMapping[header] || `metadata:${header}`;
                return (
                  <div key={header} className="bg-white border border-gray-200 rounded-md p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-gray-800 truncate">{header}</span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${getMappingColor(mappedTo)}`}>
                        {getMappingLabel(mappedTo)}
                      </span>
                    </div>
                    <select
                      value={mappedTo}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className="w-full text-[11px] py-1 px-1.5 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      {STANDARD_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                      <option value={`metadata:${header}`}>
                        Extra: {header}
                      </option>
                    </select>
                    {parsedData.sampleRows[0]?.[idx] && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate" title={parsedData.sampleRows[0][idx]}>
                        e.g. {parsedData.sampleRows[0][idx]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 sticky bottom-0 bg-white pt-2 pb-1 border-t border-gray-100">
            <button onClick={handleCancel} className="btn text-xs flex-1">
              Cancel
            </button>
            <button onClick={handleConfirm} className="btn btn-primary text-xs flex-1">
              Import {parsedData.rows.length} rows
            </button>
          </div>
        </div>
      )}

      {/* Saving State */}
      {step === "saving" && (
        <div className="card p-5 text-center">
          <div className="w-5 h-5 border-2 border-black border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-600">Saving & geocoding...</p>
          <p className="text-[10px] text-gray-400 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] p-2.5 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
