"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Project {
  id: string;
  projectId: number;
  name: string;
  description: string | null;
  estimatedCost: number;
  constructionType: string;
  projectType: string;
  region: string;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  developer: string | null;
  projectStatus: string;
  greenBuilding: boolean;
  cleanEnergy: boolean;
  startDate: string | null;
  completionDate: string | null;
}

interface ProjectsMapProps {
  projects: Project[];
  onProjectSelect: (projectId: string) => void;
  selectedProjectId: string | null;
}

const BC_CENTER = { lat: 53.7267, lng: -127.6476 };
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Color scheme for construction types
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Residential": { bg: "#10b981", border: "#059669", text: "#ffffff" },
  "Commercial": { bg: "#3b82f6", border: "#2563eb", text: "#ffffff" },
  "Infrastructure": { bg: "#f59e0b", border: "#d97706", text: "#000000" },
  "Institutional": { bg: "#8b5cf6", border: "#7c3aed", text: "#ffffff" },
  "Industrial": { bg: "#ef4444", border: "#dc2626", text: "#ffffff" },
};

function formatCost(cost: number): string {
  if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(1)}B`;
  }
  return `$${cost}M`;
}

function ProjectMarker({
  project,
  position,
  isSelected,
  onClick,
  onViewDetails,
}: {
  project: Project;
  position: { lat: number; lng: number };
  isSelected: boolean;
  onClick: () => void;
  onViewDetails: () => void;
}) {
  const colors = TYPE_COLORS[project.constructionType] || TYPE_COLORS["Infrastructure"];
  const isProposed = project.projectStatus === "Proposed";

  return (
    <>
      <AdvancedMarker
        position={position}
        onClick={onClick}
        zIndex={isSelected ? 100 : project.estimatedCost}
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: isSelected ? 1.2 : 1 }}
          className="relative cursor-pointer"
        >
          <div
            className="px-2 py-1 rounded-md shadow-lg flex items-center gap-1"
            style={{
              backgroundColor: colors.bg,
              border: `2px ${isProposed ? "dashed" : "solid"} ${colors.border}`,
              color: colors.text,
            }}
          >
            <span className="text-xs font-bold">{formatCost(project.estimatedCost)}</span>
            {project.greenBuilding && <span className="text-xs">🌿</span>}
            {project.cleanEnergy && <span className="text-xs">⚡</span>}
          </div>
          {/* Pin tail */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `8px solid ${colors.border}`,
            }}
          />
        </motion.div>
      </AdvancedMarker>

      {isSelected && (
        <InfoWindow
          position={position}
          onCloseClick={onClick}
          pixelOffset={[0, -30]}
        >
          <div className="p-2 min-w-[280px] max-w-[320px]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-sm leading-tight">{project.name}</h3>
              <span
                className="px-2 py-0.5 text-xs rounded-full whitespace-nowrap"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {project.constructionType}
              </span>
            </div>

            <div className="space-y-1 text-xs text-gray-600 mb-3">
              <div className="flex justify-between">
                <span>Developer:</span>
                <span className="font-medium text-black">{project.developer}</span>
              </div>
              <div className="flex justify-between">
                <span>Value:</span>
                <span className="font-bold text-black">{formatCost(project.estimatedCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-medium ${isProposed ? "text-amber-600" : "text-green-600"}`}>
                  {project.projectStatus}
                </span>
              </div>
              {project.municipality && (
                <div className="flex justify-between">
                  <span>Location:</span>
                  <span className="font-medium text-black">{project.municipality}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {project.greenBuilding && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                  🌿 Green Building
                </span>
              )}
              {project.cleanEnergy && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                  ⚡ Clean Energy
                </span>
              )}
            </div>

            <button
              onClick={onViewDetails}
              className="mt-3 w-full py-1.5 bg-black text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors"
            >
              View Details →
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// Helper to calculate offset positions for overlapping projects
function calculateProjectPositions(projects: Project[]): globalThis.Map<string, { lat: number; lng: number }> {
  const positionMap = new globalThis.Map<string, { lat: number; lng: number }>();
  const locationGroups = new globalThis.Map<string, Project[]>();

  // Group projects by location (rounded to avoid floating point issues)
  projects.forEach((project) => {
    if (project.latitude && project.longitude) {
      const key = `${project.latitude.toFixed(5)},${project.longitude.toFixed(5)}`;
      const group = locationGroups.get(key) || [];
      group.push(project);
      locationGroups.set(key, group);
    }
  });

  // Calculate positions with offsets for overlapping projects
  locationGroups.forEach((group, locationKey) => {
    if (group.length === 1) {
      // Single project - use original position
      const project = group[0];
      positionMap.set(project.id, {
        lat: project.latitude!,
        lng: project.longitude!,
      });
    } else {
      // Multiple projects at same location - arrange in a circle
      const [baseLat, baseLng] = locationKey.split(',').map(Number);
      const radius = 0.01; // Offset radius in degrees (roughly 1km)
      const angleStep = (2 * Math.PI) / group.length;

      group.forEach((project, index) => {
        const angle = index * angleStep;
        const offsetLat = baseLat + (radius * Math.cos(angle));
        const offsetLng = baseLng + (radius * Math.sin(angle));
        positionMap.set(project.id, { lat: offsetLat, lng: offsetLng });
      });
    }
  });

  return positionMap;
}

function MapContent({
  projects,
  onProjectSelect,
  selectedProjectId,
}: ProjectsMapProps) {
  const map = useMap();
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  // Calculate positions with offsets for overlapping projects
  const projectPositions = useMemo(() => {
    return calculateProjectPositions(projects);
  }, [projects]);

  // Fit bounds to show all projects
  useEffect(() => {
    if (!map || projects.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    projects.forEach((project) => {
      if (project.latitude && project.longitude) {
        bounds.extend({ lat: project.latitude, lng: project.longitude });
      }
    });
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [map, projects]);

  const handleMarkerClick = useCallback((projectId: string) => {
    setActiveMarkerId((prev) => (prev === projectId ? null : projectId));
  }, []);

  return (
    <>
      {projects.map((project) => {
        const position = projectPositions.get(project.id);
        return (
          position && (
            <ProjectMarker
              key={project.id}
              project={project}
              position={position}
              isSelected={activeMarkerId === project.id}
              onClick={() => handleMarkerClick(project.id)}
              onViewDetails={() => {
                onProjectSelect(project.id);
                setActiveMarkerId(null);
              }}
            />
          )
        );
      })}
    </>
  );
}

export default function ProjectsMap({ projects, onProjectSelect, selectedProjectId }: ProjectsMapProps) {
  if (!API_KEY) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <h3 className="text-lg font-bold mb-2">Map Unavailable</h3>
          <p className="text-sm text-gray-600">Google Maps API key not configured.</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={BC_CENTER}
        defaultZoom={5}
        mapId="bc-projects-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="w-full h-full"
      >
        <MapContent
          projects={projects}
          onProjectSelect={onProjectSelect}
          selectedProjectId={selectedProjectId}
        />
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
        <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Legend</h4>
        <div className="space-y-1">
          {Object.entries(TYPE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-4 h-3 rounded"
                style={{ backgroundColor: colors.bg }}
              />
              <span className="text-xs">{type}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-3 border-2 border-dashed border-gray-400" />
            <span>Proposed</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-3 border-2 border-solid border-gray-400" />
            <span>Under Construction</span>
          </div>
        </div>
      </div>
    </APIProvider>
  );
}

