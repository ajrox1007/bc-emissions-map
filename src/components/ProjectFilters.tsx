"use client";

import { useState, useMemo } from "react";
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
  selectedMunicipalities: string[];
  onMunicipalitiesChange: (municipalities: string[]) => void;
  selectedRegions: string[];
  onRegionsChange: (regions: string[]) => void;
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

// Developer categorization based on common patterns
const DEVELOPER_CATEGORIES: Record<string, string[]> = {
  "Engineering/Infrastructure": [
    "BC Hydro", "Fortis", "TransCanada", "Enbridge", "Kinder Morgan", 
    "Trans Mountain", "Coastal GasLink", "ATCO", "AltaGas", "FortisBC",
    "Pacific Northern Gas", "Spectra Energy", "Terasen", "Pembina",
    "Westcoast Energy", "Alliance Pipeline", "NOVA Gas", "PNG",
    "BC Transmission", "Powerex", "Site C", "Hydro", "Pipeline",
    "Transmission", "Energy", "Power", "Utility", "Electric"
  ],
  "Utility Companies": [
    "Metro Vancouver", "City of", "District of", "Regional District",
    "Municipality", "Town of", "Village of", "Township", "Greater",
    "Capital Regional", "Fraser Valley", "Water", "Sewer", "Waste",
    "Transit", "Transportation", "TransLink", "BC Transit"
  ],
  "Mixed-Use Developers": [
    "Concord Pacific", "Westbank", "Bosa", "Onni", "Polygon", "Ledcor",
    "Anthem", "Aquilini", "Beedie", "Concert", "Cressey", "Darwin",
    "Intracorp", "Mosaic", "PCI", "Pinnacle", "Townline", "Wall",
    "Wesgroup", "Chard", "Adera", "Marcon", "Rize", "Reliance",
    "Qualex", "Shape", "PC Urban", "Aragon", "Listraor", "Amacon",
    "Development", "Properties", "Homes", "Developments", "Realty"
  ],
  "Specialized Operators": [
    "LNG Canada", "Woodfibre", "Tilbury", "FID", "Pacific NorthWest",
    "Chevron", "Shell", "Imperial", "Suncor", "Husky", "Canadian Natural",
    "Teck", "Rio Tinto", "BHP", "Glencore", "First Quantum", "Copper Mountain",
    "Mining", "Resources", "Minerals", "Oil", "Gas", "LNG", "Refinery",
    "Terminal", "Port", "Industrial", "Manufacturing", "Processing"
  ],
};

