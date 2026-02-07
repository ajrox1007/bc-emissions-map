"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import EmissionsMap from "@/components/EmissionsMap";
import FilterControls from "@/components/FilterControls";
import CommunityDetail from "@/components/CommunityDetail";
import Dashboard from "@/components/Dashboard";
import ConversionOpportunities from "@/components/ConversionOpportunities";
import RebateCalculator from "@/components/RebateCalculator";
import SearchBar from "@/components/SearchBar";
import ProjectsMap from "@/components/ProjectsMap";
import ProjectFilters from "@/components/ProjectFilters";
import ProjectDetail from "@/components/ProjectDetail";
import AIChatbot from "@/components/AIChatbot";
import CompetitiveIntelligence from "@/components/CompetitiveIntelligence";
import SettingsTab from "@/components/SettingsTab";
import CallHistory from "@/components/CallHistory";
import CustomProjectsUpload from "@/components/CustomProjectsUpload";
import CustomProjectsMap from "@/components/CustomProjectsMap";
import CustomProjectsTable from "@/components/CustomProjectsTable";

type Segment = "Res" | "CSMI" | "MIXED";
type ViewMode = "maps" | "dashboard" | "opportunities" | "rebates" | "intelligence" | "calls" | "settings";
type MapType = "emissions" | "projects" | "custom";
type EnergySourceFilter = "all" | "fossilHeavy" | "electricHeavy" | "electricDominant";

const DEFAULT_THRESHOLD = 10000;
const DEFAULT_SEGMENTS: Segment[] = ["Res", "CSMI", "MIXED"];
const DEFAULT_ENERGY_FILTER: EnergySourceFilter = "all";

const VIEW_TABS: { id: ViewMode; label: string; description: string }[] = [
  { id: "maps", label: "Maps", description: "Interactive maps" },
  { id: "dashboard", label: "Dashboard", description: "Summary statistics" },
  { id: "opportunities", label: "Leads", description: "Conversion opportunities" },
  { id: "intelligence", label: "Intelligence", description: "Competitive intelligence" },
  { id: "rebates", label: "Rebates", description: "Calculate incentives" },
  { id: "calls", label: "Calls", description: "Phone agent call history" },
  { id: "settings", label: "Settings", description: "Documents & configuration" },
];

