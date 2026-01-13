"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-gray-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 ${colors[priority as keyof typeof colors] || colors.low}`}
    />
  );
}

interface ConversionOpportunitiesProps {
  onSelectCommunity?: (id: string) => void;
}

export default function ConversionOpportunities({
  onSelectCommunity,
}: ConversionOpportunitiesProps) {
  const [sortBy, setSortBy] = useState<"emissions" | "potential" | "roi">("potential");
  const [minEmissions, setMinEmissions] = useState(1000);

  const { data, isLoading } = trpc.getConversionOpportunities.useQuery({
    minResEmissions: minEmissions,
    sortBy,
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 w-3/4" />
          <div className="h-64 bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Target Communities
          </p>
          <p className="text-2xl font-bold data-value">
            {data.summary.totalCommunities}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <PriorityBadge priority="high" />
            <span>{data.summary.highPriority} high priority</span>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Est. Households
          </p>
          <p className="text-2xl font-bold data-value">
            {formatNumber(data.summary.totalEstimatedHouseholds)}
          </p>
          <p className="text-xs text-gray-500 mt-1">potential conversions</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Emissions Reduction
          </p>
          <p className="text-2xl font-bold data-value status-green">
            {formatNumber(data.summary.totalPotentialSavings)}
          </p>
          <p className="text-xs text-gray-500 mt-1">TCO₂e/year potential</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Rebate Potential
          </p>
          <p className="text-2xl font-bold data-value">
            {formatCurrency(data.summary.totalRebatePotential)}
          </p>
          <p className="text-xs text-gray-500 mt-1">CleanBC incentives</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 py-4 border-y border-black">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="input text-sm"
          >
            <option value="potential">Market Score</option>
            <option value="emissions">Emissions</option>
            <option value="roi">Rebate Value</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider">Min Emissions</label>
          <select
            value={minEmissions}
            onChange={(e) => setMinEmissions(parseInt(e.target.value))}
            className="input text-sm"
          >
            <option value={500}>500+ TCO₂e</option>
            <option value={1000}>1,000+ TCO₂e</option>
            <option value={5000}>5,000+ TCO₂e</option>
            <option value={10000}>10,000+ TCO₂e</option>
          </select>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-4 text-xs uppercase tracking-wider text-gray-500 px-4 py-2">
          <div className="col-span-3">Community</div>
          <div className="col-span-2 text-right">Emissions</div>
          <div className="col-span-2 text-right">Savings</div>
          <div className="col-span-2 text-right">Rebates</div>
          <div className="col-span-2 text-center">Zone</div>
          <div className="col-span-1 text-center">Score</div>
        </div>

        <div className="divider" />

        {data.opportunities.map((opp, index) => (
          <motion.div
            key={opp.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => onSelectCommunity?.(opp.id)}
            className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer items-center"
          >
            <div className="col-span-3 flex items-center gap-2">
              <PriorityBadge priority={opp.priority} />
              <span className="font-medium truncate">{opp.orgName}</span>
            </div>
            <div className="col-span-2 text-right">
              <span className="data-value text-sm">
                {formatNumber(opp.resEmissions)}
              </span>
              <span className="text-xs text-gray-500 ml-1">TCO₂e</span>
            </div>
            <div className="col-span-2 text-right">
              <span className="data-value text-sm status-green">
                -{formatNumber(opp.potentialSavings)}
              </span>
            </div>
            <div className="col-span-2 text-right">
              <span className="data-value text-sm">
                {formatCurrency(opp.totalRebatePotential)}
              </span>
            </div>
            <div className="col-span-2 text-center">
              <span
                className={`text-xs px-2 py-1 ${
                  opp.coldClimateRequired
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100"
                }`}
              >
                {opp.climateZone.replace("zone", "Z")}
                {opp.coldClimateRequired && " ❄️"}
              </span>
            </div>
            <div className="col-span-1 text-center">
              <span
                className={`data-value font-bold ${
                  opp.marketScore >= 70
                    ? "status-red"
                    : opp.marketScore >= 40
                    ? "status-yellow"
                    : ""
                }`}
              >
                {opp.marketScore}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* BC Targets Context */}
      <div className="card p-4 bg-gray-50">
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
          BC CleanBC 2030 Context
        </h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Target Reduction</p>
            <p className="font-bold">40% by 2030</p>
          </div>
          <div>
            <p className="text-gray-500">Heat Pump Efficiency</p>
            <p className="font-bold">300% COP avg</p>
          </div>
          <div>
            <p className="text-gray-500">Max CleanBC Rebate</p>
            <p className="font-bold">$19,000</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

