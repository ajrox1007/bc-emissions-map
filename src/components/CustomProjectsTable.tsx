"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";

interface CustomProject {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  category: string | null;
  status: string | null;
  estimatedCost: number | null;
  metadata: string | null;
  file: { filename: string };
}

type SortKey = "name" | "category" | "status" | "estimatedCost" | "address";
type SortDir = "asc" | "desc";

function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  if (cost >= 1_000_000_000) return `$${(cost / 1_000_000_000).toFixed(1)}B`;
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(1)}K`;
  return `$${cost.toLocaleString()}`;
}

export default function CustomProjectsTable({
  projects,
}: {
  projects: CustomProject[];
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filtered = useMemo(() => {
    let result = projects;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.address || "").toLowerCase().includes(q) ||
          (p.status || "").toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (av === null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv === null) bv = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [projects, search, sortKey, sortDir]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const handleExport = () => {
    const data = filtered.map((p) => {
      const base: Record<string, any> = {
        Name: p.name,
        Category: p.category || "",
        Status: p.status || "",
        "Estimated Cost": p.estimatedCost ?? "",
        Address: p.address || "",
        Latitude: p.latitude ?? "",
        Longitude: p.longitude ?? "",
        Source: p.file.filename,
      };
      // Add metadata fields
      if (p.metadata) {
        try {
          const meta = JSON.parse(p.metadata);
          Object.entries(meta).forEach(([k, v]) => {
            base[k] = String(v);
          });
        } catch {}
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custom Projects");
    XLSX.writeFile(wb, "custom_projects_export.csv");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="input text-xs pl-8 w-64"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-xs text-gray-500">
            {filtered.length} project{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button onClick={handleExport} className="btn text-xs flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {([
                ["name", "Name"],
                ["category", "Category"],
                ["status", "Status"],
                ["estimatedCost", "Cost"],
                ["address", "Address"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="text-left px-3 py-2.5 font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-black select-none whitespace-nowrap"
                >
                  {label} <span className="text-gray-300 ml-1">{sortIcon(key)}</span>
                </th>
              ))}
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Coords
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  {search ? "No matching projects" : "No custom projects uploaded yet"}
                </td>
              </tr>
            ) : (
              paged.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={p.name}>
                    {p.name}
                  </td>
                  <td className="px-3 py-2">
                    {p.category ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium">
                        {p.category}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.status || "—"}</td>
                  <td className="px-3 py-2 font-medium">{formatCost(p.estimatedCost)}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={p.address || ""}>
                    {p.address || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.latitude && p.longitude ? (
                      <span className="text-green-600" title={`${p.latitude}, ${p.longitude}`}>
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-300">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400 max-w-[150px] truncate" title={p.file.filename}>
                    {p.file.filename}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn text-xs disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn text-xs disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
