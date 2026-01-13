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

// BC major city centers for quick selection
const BC_CENTERS = [
  { name: "Vancouver", lat: 49.2827, lng: -123.1207 },
  { name: "Victoria", lat: 48.4284, lng: -123.3656 },
  { name: "Kelowna", lat: 49.888, lng: -119.496 },
  { name: "Kamloops", lat: 50.6745, lng: -120.3273 },
  { name: "Prince George", lat: 53.9171, lng: -122.7497 },
  { name: "Nanaimo", lat: 49.1659, lng: -123.9401 },
];

interface ServiceAreaAnalyticsProps {
  onSelectCommunity?: (id: string) => void;
}

export default function ServiceAreaAnalytics({
  onSelectCommunity,
}: ServiceAreaAnalyticsProps) {
  const [selectedCenter, setSelectedCenter] = useState(BC_CENTERS[0]);
  const [radiusKm, setRadiusKm] = useState(50);

  const { data, isLoading } = trpc.getServiceAreaAnalytics.useQuery({
    centerLat: selectedCenter.lat,
    centerLng: selectedCenter.lng,
    radiusKm,
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
      {/* Header */}
      <div className="border-b border-black pb-4">
        <h2 className="text-xl font-bold">Service Area Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">
          Market analysis for HVAC business planning
        </p>
      </div>

      {/* Service Area Selector */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold block mb-2">
              Service Center
            </label>
            <select
              value={selectedCenter.name}
              onChange={(e) => {
                const center = BC_CENTERS.find((c) => c.name === e.target.value);
                if (center) setSelectedCenter(center);
              }}
              className="input w-full"
            >
              {BC_CENTERS.map((center) => (
                <option key={center.name} value={center.name}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider font-semibold block mb-2">
              Service Radius: {radiusKm} km
            </label>
            <input
              type="range"
              min={25}
              max={200}
              step={25}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>25 km</span>
              <span>100 km</span>
              <span>200 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Communities
          </p>
          <p className="text-2xl font-bold data-value">
            {data.serviceArea.communities}
          </p>
          <p className="text-xs text-gray-500 mt-1">in service area</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Est. Households
          </p>
          <p className="text-2xl font-bold data-value">
            {formatNumber(data.marketSize.estimatedResHouseholds)}
          </p>
          <p className="text-xs text-gray-500 mt-1">residential units</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Commercial Buildings
          </p>
          <p className="text-2xl font-bold data-value">
            {formatNumber(data.marketSize.estimatedCommercialBuildings)}
          </p>
          <p className="text-xs text-gray-500 mt-1">estimated</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Cold Climate Zone
          </p>
          <p className="text-2xl font-bold data-value">
            {data.coldClimateOpportunity}
          </p>
          <p className="text-xs text-gray-500 mt-1">communities (premium)</p>
        </div>
      </div>

      {/* Market Opportunity */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-black text-white">
          <h3 className="font-semibold uppercase tracking-wider text-sm">
            Annual Market Opportunity
          </h3>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Residential
            </p>
            <p className="text-xl font-bold data-value">
              {formatCurrency(data.marketSize.annualResidentialMarket)}
            </p>
            <p className="text-xs text-gray-500">@ 5% conversion rate</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Commercial
            </p>
            <p className="text-xl font-bold data-value">
              {formatCurrency(data.marketSize.annualCommercialMarket)}
            </p>
            <p className="text-xs text-gray-500">estimated</p>
          </div>
          <div className="text-center border-l border-black">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Total
            </p>
            <p className="text-xl font-bold data-value status-green">
              {formatCurrency(data.marketSize.totalAnnualMarket)}
            </p>
            <p className="text-xs text-gray-500">per year</p>
          </div>
        </div>
      </div>

      {/* Emissions by Segment */}
      <div className="card p-4">
        <h3 className="text-xs uppercase tracking-wider font-semibold mb-4">
          Total Emissions in Service Area
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-24 text-xs uppercase tracking-wider text-gray-500">
              Residential
            </div>
            <div className="flex-1 h-6 bg-gray-100 border border-black relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(data.emissions.residential / data.emissions.total) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
                className="h-full bg-green-500"
              />
            </div>
            <div className="w-24 text-right data-value text-sm">
              {formatNumber(data.emissions.residential)}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-24 text-xs uppercase tracking-wider text-gray-500">
              Commercial
            </div>
            <div className="flex-1 h-6 bg-gray-100 border border-black relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(data.emissions.commercial / data.emissions.total) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
                className="h-full bg-red-500"
              />
            </div>
            <div className="w-24 text-right data-value text-sm">
              {formatNumber(data.emissions.commercial)}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
          <span className="text-sm font-medium">Total Emissions</span>
          <span className="data-value font-bold">
            {formatNumber(data.emissions.total)} TCO₂e
          </span>
        </div>
      </div>

      {/* Climate Zones Breakdown */}
      <div className="card p-4">
        <h3 className="text-xs uppercase tracking-wider font-semibold mb-4">
          By Climate Zone
        </h3>
        <div className="space-y-2">
          {Object.entries(data.byClimateZone).map(([zone, zoneData]) => (
            <div
              key={zone}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 ${
                    zone.includes("7") || zone.includes("6")
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100"
                  }`}
                >
                  {zone.replace("zone", "Zone ")}
                </span>
                <span className="text-sm">{zoneData.count} communities</span>
              </div>
              <div className="text-right">
                <span className="data-value text-sm">
                  {formatNumber(zoneData.totalEmissions)} TCO₂e
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Communities */}
      <div className="card p-4">
        <h3 className="text-xs uppercase tracking-wider font-semibold mb-4">
          Top 10 Communities in Service Area
        </h3>
        <div className="space-y-1">
          {data.topCommunities.map((community, index) => (
            <motion.div
              key={community.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectCommunity?.(community.id)}
              className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-xs text-gray-400 data-value">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-medium text-sm">{community.name}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 ${
                    community.climateZone.includes("7") || community.climateZone.includes("6")
                      ? "bg-blue-50 text-blue-600"
                      : "bg-gray-50"
                  }`}
                >
                  {community.climateZone.replace("zone", "Z")}
                </span>
              </div>
              <div className="text-right">
                <div className="data-value text-sm">
                  {formatNumber(community.resEmissions)}
                </div>
                <div className="text-xs text-gray-500">TCO₂e (res)</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Business Insights */}
      <div className="card p-4 bg-gray-50">
        <h3 className="text-xs uppercase tracking-wider font-semibold mb-3">
          Business Insights
        </h3>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Residential Focus:</span>{" "}
            {((data.emissions.residential / data.emissions.total) * 100).toFixed(0)}% of emissions
            are residential - strong market for home heat pump conversions.
          </p>
          <p>
            <span className="font-medium">Cold Climate Premium:</span>{" "}
            {data.coldClimateOpportunity} communities require cold-climate rated equipment
            (higher margins, specialized expertise).
          </p>
          <p>
            <span className="font-medium">BC 2030 Target:</span>{" "}
            Communities need to reduce emissions 40% by 2030 - government mandates driving demand.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

