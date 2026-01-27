"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface ProjectDetailProps {
  projectId: string;
  onClose: () => void;
}

interface ContractorResult {
  name: string;
  type: "mechanical" | "building" | "electrical" | "plumbing";
  specialty?: string;
  projects?: string[];
  location?: string;
  contact?: string;
  website?: string;
  description?: string;
  imageUrl?: string;
  workedWithDeveloper?: boolean;
  developerRelationship?: string | null;
  likelihoodScore?: number; // 0-100 percentage
  likelihoodReasoning?: string;
}

interface ResearchResult {
  contractors: ContractorResult[];
  images: string[];
  sources: string[];
  summary?: string;
}

function formatCost(cost: number): string {
  if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(2)}B`;
  }
  return `$${cost.toLocaleString()}M`;
}

const TYPE_COLORS: Record<string, string> = {
  "Residential": "bg-emerald-500",
  "Commercial": "bg-blue-500",
  "Infrastructure": "bg-amber-500",
  "Institutional": "bg-violet-500",
  "Industrial": "bg-red-500",
};

const CONTRACTOR_ICONS = {
  mechanical: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  electrical: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  plumbing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
};

// Contractor Research Panel
function ContractorResearch({ 
  projectName, 
  developer, 
  projectType, 
  region, 
  municipality 
}: { 
  projectName: string;
  developer: string;
  projectType: string;
  region: string;
  municipality?: string;
}) {
  const [isResearching, setIsResearching] = useState(false);
  const [researchResults, setResearchResults] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"mechanical" | "building">("mechanical");

  const runContractorResearch = async (type: "mechanical" | "building") => {
    setIsResearching(true);
    setError(null);
    setActiveTab(type);

    const prompt = type === "mechanical" 
      ? `Find mechanical engineering consultants for: ${municipality || region}, ${region}, BC (${projectType} project by ${developer})

Include these firms if they serve the area: WSP, Stantec, AME Group, Integral Group, Cobalt Engineering, Nemetz, Associated Engineering, Arup

YOUR RESPONSE MUST BE EXACTLY THIS FORMAT - START WITH { AND END WITH }:
{"consultants":[{"name":"WSP Canada","type":"mechanical","specialty":"MEP Design","location":"Vancouver, BC","projects":["Project name"],"website":"wsp.com","description":"Services offered","workedWithDeveloper":false,"developerRelationship":null,"likelihoodScore":90,"likelihoodReasoning":"Major firm"}]}

DO NOT include any text before or after the JSON. DO NOT use markdown. Just the raw JSON object.`
      : `Find general contractors for: ${municipality || region}, ${region}, BC (${projectType} project by ${developer})

Include these firms if they serve the area: PCL Construction, EllisDon, Graham, Ledcor, Bird Construction, Farmer Construction, Ventana, Kindred

YOUR RESPONSE MUST BE EXACTLY THIS FORMAT - START WITH { AND END WITH }:
{"contractors":[{"name":"PCL Construction","type":"building","specialty":"Commercial construction","location":"Vancouver, BC","projects":["Project name"],"website":"pcl.com","description":"Services offered","workedWithDeveloper":false,"developerRelationship":null,"likelihoodScore":90,"likelihoodReasoning":"Major firm"}]}

