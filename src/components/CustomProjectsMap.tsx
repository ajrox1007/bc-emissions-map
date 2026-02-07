"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomProject {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  category: string | null;
  status: string | null;
  estimatedCost: number | null;
  metadata: string | null;
  file: { filename: string };
}

interface CustomProjectsMapProps {
  projects: CustomProject[];
}

const BC_CENTER = { lat: 53.7267, lng: -127.6476 };
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  Residential: { bg: "#10b981", border: "#059669" },
  Commercial: { bg: "#3b82f6", border: "#2563eb" },
  Industrial: { bg: "#ef4444", border: "#dc2626" },
  Infrastructure: { bg: "#f59e0b", border: "#d97706" },
  Institutional: { bg: "#8b5cf6", border: "#7c3aed" },
  Energy: { bg: "#06b6d4", border: "#0891b2" },
  default: { bg: "#6b7280", border: "#4b5563" },
};

function getColor(category: string | null) {
  if (!category) return CATEGORY_COLORS.default;
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (key !== "default" && category.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return CATEGORY_COLORS.default;
}

function formatCost(cost: number | null): string {
  if (cost === null) return "N/A";
  if (cost >= 1_000_000_000) return `$${(cost / 1_000_000_000).toFixed(1)}B`;
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(1)}K`;
  return `$${cost.toLocaleString()}`;
}

export default function CustomProjectsMap({ projects }: CustomProjectsMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mappable = useMemo(
    () => projects.filter((p) => p.latitude !== null && p.longitude !== null),
    [projects]
  );

  const selected = mappable.find((p) => p.id === selectedId);

  // Calculate center from data or use BC default
  const center = useMemo(() => {
    if (mappable.length === 0) return BC_CENTER;
    const avgLat = mappable.reduce((s, p) => s + p.latitude!, 0) / mappable.length;
    const avgLng = mappable.reduce((s, p) => s + p.longitude!, 0) / mappable.length;
    return { lat: avgLat, lng: avgLng };
  }, [mappable]);

  if (!API_KEY) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Google Maps API key not configured
      </div>
    );
  }

  if (mappable.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm text-gray-500 font-medium">No projects with coordinates</p>
          <p className="text-xs text-gray-400 mt-1">Upload files with latitude/longitude or address columns</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={center}
        defaultZoom={6}
        mapId="custom-projects-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="w-full h-full"
      >
        {mappable.map((project) => {
          const color = getColor(project.category);
          return (
            <AdvancedMarker
              key={project.id}
              position={{ lat: project.latitude!, lng: project.longitude! }}
              onClick={() => setSelectedId(project.id === selectedId ? null : project.id)}
              zIndex={project.id === selectedId ? 100 : 1}
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: project.id === selectedId ? 1.3 : 1 }}
                className="cursor-pointer"
              >
                <div
                  className="w-4 h-4 rounded-full border-2 shadow-md"
                  style={{ backgroundColor: color.bg, borderColor: color.border }}
                />
              </motion.div>
            </AdvancedMarker>
          );
        })}

        <AnimatePresence>
          {selected && (
            <InfoWindow
              position={{ lat: selected.latitude!, lng: selected.longitude! }}
              onCloseClick={() => setSelectedId(null)}
              pixelOffset={[0, -10]}
            >
              <div className="min-w-[200px] max-w-[280px] text-xs space-y-2">
                <div>
                  <h3 className="font-bold text-sm">{selected.name}</h3>
                  {selected.category && (
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-full text-white text-[10px] font-medium"
                      style={{ backgroundColor: getColor(selected.category).bg }}
                    >
                      {selected.category}
                    </span>
                  )}
                </div>
                {selected.address && (
                  <p className="text-gray-600">{selected.address}</p>
                )}
                <div className="flex gap-4">
                  {selected.estimatedCost !== null && (
                    <div>
                      <span className="text-gray-400 uppercase tracking-wider text-[10px]">Cost</span>
                      <p className="font-bold">{formatCost(selected.estimatedCost)}</p>
                    </div>
                  )}
                  {selected.status && (
                    <div>
                      <span className="text-gray-400 uppercase tracking-wider text-[10px]">Status</span>
                      <p className="font-medium">{selected.status}</p>
                    </div>
                  )}
                </div>
                {selected.metadata && (() => {
                  try {
                    const meta = JSON.parse(selected.metadata);
                    const entries = Object.entries(meta).slice(0, 4);
                    if (entries.length === 0) return null;
                    return (
                      <div className="border-t pt-2 space-y-1">
                        {entries.map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-gray-400">{k}</span>
                            <span className="font-medium truncate ml-2">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } catch { return null; }
                })()}
                <p className="text-gray-400 text-[10px]">
                  Source: {selected.file.filename}
                </p>
              </div>
            </InfoWindow>
          )}
        </AnimatePresence>
      </Map>
    </APIProvider>
  );
}
