"use client";

import { useCallback, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { motion, AnimatePresence } from "framer-motion";

interface Community {
  id: string;
  orgName: string;
  latitude: number | null;
  longitude: number | null;
  totalEmissions: number;
  resEmissions: number;
  csmiEmissions: number;
  mixedEmissions: number;
  filteredEmissions: number;
  exceedsThreshold: boolean;
  thresholdDiff: number;
  thresholdPercent: number;
}

interface EmissionsMapProps {
  communities: Community[];
  threshold: number;
  onCommunitySelect: (community: Community) => void;
  selectedCommunityId: string | null;
}

// BC geographic bounds
const BC_CENTER = { lat: 53.7267, lng: -127.6476 };
const BC_BOUNDS = {
  north: 60.0,
  south: 48.3,
  east: -114.0,
  west: -139.0,
};

function formatEmissions(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function getMarkerColor(
  emissions: number,
  threshold: number
): "green" | "yellow" | "red" {
  const ratio = emissions / threshold;
  if (ratio <= 0.5) return "green";
  if (ratio <= 1) return "yellow";
  return "red";
}

function MarkerCluster({
  communities,
  threshold,
  onCommunitySelect,
  selectedCommunityId,
}: {
  communities: Community[];
  threshold: number;
  onCommunitySelect: (community: Community) => void;
  selectedCommunityId: string | null;
}) {
  const map = useMap();
  const [infoWindowOpen, setInfoWindowOpen] = useState<string | null>(null);

  const handleMarkerClick = useCallback(
    (community: Community) => {
      setInfoWindowOpen(community.id);
    },
    []
  );

  const handleInfoWindowClose = useCallback(() => {
    setInfoWindowOpen(null);
  }, []);

  const handleViewDetails = useCallback(
    (community: Community) => {
      onCommunitySelect(community);
      setInfoWindowOpen(null);
    },
    [onCommunitySelect]
  );

  return (
    <>
      {communities.map((community) => {
        if (!community.latitude || !community.longitude) return null;

        const color = getMarkerColor(community.filteredEmissions, threshold);
        const isSelected = selectedCommunityId === community.id;
        const size = Math.min(Math.max(community.filteredEmissions / 50000, 12), 40);

        return (
          <AdvancedMarker
            key={community.id}
            position={{ lat: community.latitude, lng: community.longitude }}
            onClick={() => handleMarkerClick(community)}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{
                width: size,
                height: size,
                backgroundColor:
                  color === "green"
                    ? "var(--color-green)"
                    : color === "yellow"
                    ? "var(--color-yellow)"
                    : "var(--color-red)",
                border: isSelected ? "3px solid var(--color-black)" : "2px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {size > 24 && (
                <span
                  style={{
                    color: "white",
                    fontSize: "8px",
                    fontWeight: "bold",
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {formatEmissions(community.filteredEmissions)}
                </span>
              )}
            </motion.div>
          </AdvancedMarker>
        );
      })}

      <AnimatePresence>
        {infoWindowOpen && (
          <InfoWindowContent
            community={communities.find((c) => c.id === infoWindowOpen)!}
            threshold={threshold}
            onClose={handleInfoWindowClose}
            onViewDetails={handleViewDetails}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function InfoWindowContent({
  community,
  threshold,
  onClose,
  onViewDetails,
}: {
  community: Community;
  threshold: number;
  onClose: () => void;
  onViewDetails: (community: Community) => void;
}) {
  if (!community.latitude || !community.longitude) return null;

  const color = getMarkerColor(community.filteredEmissions, threshold);

  return (
    <InfoWindow
      position={{ lat: community.latitude, lng: community.longitude }}
      onCloseClick={onClose}
      pixelOffset={[0, -20]}
    >
      <div className="p-2 min-w-[200px]">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-sm leading-tight">{community.orgName}</h3>
          <div
            className="w-3 h-3 flex-shrink-0 ml-2"
            style={{
              backgroundColor:
                color === "green"
                  ? "var(--color-green)"
                  : color === "yellow"
                  ? "var(--color-yellow)"
                  : "var(--color-red)",
            }}
          />
        </div>

        <div className="divider mb-2" />

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500 uppercase tracking-wider">Total</span>
            <span className="data-value font-medium">
              {formatEmissions(community.filteredEmissions)} TCO₂e
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500 uppercase tracking-wider">Threshold</span>
            <span
              className={`data-value font-medium ${
                community.exceedsThreshold ? "status-red" : "status-green"
              }`}
            >
              {community.exceedsThreshold ? "+" : ""}
              {community.thresholdPercent.toFixed(0)}%
            </span>
          </div>
        </div>

        <button
          onClick={() => onViewDetails(community)}
          className="btn w-full mt-3 text-xs"
        >
          View Details
        </button>
      </div>
    </InfoWindow>
  );
}

export default function EmissionsMap({
  communities,
  threshold,
  onCommunitySelect,
  selectedCommunityId,
}: EmissionsMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Custom map styles - Swiss minimalist
  const mapStyles = useMemo(
    () => [
      {
        featureType: "all",
        elementType: "labels.text.fill",
        stylers: [{ color: "#0A0A0A" }],
      },
      {
        featureType: "all",
        elementType: "labels.text.stroke",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "administrative",
        elementType: "geometry.stroke",
        stylers: [{ color: "#0A0A0A" }, { weight: 0.5 }],
      },
      {
        featureType: "landscape",
        elementType: "geometry",
        stylers: [{ color: "#F5F5F5" }],
      },
      {
        featureType: "poi",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#FFFFFF" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#E5E5E5" }],
      },
      {
        featureType: "transit",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#D4D4D4" }],
      },
    ],
    []
  );

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 border border-black">
        <div className="text-center p-8">
          <h3 className="font-bold mb-2">Map Unavailable</h3>
          <p className="text-sm text-gray-500">
            Google Maps API key not configured.
            <br />
            Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local
          </p>
          <div className="mt-4 p-4 border border-black bg-white">
            <p className="text-xs font-mono">
              Communities loaded: {communities.length}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={BC_CENTER}
        defaultZoom={5}
        mapId="bc-emissions-map"
        style={{ width: "100%", height: "100%" }}
        restriction={{
          latLngBounds: BC_BOUNDS,
          strictBounds: false,
        }}
        disableDefaultUI={true}
        zoomControl={true}
        styles={mapStyles}
      >
        <MarkerCluster
          communities={communities}
          threshold={threshold}
          onCommunitySelect={onCommunitySelect}
          selectedCommunityId={selectedCommunityId}
        />
      </Map>
    </APIProvider>
  );
}