DO NOT include any text before or after the JSON. DO NOT use markdown. Just the raw JSON object.`;

    try {
      const response = await fetch("/api/c1-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          skipContext: true,
          customSystemPrompt: `You are a BC construction industry database. For mechanical consultants, use {"consultants":[...]}. For general contractors, use {"contractors":[...]}. Always include major firms (WSP, Stantec, PCL, EllisDon, Graham). Return ONLY valid JSON - no markdown code blocks, no explanation text.`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Research failed: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      const images: string[] = [];
      
      console.log("Raw API response:", content.substring(0, 500));

      // Strip out <think> tags from sonar-reasoning-pro responses (multiple patterns)
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
      content = content.replace(/<think>[\s\S]*/gi, '');
      content = content.replace(/^[\s\S]*?<\/think>/gi, ''); // Handle partial closing tag
      
      // Strip markdown code blocks
      content = content.replace(/```json\s*/gi, '');
      content = content.replace(/```\s*/g, '');
      content = content.replace(/`/g, '');
      
      // Clean up whitespace
      content = content.trim();
      
      console.log("After cleanup:", content.substring(0, 300));

      // Parse JSON response
      let parsed: any = { contractors: [] };
      try {
        // Find JSON anywhere in the content
        const jsonMatch = content.match(/\{[\s\S]*"contractors"[\s\S]*\}/);
        if (jsonMatch) {
          console.log("Found JSON with contractors key");
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          // Try to find any JSON object
          const anyJson = content.match(/\{[\s\S]*\}/);
          if (anyJson) {
            console.log("Found generic JSON");
            parsed = JSON.parse(anyJson[0]);
            // Handle "consultants" key as well
            if (parsed.consultants && !parsed.contractors) {
              parsed.contractors = parsed.consultants;
            }
          }
        }
        
        // Handle array response
        if (Array.isArray(parsed)) {
          parsed = { contractors: parsed };
        }
        
        console.log("Parsed count:", parsed.contractors?.length || 0);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.log("Failed content:", content.substring(0, 500));
        parsed = { contractors: [] };
      }

      setResearchResults({
        contractors: parsed.contractors || [],
        images: images,
        sources: data.citations || [],
        summary: parsed.summary,
      });
    } catch (err: any) {
      setError(err.message || "Failed to research contractors");
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="border-t border-gray-200">
      <div className="p-6">
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Contractor Research
        </h4>
        
        <p className="text-xs text-gray-500 mb-4">
          AI-powered research to identify consultants and contractors likely to work on this project.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => runContractorResearch("mechanical")}
            disabled={isResearching}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg border transition-colors ${
              activeTab === "mechanical" && researchResults
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            {CONTRACTOR_ICONS.mechanical}
            <span>Mechanical Consultants</span>
          </button>
          <button
            onClick={() => runContractorResearch("building")}
            disabled={isResearching}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg border transition-colors ${
              activeTab === "building" && researchResults
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            {CONTRACTOR_ICONS.building}
            <span>General Contractors</span>
          </button>
        </div>

        {/* Loading State */}
        {isResearching && (
          <div className="py-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              Researching {activeTab === "mechanical" ? "mechanical consultants" : "general contractors"}...
            </p>
            <p className="text-xs text-gray-400 mt-1">Using Perplexity Sonar Reasoning Pro</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {researchResults && !isResearching && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Images */}
            {researchResults.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {researchResults.images.slice(0, 6).map((img, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={img}
                      alt={`Contractor ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Contractors List */}
            {researchResults.contractors.length > 0 ? (
              <div className="space-y-3">
                {researchResults.contractors.map((contractor, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 bg-white border rounded-lg hover:border-gray-300 transition-colors ${
                      contractor.workedWithDeveloper ? "border-green-300 bg-green-50/30" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        contractor.workedWithDeveloper ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
                      }`}>
                        {CONTRACTOR_ICONS[contractor.type] || CONTRACTOR_ICONS.building}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-semibold text-gray-900">{contractor.name}</h5>
                            {contractor.workedWithDeveloper && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Worked with {developer}
                              </span>
                            )}
                          </div>
                          {contractor.likelihoodScore !== undefined && (
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold text-sm ${
                              contractor.likelihoodScore >= 70 ? "bg-green-100 text-green-700" :
                              contractor.likelihoodScore >= 50 ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              {contractor.likelihoodScore}% Match
                            </div>
                          )}
                        </div>
                        {contractor.specialty && (
                          <p className="text-xs text-gray-500 mt-0.5">{contractor.specialty}</p>
                        )}
                        {contractor.location && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {contractor.location}
                          </p>
                        )}
                        {contractor.developerRelationship && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                            <p className="font-medium">Developer Relationship:</p>
                            <p className="mt-0.5">{contractor.developerRelationship}</p>
                          </div>
                        )}
                        {contractor.description && (
                          <p className="text-sm text-gray-600 mt-2">{contractor.description}</p>
                        )}
                        {contractor.likelihoodReasoning && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                            <p className="font-medium text-blue-900">Why this contractor:</p>
                            <p className="text-blue-800 mt-0.5">{contractor.likelihoodReasoning}</p>
                          </div>
                        )}
                        {contractor.projects && contractor.projects.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">Recent Projects:</p>
                            <div className="flex flex-wrap gap-1">
                              {contractor.projects.slice(0, 3).map((proj, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  {proj}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          {contractor.website && (
                            <a
                              href={contractor.website.startsWith("http") ? contractor.website : `https://${contractor.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Website
                            </a>
                          )}
                          {contractor.contact && (
                            <span className="text-xs text-gray-500">{contractor.contact}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                No contractors found. Try searching again or refine your criteria.
              </div>
            )}

            {/* Sources */}
            {researchResults.sources.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {researchResults.sources.slice(0, 5).map((source, idx) => (
                    <a
                      key={idx}
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate max-w-[150px]"
                    >
                      {new URL(source).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Initial state */}
        {!researchResults && !isResearching && !error && (
          <div className="text-center py-4 text-gray-400 text-sm">
            Click a button above to search for contractors
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetail({ projectId, onClose }: ProjectDetailProps) {
  const { data: project, isLoading, error } = trpc.getProjectDetails.useQuery({ id: projectId });

  if (isLoading) {
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 overflow-hidden"
      >
        <div className="p-6 h-full flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Loading project details...</div>
        </div>
      </motion.div>
    );
  }

  if (error || !project) {
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50"
      >
        <div className="p-6">
          <button onClick={onClose} className="mb-4 text-sm underline">
            ← Back
          </button>
          <div className="text-red-500">Error loading project details</div>
        </div>
      </motion.div>
    );
  }

  const isProposed = project.projectStatus === "Proposed";
  const typeColor = TYPE_COLORS[project.constructionType] || "bg-gray-500";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-black">
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={onClose}
            className="text-xs uppercase tracking-wider hover:underline"
          >
            ← Back to Map
          </button>
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full text-white ${typeColor}`}
          >
            {project.constructionType}
          </span>
        </div>

        <h2 className="text-xl font-bold leading-tight mb-2">{project.name}</h2>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 text-xs rounded ${
              isProposed
                ? "bg-amber-100 text-amber-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {project.projectStatus}
          </span>
          {project.greenBuilding && (
            <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
              Green Building
            </span>
          )}
          {project.cleanEnergy && (
            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
              Clean Energy
            </span>
          )}
          {project.indigenous && (
            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">
              Indigenous
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Value Card */}
        <div className="p-6 bg-black text-white">
          <div className="text-xs uppercase tracking-wider opacity-70 mb-1">
            Estimated Project Value
          </div>
          <div className="text-4xl font-bold tracking-tight">
            {formatCost(project.estimatedCost)}
          </div>
          <div className="text-xs opacity-70 mt-1">CAD</div>
        </div>

        {/* Developer & Location */}
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
            Project Details
          </h4>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Developer</span>
              <span className="text-sm font-medium text-right max-w-[60%]">
                {project.developer}
              </span>
            </div>

            {project.architect && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Architect</span>
                <span className="text-sm font-medium text-right max-w-[60%]">
                  {project.architect}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Project Type</span>
              <span className="text-sm font-medium">{project.projectType}</span>
            </div>

            {project.categoryName && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Category</span>
                <span className="text-sm font-medium text-right max-w-[60%]">
                  {project.categoryName}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Region</span>
              <span className="text-sm font-medium">{project.region}</span>
            </div>

            {project.municipality && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Municipality</span>
                <span className="text-sm font-medium">{project.municipality}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
            Timeline
          </h4>

          <div className="space-y-3">
            {project.startDate && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Start Date</span>
                <span className="text-sm font-medium">{project.startDate}</span>
              </div>
            )}

            {project.completionDate && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Expected Completion</span>
                <span className="text-sm font-medium">{project.completionDate}</span>
              </div>
            )}

            {project.projectStage && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Current Stage</span>
                <span className="text-sm font-medium">{project.projectStage}</span>
              </div>
            )}

            {!project.startDate && !project.completionDate && !project.projectStage && (
              <span className="text-sm text-gray-500">Timeline not yet available</span>
            )}
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="p-6 border-b border-gray-200">
            <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
              Description
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              {project.description}
            </p>
          </div>
        )}

        {/* Funding */}
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
            Funding
          </h4>

          <div className="space-y-2">
            {project.publicFunding && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-sm">Public Funding</span>
              </div>
            )}
            {project.provincialFunding && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full" />
                <span className="text-sm">Provincial Funding</span>
              </div>
            )}
            {project.federalFunding && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm">Federal Funding</span>
              </div>
            )}
            {project.municipalFunding && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Municipal Funding</span>
              </div>
            )}
            {!project.publicFunding &&
              !project.provincialFunding &&
              !project.federalFunding &&
              !project.municipalFunding && (
                <span className="text-sm text-gray-500">Private Funding</span>
              )}
          </div>
        </div>

        {/* Contact */}
        {project.telephone && (
          <div className="p-6 border-b border-gray-200">
            <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
              Contact
            </h4>
            <a
              href={`tel:${project.telephone.split(" ")[0]}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {project.telephone}
            </a>
          </div>
        )}

        {/* Contractor Research Section */}
        <ContractorResearch
          projectName={project.name}
          developer={project.developer || "Unknown Developer"}
          projectType={project.constructionType}
          region={project.region}
          municipality={project.municipality || undefined}
        />
      </div>
    </motion.div>
  );
}
