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

type Segment = "Res" | "CSMI" | "MIXED";
type ViewMode = "map" | "dashboard" | "opportunities" | "rebates" | "projects";
type EnergySourceFilter = "all" | "fossilHeavy" | "electricHeavy" | "electricDominant";

const DEFAULT_THRESHOLD = 10000;
const DEFAULT_SEGMENTS: Segment[] = ["Res", "CSMI", "MIXED"];
const DEFAULT_ENERGY_FILTER: EnergySourceFilter = "all";

const VIEW_TABS: { id: ViewMode; label: string; description: string }[] = [
  { id: "map", label: "Emissions", description: "Interactive emissions map" },
  { id: "projects", label: "Projects", description: "BC Major Projects" },
  { id: "dashboard", label: "Dashboard", description: "Summary statistics" },
  { id: "opportunities", label: "Leads", description: "Conversion opportunities" },
  { id: "rebates", label: "Rebates", description: "Calculate incentives" },
];

export default function Home() {
  // Emissions state
  const [selectedSegments, setSelectedSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("map");
  const [energySourceFilter, setEnergySourceFilter] = useState<EnergySourceFilter>(DEFAULT_ENERGY_FILTER);

  // Projects state
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([]);
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState<string[]>([]);
  const [projectMinCost, setProjectMinCost] = useState(0);
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");

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
    developers: selectedDevelopers.length > 0 ? selectedDevelopers : undefined,
    searchQuery: projectSearchQuery || undefined,
  });

  // Project stats query
  const { data: projectStats } = trpc.getProjectStats.useQuery({
    constructionTypes: selectedProjectTypes.length > 0 ? selectedProjectTypes : undefined,
    projectStatuses: selectedProjectStatuses.length > 0 ? selectedProjectStatuses : undefined,
    minCost: projectMinCost > 0 ? projectMinCost : undefined,
  });

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
    setSelectedDevelopers([]);
    setSelectedProjectId(null);
    setProjectSearchQuery("");
  }, []);

  const handleCommunitySelect = useCallback((communityOrId: { id: string } | string) => {
    const id = typeof communityOrId === "string" ? communityOrId : communityOrId.id;
    setSelectedCommunityId(id);
    if (view !== "map") setView("map");
  }, [view]);

  const handleCommunitySelectById = useCallback((id: string) => {
    setSelectedCommunityId(id);
    if (view !== "map") setView("map");
  }, [view]);

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  // Determine which sidebar to show
  const showEmissionFilters = view === "map" || view === "dashboard";
  const showProjectFilters = view === "projects";

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
              onMinCostChange={setProjectMinCost}
              selectedDevelopers={selectedDevelopers}
              onDevelopersChange={setSelectedDevelopers}
              onReset={handleProjectReset}
            />
          </aside>
        )}

        {/* Center - Main Content */}
        <div className="flex-1 flex flex-col relative">
          <AnimatePresence mode="wait">
            {view === "map" && (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 relative"
              >
                {/* Search Bar Overlay on Map */}
                <div className="absolute top-4 left-4 right-4 md:left-4 md:right-auto md:w-80 z-10">
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
              </motion.div>
            )}

            {view === "projects" && (
              <motion.div
                key="projects"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 relative"
              >
                {/* Search Bar Overlay */}
                <div className="absolute top-4 left-4 right-4 md:left-4 md:right-auto md:w-80 z-10">
                  <input
                    type="text"
                    placeholder="Search projects, developers..."
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    className="input w-full"
                  />
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
          </AnimatePresence>
        </div>

        {/* Right Sidebar - Community Detail */}
        <AnimatePresence>
          {selectedCommunityId && view !== "projects" && (
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
          {selectedProjectId && view === "projects" && (
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
    </div>
  );
}
