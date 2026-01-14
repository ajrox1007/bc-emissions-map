"use client";

import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface ProjectDetailProps {
  projectId: string;
  onClose: () => void;
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

export default function ProjectDetail({ projectId, onClose }: ProjectDetailProps) {
  const { data: project, isLoading, error } = trpc.getProjectDetails.useQuery({ id: projectId });

  if (isLoading) {
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-50 overflow-hidden"
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
        className="fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-50"
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
      className="fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
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
              🌿 Green Building
            </span>
          )}
          {project.cleanEnergy && (
            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
              ⚡ Clean Energy
            </span>
          )}
          {project.indigenous && (
            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">
              🪶 Indigenous
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
          <div className="p-6">
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
      </div>
    </motion.div>
  );
}

