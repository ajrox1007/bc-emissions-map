"use client";

import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";

type Segment = "Res" | "CSMI" | "MIXED";

interface CommunityDetailProps {
  communityId: string;
  threshold: number;
  selectedSegments: Segment[];
  onClose: () => void;
}

function formatEmissions(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function EmissionBar({
  label,
  value,
  maxValue,
  color,
  connections,
  avgPerConnection,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  connections?: number;
  avgPerConnection?: number;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="uppercase tracking-wider text-gray-500">{label}</span>
        <span className="data-value font-medium">
          {formatEmissions(value)} TCO₂e
        </span>
      </div>
      <div className="h-2 bg-gray-100 border border-black">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full"
          style={{ backgroundColor: color }}
        />
      </div>
      {connections !== undefined && (
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>{formatNumber(connections)} connections</span>
          {avgPerConnection !== undefined && avgPerConnection > 0 && (
            <span>{avgPerConnection.toFixed(2)} tCO₂e/connection</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommunityDetail({
  communityId,
  threshold,
  selectedSegments,
  onClose,
}: CommunityDetailProps) {
  const { data: community, isLoading, error } = trpc.getCommunityDetails.useQuery({
    id: communityId,
  });

  // Check if a segment is visible based on filters
  const showResidential = selectedSegments.includes("Res");
  const showCommercial = selectedSegments.includes("CSMI");
  const showMixed = selectedSegments.includes("MIXED");

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="card p-6"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 w-3/4" />
          <div className="h-4 bg-gray-200 w-1/2" />
          <div className="h-32 bg-gray-200" />
        </div>
      </motion.div>
    );
  }

  if (error || !community) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="card p-6"
      >
        <p className="text-red-500">Failed to load community details</p>
        <button onClick={onClose} className="btn mt-4">
          Close
        </button>
      </motion.div>
    );
  }

  // Calculate values based on selected segments
  const visibleEmissions: number[] = [];
  if (showResidential) visibleEmissions.push(community.resEmissions);
  if (showCommercial) visibleEmissions.push(community.csmiEmissions);
  if (showMixed) visibleEmissions.push(community.mixedEmissions);
  
  const maxSegmentEmission = Math.max(...visibleEmissions, 0);
  
  // Calculate filtered total based on selected segments
  let filteredTotalEmissions = 0;
  if (showResidential) filteredTotalEmissions += community.resEmissions;
  if (showCommercial) filteredTotalEmissions += community.csmiEmissions;
  if (showMixed) filteredTotalEmissions += community.mixedEmissions;
  
  // If no segments selected, show all
  if (selectedSegments.length === 0) {
    filteredTotalEmissions = community.totalEmissions;
  }

  const thresholdDiff = filteredTotalEmissions - threshold;
  const thresholdPercent = ((filteredTotalEmissions - threshold) / threshold) * 100;
  const exceedsThreshold = filteredTotalEmissions > threshold;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="card overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-black">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold leading-tight">{community.orgName}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
              Community ID: {community.orgUnit}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-black hover:text-white transition-colors border border-black"
          >
            ×
          </button>
        </div>
      </div>

      {/* Total Emissions */}
      <div className="p-6 border-b border-black bg-gray-50">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              {selectedSegments.length > 0 && selectedSegments.length < 3 
                ? "Filtered Emissions 2022" 
                : "Total Emissions 2022"}
            </p>
            <p className="text-3xl font-bold data-value">
              {formatEmissions(filteredTotalEmissions)}
            </p>
            <p className="text-xs text-gray-500">TCO₂e</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              vs Threshold
            </p>
            <p
              className={`text-xl font-bold data-value ${
                exceedsThreshold ? "status-red" : "status-green"
              }`}
            >
              {exceedsThreshold ? "+" : ""}
              {thresholdPercent.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">
              {exceedsThreshold ? "Above" : "Below"} {formatEmissions(threshold)}
            </p>
          </div>
        </div>
      </div>

      {/* Segment Breakdown */}
      <div className="p-6 space-y-4">
        <h4 className="text-xs uppercase tracking-wider font-semibold">
          Emissions by Segment
          {selectedSegments.length > 0 && selectedSegments.length < 3 && (
            <span className="text-gray-400 font-normal ml-2">(filtered)</span>
          )}
        </h4>

        {showResidential && (
          <EmissionBar
            label="Residential"
            value={community.resEmissions}
            maxValue={maxSegmentEmission}
            color="var(--color-green)"
            connections={community.resConnections}
            avgPerConnection={community.avgEmissionsPerConnection?.residential}
          />
        )}

        {showCommercial && (
          <EmissionBar
            label="Commercial & Industrial"
            value={community.csmiEmissions}
            maxValue={maxSegmentEmission}
            color="var(--color-red)"
            connections={community.csmiConnections}
            avgPerConnection={community.avgEmissionsPerConnection?.commercial}
          />
        )}

        {showMixed && (
          <EmissionBar
            label="Mixed Use"
            value={community.mixedEmissions}
            maxValue={maxSegmentEmission}
            color="var(--color-yellow)"
            connections={community.mixedConnections}
            avgPerConnection={community.avgEmissionsPerConnection?.mixed}
          />
        )}

        {selectedSegments.length === 0 && (
          <p className="text-sm text-gray-500 italic">No segments selected. Select segments in filters to view data.</p>
        )}
      </div>

      {/* Connection Summary */}
      <div className="p-6 border-t border-black bg-gray-50">
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
          Connection Summary
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Connections</p>
            <p className="text-xl font-bold data-value">
              {formatNumber(community.totalConnections)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg. Emission/Connection</p>
            <p className="text-xl font-bold data-value">
              {community.totalConnections > 0 
                ? (community.totalEmissions / community.totalConnections).toFixed(2)
                : "0"} 
              <span className="text-sm font-normal">tCO₂e</span>
            </p>
          </div>
        </div>
      </div>

      {/* Emissions by Source */}
      {community.emissionsBySource && Object.keys(community.emissionsBySource).length > 0 && (
        <div className="p-6 border-t border-black">
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
            Top Emission Sources
            {selectedSegments.length > 0 && selectedSegments.length < 3 && (
              <span className="text-gray-400 font-normal ml-2">(filtered)</span>
            )}
          </h4>

          <div className="space-y-2">
            {Object.entries(community.emissionsBySource)
              .map(([source, data]) => {
                // Calculate filtered emissions based on selected segments
                let filteredSourceEmissions = 0;
                if (showResidential) filteredSourceEmissions += data.res;
                if (showCommercial) filteredSourceEmissions += data.csmi;
                if (showMixed) filteredSourceEmissions += data.mixed;
                // If no segments selected, show total
                if (selectedSegments.length === 0) filteredSourceEmissions = data.total;
                return { source, data, filteredSourceEmissions };
              })
              .filter(({ filteredSourceEmissions }) => filteredSourceEmissions > 0)
              .sort((a, b) => b.filteredSourceEmissions - a.filteredSourceEmissions)
              .slice(0, 5)
              .map(({ source, filteredSourceEmissions }) => (
                <div
                  key={source}
                  className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                >
                  <span className="text-sm truncate max-w-[60%]">{source}</span>
                  <span className="data-value text-sm font-medium">
                    {formatEmissions(filteredSourceEmissions)} TCO₂e
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Coordinates */}
      {community.latitude && community.longitude && (
        <div className="p-6 border-t border-black bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 uppercase tracking-wider">Location</span>
            <span className="data-value">
              {community.latitude.toFixed(4)}°N, {Math.abs(community.longitude).toFixed(4)}°W
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