function categorizeDeveloper(name: string): string {
  const upperName = name.toUpperCase();
  
  for (const [category, keywords] of Object.entries(DEVELOPER_CATEGORIES)) {
    for (const keyword of keywords) {
      if (upperName.includes(keyword.toUpperCase())) {
        return category;
      }
    }
  }
  return "Other";
}

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
  selectedMunicipalities,
  onMunicipalitiesChange,
  selectedRegions,
  onRegionsChange,
  onReset,
}: ProjectFiltersProps) {
  const { data: filterOptions } = trpc.getProjectFilterOptions.useQuery();
  const [developerSearch, setDeveloperSearch] = useState("");
  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showAllMunicipalities, setShowAllMunicipalities] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [minInputValue, setMinInputValue] = useState(minCost.toString());
  const [maxInputValue, setMaxInputValue] = useState(maxCost >= MAX_PROJECT_VALUE ? "" : maxCost.toString());

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

  const toggleMunicipality = (municipality: string) => {
    if (selectedMunicipalities.includes(municipality)) {
      onMunicipalitiesChange(selectedMunicipalities.filter((m) => m !== municipality));
    } else {
      onMunicipalitiesChange([...selectedMunicipalities, municipality]);
    }
  };

  const toggleRegion = (region: string) => {
    if (selectedRegions.includes(region)) {
      onRegionsChange(selectedRegions.filter((r) => r !== region));
    } else {
      onRegionsChange([...selectedRegions, region]);
    }
  };

  const toggleCategory = (category: string) => {
    if (expandedCategories.includes(category)) {
      setExpandedCategories(expandedCategories.filter((c) => c !== category));
    } else {
      setExpandedCategories([...expandedCategories, category]);
    }
  };

  // Categorize developers
  const categorizedDevelopers = useMemo(() => {
    const developers = filterOptions?.topDevelopers || [];
    const categories: Record<string, typeof developers> = {
      "Engineering/Infrastructure": [],
      "Utility Companies": [],
      "Mixed-Use Developers": [],
      "Specialized Operators": [],
      "Other": [],
    };

    developers.forEach((dev) => {
      const category = categorizeDeveloper(dev.name);
      categories[category].push(dev);
    });

    return categories;
  }, [filterOptions?.topDevelopers]);

  // Filter developers by search
  const filteredDevelopers = useMemo(() => {
    if (!developerSearch) return categorizedDevelopers;
    
    const search = developerSearch.toLowerCase();
    const filtered: Record<string, { name: string; count: number }[]> = {};
    
    for (const [category, devs] of Object.entries(categorizedDevelopers)) {
      const matchingDevs = devs.filter((d) => 
        d.name.toLowerCase().includes(search)
      );
      if (matchingDevs.length > 0) {
        filtered[category] = matchingDevs;
      }
    }
    
    return filtered;
  }, [categorizedDevelopers, developerSearch]);

  // Filter municipalities by search
  const filteredMunicipalities = useMemo(() => {
    const municipalities = filterOptions?.municipalities || [];
    if (!municipalitySearch) return municipalities;
    return municipalities.filter((m) => 
      m.name.toLowerCase().includes(municipalitySearch.toLowerCase())
    );
  }, [filterOptions?.municipalities, municipalitySearch]);

  const displayedMunicipalities = showAllMunicipalities 
    ? filteredMunicipalities 
    : filteredMunicipalities.slice(0, 15);

  const displayedRegions = showAllRegions
    ? filterOptions?.regions || []
    : (filterOptions?.regions || []).slice(0, 8);

  // Handle text input for min/max
  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinInputValue(e.target.value);
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxInputValue(e.target.value);
  };

  const handleMinInputBlur = () => {
    const value = parseInt(minInputValue) || 0;
    const clampedValue = Math.min(Math.max(0, value), maxCost);
    setMinInputValue(clampedValue.toString());
    onCostRangeChange(clampedValue, maxCost);
  };

  const handleMaxInputBlur = () => {
    const value = maxInputValue === "" ? MAX_PROJECT_VALUE : parseInt(maxInputValue) || MAX_PROJECT_VALUE;
    const clampedValue = Math.max(minCost, Math.min(value, MAX_PROJECT_VALUE));
    setMaxInputValue(clampedValue >= MAX_PROJECT_VALUE ? "" : clampedValue.toString());
    onCostRangeChange(minCost, clampedValue);
  };

  const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseInt(e.target.value);
    if (newMin <= maxCost) {
      onCostRangeChange(newMin, maxCost);
      setMinInputValue(newMin.toString());
    }
  };

  const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseInt(e.target.value);
    if (newMax >= minCost) {
      onCostRangeChange(minCost, newMax);
      setMaxInputValue(newMax >= MAX_PROJECT_VALUE ? "" : newMax.toString());
    }
  };

  const minPercent = (minCost / MAX_PROJECT_VALUE) * 100;
  const maxPercent = (maxCost / MAX_PROJECT_VALUE) * 100;

  const totalDevelopers = filterOptions?.topDevelopers?.length || 0;

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
          
          {/* Text inputs for min/max */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Min ($M)</label>
              <input
                type="number"
                value={minInputValue}
                onChange={handleMinInputChange}
                onBlur={handleMinInputBlur}
                onKeyDown={(e) => e.key === "Enter" && handleMinInputBlur()}
                placeholder="0"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-black focus:outline-none"
              />
            </div>
            <span className="text-gray-400 mt-4">—</span>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Max ($M)</label>
              <input
                type="number"
                value={maxInputValue}
                onChange={handleMaxInputChange}
                onBlur={handleMaxInputBlur}
                onKeyDown={(e) => e.key === "Enter" && handleMaxInputBlur()}
                placeholder="Any"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {/* Dual range slider - separate sliders */}
          <div className="relative h-8 mb-2">
            {/* Track background */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full" />
            
            {/* Active track */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 bg-black rounded-full pointer-events-none"
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
              step={100}
              value={minCost}
              onChange={handleMinSliderChange}
              className="absolute w-full h-8 appearance-none bg-transparent cursor-pointer z-30"
              style={{
                WebkitAppearance: "none",
                pointerEvents: "auto",
              }}
            />

            {/* Max slider */}
            <input
              type="range"
              min={0}
              max={MAX_PROJECT_VALUE}
              step={100}
              value={maxCost}
              onChange={handleMaxSliderChange}
              className="absolute w-full h-8 appearance-none bg-transparent cursor-pointer z-20"
              style={{
                WebkitAppearance: "none",
                pointerEvents: "auto",
              }}
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
          <div className="grid grid-cols-3 gap-1 mt-3">
            <button
              onClick={() => {
                onCostRangeChange(0, MAX_PROJECT_VALUE);
                setMinInputValue("0");
                setMaxInputValue("");
              }}
              className={`btn text-xs py-1 ${minCost === 0 && maxCost === MAX_PROJECT_VALUE ? "btn-primary" : ""}`}
            >
              All
            </button>
            <button
              onClick={() => {
                onCostRangeChange(100, 500);
                setMinInputValue("100");
                setMaxInputValue("500");
              }}
              className={`btn text-xs py-1 ${minCost === 100 && maxCost === 500 ? "btn-primary" : ""}`}
            >
              $100-500M
            </button>
            <button
              onClick={() => {
                onCostRangeChange(1000, MAX_PROJECT_VALUE);
                setMinInputValue("1000");
                setMaxInputValue("");
              }}
              className={`btn text-xs py-1 ${minCost === 1000 && maxCost === MAX_PROJECT_VALUE ? "btn-primary" : ""}`}
            >
              $1B+
            </button>
          </div>
        </div>

        {/* Economic Region */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Economic Region
          </h4>
          <div className="space-y-2">
            {displayedRegions.map((region) => (
              <label
                key={region.name}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.length === 0 || selectedRegions.includes(region.name)}
                  onChange={() => toggleRegion(region.name)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-sm truncate group-hover:font-medium">
                    {region.name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {region.count}
                  </span>
                </div>
              </label>
            ))}
          </div>
          {filterOptions && (filterOptions.regions?.length || 0) > 8 && (
            <button
              onClick={() => setShowAllRegions(!showAllRegions)}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              {showAllRegions ? "Show Less" : `Show All (${filterOptions.regions?.length})`}
            </button>
          )}
        </div>

        {/* Municipality */}
        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Municipality
          </h4>
          <input
            type="text"
            placeholder="Search municipalities..."
            value={municipalitySearch}
            onChange={(e) => setMunicipalitySearch(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2 focus:border-black focus:outline-none"
          />
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {displayedMunicipalities.map((muni) => (
              <label
                key={muni.name}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selectedMunicipalities.length === 0 || selectedMunicipalities.includes(muni.name)}
                  onChange={() => toggleMunicipality(muni.name)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-sm truncate group-hover:font-medium">
                    {muni.name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {muni.count}
                  </span>
                </div>
              </label>
            ))}
          </div>
          {filteredMunicipalities.length > 15 && (
            <button
              onClick={() => setShowAllMunicipalities(!showAllMunicipalities)}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              {showAllMunicipalities ? "Show Less" : `Show All (${filteredMunicipalities.length})`}
            </button>
          )}
        </div>

        {/* Developers - Categorized */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold">
              Developer ({totalDevelopers})
            </h4>
          </div>
          
          <input
            type="text"
            placeholder="Search developers..."
            value={developerSearch}
            onChange={(e) => setDeveloperSearch(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-3 focus:border-black focus:outline-none"
          />

          <div className="space-y-3">
            {Object.entries(filteredDevelopers).map(([category, devs]) => {
              if (devs.length === 0) return null;
              const isExpanded = expandedCategories.includes(category) || developerSearch.length > 0;
              
              return (
                <div key={category} className="border border-gray-200 rounded">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50"
                  >
                    <span className="text-xs font-medium">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{devs.length}</span>
                      <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 pt-0 space-y-1 max-h-40 overflow-y-auto">
                          {devs.map((dev) => (
                            <label
                              key={dev.name}
                              className="flex items-center gap-2 cursor-pointer group text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDevelopers.includes(dev.name)}
                                onChange={() => toggleDeveloper(dev.name)}
                                className="w-3 h-3 rounded border-gray-300"
                              />
                              <span className="truncate flex-1 group-hover:font-medium">
                                {dev.name}
                              </span>
                              <span className="text-gray-400">{dev.count}</span>
                            </label>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      <AnimatePresence>
        {(selectedTypes.length > 0 ||
          selectedStatuses.length > 0 ||
          minCost > 0 ||
          maxCost < MAX_PROJECT_VALUE ||
          selectedDevelopers.length > 0 ||
          selectedMunicipalities.length > 0 ||
          selectedRegions.length > 0) && (
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
              {selectedRegions.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-amber-600 text-white rounded">
                  {selectedRegions.length} Region{selectedRegions.length > 1 ? "s" : ""}
                </span>
              )}
              {selectedMunicipalities.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">
                  {selectedMunicipalities.length} Municipalit{selectedMunicipalities.length > 1 ? "ies" : "y"}
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
