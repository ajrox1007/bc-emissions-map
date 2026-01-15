"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface ProjectFiltersProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  minCost: number;
  maxCost: number;
  onCostRangeChange: (min: number, max: number) => void;
  selectedDevelopers: string[];
  onDevelopersChange: (developers: string[]) => void;
  onReset: () => void;
}

const MAX_PROJECT_VALUE = 25000; // $25B in millions

function formatCostLabel(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}B`;
  }
  return `$${value}M`;
}

const TYPE_COLORS: Record<string, string> = {
  "Residential": "bg-emerald-500",
  "Commercial": "bg-blue-500",
  "Infrastructure": "bg-amber-500",
  "Institutional": "bg-violet-500",
  "Industrial": "bg-red-500",
};

export default function ProjectFilters({
  selectedTypes,
  onTypesChange,
  selectedStatuses,
  onStatusesChange,
  minCost,
  maxCost,
  onCostRangeChange,
  selectedDevelopers,
  onDevelopersChange,
  onReset,
}: ProjectFiltersProps) {
  const { data: filterOptions } = trpc.getProjectFilterOptions.useQuery();
  const [showAllDevelopers, setShowAllDevelopers] = useState(false);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  const toggleDeveloper = (developer: string) => {
    if (selectedDevelopers.includes(developer)) {
      onDevelopersChange(selectedDevelopers.filter((d) => d !== developer));
    } else {
      onDevelopersChange([...selectedDevelopers, developer]);
    }
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseInt(e.target.value);
    if (newMin <= maxCost) {
      onCostRangeChange(newMin, maxCost);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseInt(e.target.value);
    if (newMax >= minCost) {
      onCostRangeChange(minCost, newMax);
    }
  };

  const minPercent = (minCost / MAX_PROJECT_VALUE) * 100;
  const maxPercent = (maxCost / MAX_PROJECT_VALUE) * 100;

  const displayedDevelopers = showAllDevelopers
    ? filterOptions?.topDevelopers || []
    : (filterOptions?.topDevelopers || []).slice(0, 10);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-black">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-bold">
            Project Filters
          </h3>
          <button
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-black underline"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Construction Type */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Construction Type
          </h4>
          <div className="space-y-2">
            {filterOptions?.constructionTypes.map((type) => (
              <label
                key={type}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.length === 0 || selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-3 h-3 rounded ${TYPE_COLORS[type] || "bg-gray-400"}`}
                  />
                  <span className="text-sm group-hover:font-medium">{type}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Project Status */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Project Status
          </h4>
          <div className="space-y-2">
            {filterOptions?.projectStatuses.map((status) => (
              <label
                key={status}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selectedStatuses.length === 0 || selectedStatuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm group-hover:font-medium">{status}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Project Value Range */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Project Value Range
          </h4>
          
          {/* Value display */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium">{formatCostLabel(minCost)}</span>
            <span className="text-xs text-gray-400">to</span>
            <span className="text-sm font-medium">
              {maxCost >= MAX_PROJECT_VALUE ? "Any" : formatCostLabel(maxCost)}
            </span>
          </div>

          {/* Dual range slider */}
          <div className="relative h-6 mb-2">
            {/* Track background */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full" />
            
            {/* Active track */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 bg-black rounded-full"
              style={{
                left: `${minPercent}%`,
                right: `${100 - maxPercent}%`,
              }}
            />

            {/* Min slider */}
            <input
              type="range"
              min={0}
              max={MAX_PROJECT_VALUE}
              step={50}
              value={minCost}
              onChange={handleMinChange}
              className="absolute w-full h-6 opacity-0 cursor-pointer z-20"
              style={{ pointerEvents: "auto" }}
            />

            {/* Max slider */}
            <input
              type="range"
              min={0}
              max={MAX_PROJECT_VALUE}
              step={50}
              value={maxCost}
              onChange={handleMaxChange}
              className="absolute w-full h-6 opacity-0 cursor-pointer z-20"
              style={{ pointerEvents: "auto" }}
            />

            {/* Min thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow pointer-events-none z-10"
              style={{ left: `calc(${minPercent}% - 8px)` }}
            />

            {/* Max thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow pointer-events-none z-10"
              style={{ left: `calc(${maxPercent}% - 8px)` }}
            />
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$0</span>
            <span>$5B</span>
            <span>$10B</span>
            <span>$15B</span>
            <span>$25B+</span>
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-3 gap-1 mt-4">
            <button
              onClick={() => onCostRangeChange(0, MAX_PROJECT_VALUE)}
              className={`btn text-xs py-1 ${minCost === 0 && maxCost === MAX_PROJECT_VALUE ? "btn-primary" : ""}`}
            >
              All
            </button>
            <button
              onClick={() => onCostRangeChange(100, 500)}
              className={`btn text-xs py-1 ${minCost === 100 && maxCost === 500 ? "btn-primary" : ""}`}
            >
              $100-500M
            </button>
            <button
              onClick={() => onCostRangeChange(1000, MAX_PROJECT_VALUE)}
              className={`btn text-xs py-1 ${minCost === 1000 && maxCost === MAX_PROJECT_VALUE ? "btn-primary" : ""}`}
            >
              $1B+
            </button>
          </div>
        </div>

        {/* Top Developers */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Developer
          </h4>
          <div className="space-y-2">
            {displayedDevelopers.map((dev) => (
              <label
                key={dev.name}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selectedDevelopers.length === 0 || selectedDevelopers.includes(dev.name)}
                  onChange={() => toggleDeveloper(dev.name)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-sm truncate group-hover:font-medium">
                    {dev.name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {dev.count}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {filterOptions && filterOptions.topDevelopers.length > 10 && (
            <button
              onClick={() => setShowAllDevelopers(!showAllDevelopers)}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              {showAllDevelopers
                ? "Show Less"
                : `Show All (${filterOptions.topDevelopers.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Summary */}
      <AnimatePresence>
        {(selectedTypes.length > 0 ||
          selectedStatuses.length > 0 ||
          minCost > 0 ||
          maxCost < MAX_PROJECT_VALUE ||
          selectedDevelopers.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 border-t border-gray-200 bg-gray-50"
          >
            <div className="text-xs text-gray-500 mb-2">Active Filters:</div>
            <div className="flex flex-wrap gap-1">
              {selectedTypes.map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 text-xs bg-black text-white rounded"
                >
                  {type}
                </span>
              ))}
              {selectedStatuses.map((status) => (
                <span
                  key={status}
                  className="px-2 py-0.5 text-xs bg-gray-700 text-white rounded"
                >
                  {status}
                </span>
              ))}
              {(minCost > 0 || maxCost < MAX_PROJECT_VALUE) && (
                <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                  {formatCostLabel(minCost)} - {maxCost >= MAX_PROJECT_VALUE ? "Any" : formatCostLabel(maxCost)}
                </span>
              )}
              {selectedDevelopers.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded">
                  {selectedDevelopers.length} Developer{selectedDevelopers.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

