"use client";

import { motion } from "framer-motion";

type Segment = "Res" | "CSMI" | "MIXED";

interface FilterControlsProps {
  selectedSegments: Segment[];
  onSegmentsChange: (segments: Segment[]) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  onReset: () => void;
}

const SEGMENTS: { id: Segment; label: string; description: string }[] = [
  { id: "Res", label: "Residential", description: "Homes & housing" },
  { id: "CSMI", label: "Commercial", description: "Business & industrial" },
  { id: "MIXED", label: "Mixed", description: "Combined use" },
];

function formatThreshold(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

export default function FilterControls({
  selectedSegments,
  onSegmentsChange,
  threshold,
  onThresholdChange,
  onReset,
}: FilterControlsProps) {
  const handleSegmentToggle = (segment: Segment) => {
    if (selectedSegments.includes(segment)) {
      onSegmentsChange(selectedSegments.filter((s) => s !== segment));
    } else {
      onSegmentsChange([...selectedSegments, segment]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSegments.length === SEGMENTS.length) {
      onSegmentsChange([]);
    } else {
      onSegmentsChange(SEGMENTS.map((s) => s.id));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Segment Filter */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs uppercase tracking-wider font-semibold">
            Emission Segments
          </h4>
          <button
            onClick={handleSelectAll}
            className="text-xs uppercase tracking-wider hover:underline"
          >
            {selectedSegments.length === SEGMENTS.length ? "Clear" : "All"}
          </button>
        </div>

        <div className="space-y-2">
          {SEGMENTS.map((segment) => (
            <label
              key={segment.id}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedSegments.includes(segment.id)}
                onChange={() => handleSegmentToggle(segment.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm group-hover:underline">
                  {segment.label}
                </div>
                <div className="text-xs text-gray-500">{segment.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* Threshold Slider */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs uppercase tracking-wider font-semibold">
            Threshold
          </h4>
          <span className="data-value text-sm font-medium">
            {formatThreshold(threshold)} TCO₂e
          </span>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={1000000}
            step={1000}
            value={threshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value))}
            className="w-full"
          />

          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span>250K</span>
            <span>500K</span>
            <span>750K</span>
            <span>1M</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Communities exceeding this threshold are marked in red.
        </p>
      </div>

      <div className="divider" />

      {/* Preset Thresholds */}
      <div>
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
          Quick Thresholds
        </h4>

        <div className="grid grid-cols-2 gap-2">
          {[5000, 10000, 50000, 100000].map((preset) => (
            <button
              key={preset}
              onClick={() => onThresholdChange(preset)}
              className={`btn text-xs ${
                threshold === preset ? "btn-primary" : ""
              }`}
            >
              {formatThreshold(preset)}
            </button>
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* Reset Button */}
      <button onClick={onReset} className="btn btn-danger w-full">
        Reset Filters
      </button>

      {/* Legend */}
      <div className="pt-4">
        <h4 className="text-xs uppercase tracking-wider font-semibold mb-3">
          Legend
        </h4>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 marker-green" />
            <span className="text-xs">Below 50% of threshold</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 marker-yellow" />
            <span className="text-xs">50-100% of threshold</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 marker-red" />
            <span className="text-xs">Exceeds threshold</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

