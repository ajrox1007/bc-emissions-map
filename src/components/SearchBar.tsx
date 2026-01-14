"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface SearchBarProps {
  onSelectCommunity: (communityId: string) => void;
  placeholder?: string;
  className?: string;
}

function formatEmissions(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

export default function SearchBar({
  onSelectCommunity,
  placeholder = "Search communities...",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = trpc.searchCommunities.useQuery(
    { query, limit: 10 },
    { enabled: query.length >= 2 }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (communityId: string) => {
    onSelectCommunity(communityId);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-4 py-2 border-2 border-black bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
        />
        {/* Search icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Searching...
              </div>
            ) : results && results.length > 0 ? (
              <ul>
                {results.map((community, index) => (
                  <li key={community.id}>
                    <button
                      onClick={() => handleSelect(community.id)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{community.orgName}</p>
                          <p className="text-xs text-gray-500">
                            {formatEmissions(community.totalEmissions)} TCO₂e total
                          </p>
                        </div>
                        <div className="text-right">
                          {community.hasLocation ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700">
                              📍 Map
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500">
                              No location
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400">
                        <span>Res: {formatEmissions(community.resEmissions)}</span>
                        <span>Com: {formatEmissions(community.csmiEmissions)}</span>
                        <span>Mix: {formatEmissions(community.mixedEmissions)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                No communities found for &quot;{query}&quot;
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

