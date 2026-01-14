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
  onMinCostChange: (cost: number) => void;
  selectedDevelopers: string[];
  onDevelopersChange: (developers: string[]) => void;
  onReset: () => void;
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
  onMinCostChange,
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

  const costOptions = [
    { value: 0, label: "All Projects" },
    { value: 50, label: "$50M+" },
    { value: 100, label: "$100M+" },
    { value: 250, label: "$250M+" },
    { value: 500, label: "$500M+" },
    { value: 1000, label: "$1B+" },
  ];

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

        {/* Minimum Project Value */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Minimum Value
          </h4>
          <div className="space-y-2">
            {costOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="radio"
                  name="minCost"
                  checked={minCost === option.value}
                  onChange={() => onMinCostChange(option.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm group-hover:font-medium">
                  {option.label}
                </span>
              </label>
            ))}
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
              {minCost > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                  ${minCost >= 1000 ? `${minCost / 1000}B` : `${minCost}M`}+
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