export default function Home() {
  // View state
  const [view, setView] = useState<ViewMode>("maps");
  const [mapType, setMapType] = useState<MapType>("emissions");
  
  // Emissions state
  const [selectedSegments, setSelectedSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [energySourceFilter, setEnergySourceFilter] = useState<EnergySourceFilter>(DEFAULT_ENERGY_FILTER);

  // Projects state
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([]);
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState<string[]>([]);
  const [projectMinCost, setProjectMinCost] = useState(0);
  const [projectMaxCost, setProjectMaxCost] = useState(25000); // $25B max
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>([]);
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");

  // Custom projects state
  const [customViewMode, setCustomViewMode] = useState<"map" | "table">("map");
  const [customFileFilter, setCustomFileFilter] = useState<string | undefined>(undefined);
  const [customCategoryFilter, setCustomCategoryFilter] = useState<string | undefined>(undefined);
  const [customSearchQuery, setCustomSearchQuery] = useState("");

  // Emissions query
  const { data: communities, isLoading: loadingCommunities } = trpc.getFilteredCommunities.useQuery({
    segments: selectedSegments.length > 0 ? selectedSegments : undefined,
    threshold,
    energySourceFilter: energySourceFilter !== "all" ? energySourceFilter : undefined,
  });

  // Projects query
  const { data: projects, isLoading: loadingProjects } = trpc.getFilteredProjects.useQuery({
    constructionTypes: selectedProjectTypes.length > 0 ? selectedProjectTypes : undefined,
    projectStatuses: selectedProjectStatuses.length > 0 ? selectedProjectStatuses : undefined,
    minCost: projectMinCost > 0 ? projectMinCost : undefined,
    maxCost: projectMaxCost < 25000 ? projectMaxCost : undefined,
    developers: selectedDevelopers.length > 0 ? selectedDevelopers : undefined,
    municipalities: selectedMunicipalities.length > 0 ? selectedMunicipalities : undefined,
    regions: selectedRegions.length > 0 ? selectedRegions : undefined,
    searchQuery: projectSearchQuery || undefined,
  });

  // Project stats query
  const { data: projectStats } = trpc.getProjectStats.useQuery({
    constructionTypes: selectedProjectTypes.length > 0 ? selectedProjectTypes : undefined,
    projectStatuses: selectedProjectStatuses.length > 0 ? selectedProjectStatuses : undefined,
    minCost: projectMinCost > 0 ? projectMinCost : undefined,
    maxCost: projectMaxCost < 25000 ? projectMaxCost : undefined,
  });

  // Custom projects queries
  const { data: customProjects, isLoading: loadingCustomProjects } = trpc.ai.getCustomProjects.useQuery({
    fileId: customFileFilter,
    category: customCategoryFilter,
    searchQuery: customSearchQuery || undefined,
  });
  const { data: customFiles } = trpc.ai.getCustomProjectFiles.useQuery();
  const { data: customStats } = trpc.ai.getCustomProjectStats.useQuery();
  const deleteCustomFile = trpc.ai.deleteCustomProjectFile.useMutation();
  const utils = trpc.useUtils();

  const handleReset = useCallback(() => {
    setSelectedSegments(DEFAULT_SEGMENTS);
    setThreshold(DEFAULT_THRESHOLD);
    setSelectedCommunityId(null);
    setEnergySourceFilter(DEFAULT_ENERGY_FILTER);
  }, []);

  const handleProjectReset = useCallback(() => {
    setSelectedProjectTypes([]);
    setSelectedProjectStatuses([]);
    setProjectMinCost(0);
    setProjectMaxCost(25000);
    setSelectedDevelopers([]);
    setSelectedMunicipalities([]);
    setSelectedRegions([]);
    setSelectedProjectId(null);
    setProjectSearchQuery("");
  }, []);

  const handleCommunitySelect = useCallback((communityOrId: { id: string } | string) => {
    const id = typeof communityOrId === "string" ? communityOrId : communityOrId.id;
    setSelectedCommunityId(id);
    if (view !== "maps") setView("maps");
    if (mapType !== "emissions") setMapType("emissions");
  }, [view, mapType]);

  const handleCommunitySelectById = useCallback((id: string) => {
    setSelectedCommunityId(id);
    if (view !== "maps") setView("maps");
    if (mapType !== "emissions") setMapType("emissions");
  }, [view, mapType]);

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  // Determine which sidebar to show
  const showEmissionFilters = (view === "maps" && mapType === "emissions") || view === "dashboard";
  const showProjectFilters = view === "maps" && mapType === "projects";
  const showCustomSidebar = view === "maps" && mapType === "custom";

  // Unique categories from custom projects
  const customCategories = customProjects
    ? [...new Set(customProjects.map((p) => p.category).filter(Boolean))] as string[]
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-black">
        <div className="swiss-grid py-4">
          <div className="flex items-center justify-between">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl md:text-3xl font-bold tracking-tight"
              >
                BC Emissions
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-xs uppercase tracking-wider text-gray-500 mt-1"
              >
                HVAC Business Intelligence · 2022 Data · 2025 Benchmarks
              </motion.p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`btn text-xs ${view === tab.id ? "btn-primary" : ""}`}
                  title={tab.description}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Left Sidebar - Filters */}
        {showEmissionFilters && (
          <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-black overflow-y-auto flex-shrink-0">
            <FilterControls
              selectedSegments={selectedSegments}
              onSegmentsChange={setSelectedSegments}
              threshold={threshold}
              onThresholdChange={setThreshold}
              energySourceFilter={energySourceFilter}
              onEnergySourceChange={setEnergySourceFilter}
              onReset={handleReset}
            />
          </aside>
        )}

        {showProjectFilters && (
          <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-black overflow-y-auto flex-shrink-0">
            <ProjectFilters
              selectedTypes={selectedProjectTypes}
              onTypesChange={setSelectedProjectTypes}
              selectedStatuses={selectedProjectStatuses}
              onStatusesChange={setSelectedProjectStatuses}
              minCost={projectMinCost}
              maxCost={projectMaxCost}
              onCostRangeChange={(min, max) => {
                setProjectMinCost(min);
                setProjectMaxCost(max);
              }}
              selectedDevelopers={selectedDevelopers}
              onDevelopersChange={setSelectedDevelopers}
              selectedMunicipalities={selectedMunicipalities}
              onMunicipalitiesChange={setSelectedMunicipalities}
              selectedRegions={selectedRegions}
              onRegionsChange={setSelectedRegions}
              onReset={handleProjectReset}
            />
          </aside>
        )}

        {/* Custom Projects Sidebar */}
        {showCustomSidebar && (
          <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-black overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider">Custom Projects</h2>
              </div>

              {/* Upload */}
              <CustomProjectsUpload
                onUploadComplete={() => {
                  utils.ai.getCustomProjects.invalidate();
                  utils.ai.getCustomProjectFiles.invalidate();
                  utils.ai.getCustomProjectStats.invalidate();
                }}
              />

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search custom projects..."
                  value={customSearchQuery}
                  onChange={(e) => setCustomSearchQuery(e.target.value)}
                  className="input text-xs w-full pl-8"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Filters */}
              {(customCategories.length > 0 || (customFiles && customFiles.length > 1)) && (
                <div className="space-y-3">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Filters</p>

                  {customFiles && customFiles.length > 1 && (
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">File Source</label>
                      <select
                        value={customFileFilter || ""}
                        onChange={(e) => setCustomFileFilter(e.target.value || undefined)}
                        className="input text-xs w-full mt-1"
                      >
                        <option value="">All files</option>
                        {customFiles.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.filename} ({f._count.projects})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {customCategories.length > 0 && (
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Category</label>
                      <select
                        value={customCategoryFilter || ""}
                        onChange={(e) => setCustomCategoryFilter(e.target.value || undefined)}
                        className="input text-xs w-full mt-1"
                      >
                        <option value="">All categories</option>
                        {customCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Uploaded Files List */}
              {customFiles && customFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Uploaded Files</p>
                  {customFiles.map((f) => (
                    <div key={f.id} className="card p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{f.filename}</p>
                          <p className="text-[10px] text-gray-400">
                            {f._count.projects} projects &middot; {new Date(f.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete ${f.filename} and all its projects?`)) return;
                            await deleteCustomFile.mutateAsync({ id: f.id });
                            utils.ai.getCustomProjectFiles.invalidate();
                            utils.ai.getCustomProjects.invalidate();
                            utils.ai.getCustomProjectStats.invalidate();
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                          title="Delete file"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {/* Insights */}
                      {f.insights && (
                        <div className="bg-blue-50 border border-blue-100 rounded p-2">
                          <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wider mb-1">AI Insights</p>
                          <p className="text-[10px] text-blue-800 whitespace-pre-line leading-relaxed">
                            {f.insights}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center - Main Content */}
        <div className="flex-1 flex flex-col relative">
          <AnimatePresence mode="wait">
            {view === "maps" && (
              <motion.div
                key="maps"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col relative"
              >
                {/* Map Type Toggle */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="card p-1 bg-white/95 backdrop-blur-sm flex gap-1">
                    <button
                      onClick={() => setMapType("emissions")}
                      className={`px-4 py-2 text-xs font-medium rounded transition-colors ${
                        mapType === "emissions"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:text-black hover:bg-gray-100"
                      }`}
                    >
                      Emissions Map
                    </button>
                    <button
                      onClick={() => setMapType("projects")}
                      className={`px-4 py-2 text-xs font-medium rounded transition-colors ${
                        mapType === "projects"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:text-black hover:bg-gray-100"
                      }`}
                    >
                      Projects Map
                    </button>
                    <button
                      onClick={() => setMapType("custom")}
                      className={`px-4 py-2 text-xs font-medium rounded transition-colors ${
                        mapType === "custom"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:text-black hover:bg-gray-100"
                      }`}
                    >
                      Custom Projects
                    </button>
                  </div>
                </div>

                {/* Emissions Map */}
                {mapType === "emissions" && (
                  <div className="flex-1 relative">
                    {/* Search Bar - positioned below toggle */}
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[400px] max-w-[calc(100%-2rem)] z-10">
                      <SearchBar
                        onSelectCommunity={handleCommunitySelectById}
                        placeholder="Search communities on map..."
                      />
                    </div>

                    {loadingCommunities ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin mx-auto mb-4" />
                          <p className="text-sm text-gray-500">Loading communities...</p>
                        </div>
                      </div>
                    ) : (
                      <EmissionsMap
                        communities={communities || []}
                        threshold={threshold}
                        onCommunitySelect={handleCommunitySelect}
                        selectedCommunityId={selectedCommunityId}
                      />
                    )}

                    {/* Stats Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-64">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="card p-4 bg-white/95 backdrop-blur-sm"
                      >
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Communities</span>
                            <span className="data-value font-medium">{communities?.length || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Exceeding</span>
                            <span className="data-value font-medium status-red">
                              {communities?.filter((c) => c.exceedsThreshold).length || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Below</span>
                            <span className="data-value font-medium status-green">
                              {communities?.filter((c) => !c.exceedsThreshold).length || 0}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Projects Map */}
                {mapType === "projects" && (
                  <div className="flex-1 relative">
                    {/* Search Bar - positioned below toggle */}
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[400px] max-w-[calc(100%-2rem)] z-10">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search projects, developers..."
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          className="input w-full pl-10"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    {loadingProjects ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin mx-auto mb-4" />
                          <p className="text-sm text-gray-500">Loading projects...</p>
                        </div>
                      </div>
                    ) : (
                      <ProjectsMap
                        projects={projects || []}
                        onProjectSelect={handleProjectSelect}
                        selectedProjectId={selectedProjectId}
                      />
                    )}

                    {/* Project Stats Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="card p-4 bg-white/95 backdrop-blur-sm"
                      >
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Projects</span>
                            <span className="data-value font-medium">{projects?.length || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Total Value</span>
                            <span className="data-value font-bold">
                              ${projectStats?.totalValue ? (projectStats.totalValue >= 1000 
                                ? `${(projectStats.totalValue / 1000).toFixed(1)}B` 
                                : `${projectStats.totalValue.toLocaleString()}M`)
                                : "0"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Proposed</span>
                            <span className="data-value font-medium text-amber-600">
                              {projectStats?.byStatus.find(s => s.status === "Proposed")?.count || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 uppercase tracking-wider">Under Construction</span>
                            <span className="data-value font-medium text-green-600">
                              {projectStats?.byStatus.find(s => s.status === "Construction started")?.count || 0}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Custom Projects View */}
                {mapType === "custom" && (
                  <div className="flex-1 relative flex flex-col">
                    {/* Map/Table Toggle */}
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
                      <div className="card p-1 bg-white/95 backdrop-blur-sm flex gap-1">
                        <button
                          onClick={() => setCustomViewMode("map")}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            customViewMode === "map"
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:text-black hover:bg-gray-100"
                          }`}
                        >
                          Map View
                        </button>
                        <button
                          onClick={() => setCustomViewMode("table")}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            customViewMode === "table"
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:text-black hover:bg-gray-100"
                          }`}
                        >
                          Table View
                        </button>
                      </div>
                    </div>

                    {loadingCustomProjects ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin mx-auto mb-4" />
                          <p className="text-sm text-gray-500">Loading custom projects...</p>
                        </div>
                      </div>
                    ) : customViewMode === "map" ? (
                      <CustomProjectsMap projects={customProjects || []} />
                    ) : (
                      <CustomProjectsTable projects={customProjects || []} />
                    )}

                    {/* Custom Stats Overlay */}
                    {customViewMode === "map" && customStats && (
                      <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-64">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="card p-4 bg-white/95 backdrop-blur-sm"
                        >
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500 uppercase tracking-wider">Projects</span>
                              <span className="data-value font-medium">{customStats.totalProjects}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 uppercase tracking-wider">On Map</span>
                              <span className="data-value font-medium text-green-600">{customStats.withLocation}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 uppercase tracking-wider">Files</span>
                              <span className="data-value font-medium">{customStats.totalFiles}</span>
                            </div>
                            {customStats.totalCost > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 uppercase tracking-wider">Total Cost</span>
                                <span className="data-value font-bold">
                                  ${customStats.totalCost >= 1_000_000_000
                                    ? `${(customStats.totalCost / 1_000_000_000).toFixed(1)}B`
                                    : customStats.totalCost >= 1_000_000
                                    ? `${(customStats.totalCost / 1_000_000).toFixed(1)}M`
                                    : customStats.totalCost.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {view === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto p-6"
              >
                <Dashboard 
                  segments={selectedSegments} 
                  threshold={threshold} 
                  onSelectCommunity={handleCommunitySelectById}
                />
              </motion.div>
            )}

            {view === "opportunities" && (
              <motion.div
                key="opportunities"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto p-6"
              >
                <ConversionOpportunities onSelectCommunity={handleCommunitySelectById} />
              </motion.div>
            )}

            {view === "rebates" && (
              <motion.div
                key="rebates"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto"
          >
                <RebateCalculator />
              </motion.div>
            )}

            {view === "intelligence" && (
              <motion.div
                key="intelligence"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto"
              >
                <CompetitiveIntelligence />
              </motion.div>
            )}

            {view === "calls" && (
              <motion.div
                key="calls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto"
              >
                <CallHistory />
              </motion.div>
            )}

            {view === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto"
              >
                <SettingsTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar - Community Detail */}
        <AnimatePresence>
          {selectedCommunityId && view === "maps" && mapType === "emissions" && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 384, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="border-l border-black overflow-hidden flex-shrink-0"
            >
              <div className="w-96 h-full overflow-y-auto">
                <CommunityDetail
                  communityId={selectedCommunityId}
                  threshold={threshold}
                  selectedSegments={selectedSegments}
                  onClose={() => setSelectedCommunityId(null)}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Project Detail Overlay */}
        <AnimatePresence>
          {selectedProjectId && view === "maps" && mapType === "projects" && (
            <ProjectDetail
              projectId={selectedProjectId}
              onClose={() => setSelectedProjectId(null)}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-black">
        <div className="swiss-grid py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>
              Data: BC CEEI 2022 · MPI Q2 2025 · Benchmarks: CleanBC 2025
            </p>
            <div className="flex items-center gap-4">
              <span>40% reduction target by 2030</span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">{projects?.length || 0} Major Projects</span>
            </div>
          </div>
        </div>
      </footer>

      {/* AI Chatbot */}
      <AIChatbot />
    </div>
  );
}
