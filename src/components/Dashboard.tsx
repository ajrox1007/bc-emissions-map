"use client";

import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import SearchBar from "./SearchBar";

type Segment = "Res" | "CSMI" | "MIXED";

interface DashboardProps {
  segments: Segment[];
  threshold: number;
  onSelectCommunity?: (communityId: string) => void;
}

function formatEmissions(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function StatCard({
  label,
  value,
  subtext,
  highlight,
  delay,
}: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: "green" | "red" | "yellow";
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card p-4"
    >
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </p>
      <p
        className={`text-2xl font-bold data-value ${
          highlight === "green"
            ? "status-green"
            : highlight === "red"
            ? "status-red"
            : highlight === "yellow"
            ? "status-yellow"
            : ""
        }`}
      >
        {value}
      </p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </motion.div>
  );
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function SegmentBar({
  label,
  value,
  total,
  color,
  connections,
  avgPerConnection,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  connections?: number;
  avgPerConnection?: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4">
        <div className="w-24 text-xs uppercase tracking-wider text-gray-500 truncate">
          {label}
        </div>
        <div className="flex-1 h-6 bg-gray-100 border border-black relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full absolute left-0 top-0"
            style={{ backgroundColor: color }}
          />
          <div className="absolute inset-0 flex items-center justify-end pr-2">
            <span className="data-value text-xs font-medium">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="w-24 text-right">
          <span className="data-value text-xs">{formatEmissions(value)}</span>
        </div>
      </div>
      {connections !== undefined && (
        <div className="flex items-center gap-4 ml-28 text-xs text-gray-400">
          <span>{formatNumber(connections)} connections</span>
          {avgPerConnection !== undefined && avgPerConnection > 0 && (
            <span>• {avgPerConnection.toFixed(2)} tCO₂e avg</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ segments, threshold, onSelectCommunity }: DashboardProps) {
  const { data: stats, isLoading } = trpc.getSummaryStats.useQuery({
    segments: segments.length > 0 ? segments : undefined,
    threshold,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-3 bg-gray-200 w-1/2 mb-2" />
              <div className="h-8 bg-gray-200 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const segmentTotal =
    stats.segmentTotals.residential +
    stats.segmentTotals.commercial +
    stats.segmentTotals.mixed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Search Bar */}
      {onSelectCommunity && (
        <div className="mb-6">
          <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
            Search Communities
          </h4>
          <SearchBar
            onSelectCommunity={onSelectCommunity}
            placeholder="Search for a community..."
            className="max-w-md"
          />
        </div>
      )}

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Communities"
          value={stats.totalCommunities.toString()}
          subtext="with location data"
          delay={0}
        />
        <StatCard
          label="Total Emissions"
          value={`${formatEmissions(stats.totalEmissions)}`}
          subtext="TCO₂e"
          delay={0.05}
        />
        <StatCard
          label="Average Emissions"
          value={`${formatEmissions(stats.avgEmissions)}`}
          subtext="per community"
          delay={0.1}
        />
        <StatCard
          label="Exceeding Threshold"
          value={`${stats.percentExceeding.toFixed(0)}%`}
          subtext={`${stats.exceedingThreshold} communities`}
          highlight={stats.percentExceeding > 50 ? "red" : stats.percentExceeding > 25 ? "yellow" : "green"}
          delay={0.15}
        />
      </div>

      <div className="divider" />

      {/* Segment Distribution */}
      <div>
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
          Emissions by Segment
        </h4>

        <div className="space-y-4">
          <SegmentBar
            label="Residential"
            value={stats.segmentTotals.residential}
            total={segmentTotal}
            color="var(--color-green)"
            connections={stats.connectionTotals?.residential}
            avgPerConnection={stats.avgEmissionsPerConnection?.residential}
          />
          <SegmentBar
            label="Commercial"
            value={stats.segmentTotals.commercial}
            total={segmentTotal}
            color="var(--color-red)"
            connections={stats.connectionTotals?.commercial}
            avgPerConnection={stats.avgEmissionsPerConnection?.commercial}
          />
          <SegmentBar
            label="Mixed"
            value={stats.segmentTotals.mixed}
            total={segmentTotal}
            color="var(--color-yellow)"
            connections={stats.connectionTotals?.mixed}
            avgPerConnection={stats.avgEmissionsPerConnection?.mixed}
          />
        </div>
      </div>

      {/* Connection Summary */}
      {stats.connectionTotals && (
        <>
          <div className="divider" />
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
              Connection Summary
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Connections"
                value={formatNumber(stats.connectionTotals.total)}
                subtext="all sectors"
                delay={0}
              />
              <StatCard
                label="Residential"
                value={formatNumber(stats.connectionTotals.residential)}
                subtext={`${stats.avgEmissionsPerConnection?.residential?.toFixed(2) || '0'} tCO₂e avg`}
                delay={0.05}
              />
              <StatCard
                label="Commercial"
                value={formatNumber(stats.connectionTotals.commercial)}
                subtext={`${stats.avgEmissionsPerConnection?.commercial?.toFixed(2) || '0'} tCO₂e avg`}
                delay={0.1}
              />
              <StatCard
                label="Mixed"
                value={formatNumber(stats.connectionTotals.mixed)}
                subtext={`${stats.avgEmissionsPerConnection?.mixed?.toFixed(2) || '0'} tCO₂e avg`}
                delay={0.15}
              />
            </div>
          </div>
        </>
      )}

      <div className="divider" />

      {/* Top 10 Communities */}
      <div>
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-4">
          Top 10 Communities by Emissions
        </h4>

        <div className="space-y-1">
          {stats.top10.map((community, index) => (
            <motion.div
              key={community.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0"
            >
              <span className="w-6 text-xs text-gray-400 data-value">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-sm font-medium truncate">
                {community.name}
              </span>
              <span
                className={`data-value text-sm ${
                  community.exceedsThreshold ? "status-red" : ""
                }`}
              >
                {formatEmissions(community.emissions)}
              </span>
              {community.exceedsThreshold && (
                <span className="w-2 h-2 bg-red-500 flex-shrink-0" />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Average by Segment */}
      <div className="divider" />

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Avg Residential
          </p>
          <p className="text-lg font-bold data-value">
            {formatEmissions(stats.segmentAverages.residential)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Avg Commercial
          </p>
          <p className="text-lg font-bold data-value">
            {formatEmissions(stats.segmentAverages.commercial)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Avg Mixed
          </p>
          <p className="text-lg font-bold data-value">
            {formatEmissions(stats.segmentAverages.mixed)}
          </p>
        </div>
      </div>

      {/* Current Filter Status */}
      <div className="card p-4 bg-gray-50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 uppercase tracking-wider">
            Current Threshold
          </span>
          <span className="data-value font-semibold">
            {formatEmissions(threshold)} TCO₂e
          </span>
        </div>
      </div>
    </motion.div>
  );
}

