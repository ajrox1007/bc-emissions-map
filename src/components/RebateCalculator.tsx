"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RebateCalculator() {
  const [heatPumpType, setHeatPumpType] = useState<"airSource" | "coldClimate" | "groundSource">("airSource");
  const [currentSystem, setCurrentSystem] = useState<"gas" | "oil" | "propane" | "electricResistance">("gas");
  const [householdIncome, setHouseholdIncome] = useState(80000);
  const [includeInsulation, setIncludeInsulation] = useState(false);
  const [insulationSqFt, setInsulationSqFt] = useState(1000);
  const [isCommercial, setIsCommercial] = useState(false);
  const [commercialKW, setCommercialKW] = useState(50);

  const { data: rebateData, isLoading } = trpc.calculateRebate.useQuery({
    heatPumpType,
    currentSystem,
    householdIncome,
    includeInsulation,
    insulationSqFt: includeInsulation ? insulationSqFt : undefined,
    isCommercial,
    commercialKW: isCommercial ? commercialKW : undefined,
  });

  // Also get savings estimate
  const { data: savingsData } = trpc.calculateSavings.useQuery({
    currentSystem: currentSystem === "electricResistance" ? "electric" : currentSystem,
    annualConsumption: currentSystem === "electricResistance" ? 15000 : 80, // kWh or GJ
    heatPumpCOP: heatPumpType === "groundSource" ? 4.0 : heatPumpType === "coldClimate" ? 3.2 : 3.0,
    annualEnergyCost: 2000,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="border-b border-black pb-4">
        <h2 className="text-xl font-bold">CleanBC Rebate Calculator</h2>
        <p className="text-sm text-gray-500 mt-1">
          2025 incentives · Updated January 2025
        </p>
      </div>

      {/* Toggle Residential/Commercial */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsCommercial(false)}
          className={`btn flex-1 ${!isCommercial ? "btn-primary" : ""}`}
        >
          Residential
        </button>
        <button
          onClick={() => setIsCommercial(true)}
          className={`btn flex-1 ${isCommercial ? "btn-primary" : ""}`}
        >
          Commercial
        </button>
      </div>

      {!isCommercial ? (
        /* Residential Form */
        <div className="space-y-4">
          {/* Heat Pump Type */}
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold block mb-2">
              Heat Pump Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "airSource", label: "Air Source", desc: "Most common" },
                { id: "coldClimate", label: "Cold Climate", desc: "Northern BC" },
                { id: "groundSource", label: "Ground Source", desc: "Highest efficiency" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setHeatPumpType(type.id as typeof heatPumpType)}
                  className={`card p-3 text-left ${
                    heatPumpType === type.id ? "border-2 border-black bg-gray-50" : ""
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Heating System */}
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold block mb-2">
              Current Heating System
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "gas", label: "Natural Gas", bonus: "$2,000-$3,000" },
                { id: "oil", label: "Heating Oil", bonus: "$3,000-$5,000" },
                { id: "propane", label: "Propane", bonus: "$3,000-$5,000" },
                { id: "electricResistance", label: "Electric Baseboard", bonus: "$2,000-$2,500" },
              ].map((system) => (
                <button
                  key={system.id}
                  onClick={() => setCurrentSystem(system.id as typeof currentSystem)}
                  className={`card p-3 text-left ${
                    currentSystem === system.id ? "border-2 border-black bg-gray-50" : ""
                  }`}
                >
                  <div className="font-medium text-sm">{system.label}</div>
                  <div className="text-xs text-green-600">+{system.bonus} bonus</div>
                </button>
              ))}
            </div>
          </div>

          {/* Household Income */}
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold block mb-2">
              Household Income
            </label>
            <div className="flex gap-4 items-center">
              <input
                type="range"
                min={30000}
                max={200000}
                step={5000}
                value={householdIncome}
                onChange={(e) => setHouseholdIncome(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="data-value w-24 text-right">
                {formatCurrency(householdIncome)}
              </span>
            </div>
            {householdIncome < 100000 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Eligible for income-qualified bonus (+$3,000-$5,000)
              </p>
            )}
          </div>

          {/* Insulation Add-on */}
          <div className="card p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInsulation}
                onChange={(e) => setIncludeInsulation(e.target.checked)}
              />
              <div>
                <div className="font-medium text-sm">Add Attic Insulation</div>
                <div className="text-xs text-gray-500">Up to $1,600 additional rebate</div>
              </div>
            </label>
            {includeInsulation && (
              <div className="mt-3 flex gap-4 items-center">
                <input
                  type="range"
                  min={200}
                  max={3000}
                  step={100}
                  value={insulationSqFt}
                  onChange={(e) => setInsulationSqFt(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="data-value text-sm">{insulationSqFt} sq ft</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Commercial Form */
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold block mb-2">
              System Capacity (kW)
            </label>
            <div className="flex gap-4 items-center">
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={commercialKW}
                onChange={(e) => setCommercialKW(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="data-value w-24 text-right">{commercialKW} kW</span>
            </div>
          </div>

          <div className="card p-4 bg-blue-50">
            <h4 className="font-semibold text-sm mb-2">BC Hydro Commercial Incentives</h4>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>• $200/kW for heat pump conversions</li>
              <li>• Up to $50,000 maximum per project</li>
              <li>• Application deadline: Feb 12, 2026</li>
              <li>• Completion deadline: Mar 14, 2027</li>
            </ul>
          </div>
        </div>
      )}

      {/* Results */}
      {rebateData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="divider" />

          <h3 className="text-xs uppercase tracking-wider font-semibold">
            Your Estimated Rebates
          </h3>

          {rebateData.type === "residential" && rebateData.cleanBCRebate ? (
            <div className="card overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span>Base Heat Pump Rebate</span>
                  <span className="data-value font-medium">
                    {formatCurrency(rebateData.cleanBCRebate.baseRebate)}
                  </span>
                </div>
                {rebateData.cleanBCRebate.switchingBonus > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Fuel Switching Bonus</span>
                    <span className="data-value font-medium">
                      +{formatCurrency(rebateData.cleanBCRebate.switchingBonus)}
                    </span>
                  </div>
                )}
                {rebateData.cleanBCRebate.incomeBonus > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Income-Qualified Bonus</span>
                    <span className="data-value font-medium">
                      +{formatCurrency(rebateData.cleanBCRebate.incomeBonus)}
                    </span>
                  </div>
                )}
                {rebateData.cleanBCRebate.insulationRebate > 0 && (
                  <div className="flex justify-between">
                    <span>Insulation Rebate</span>
                    <span className="data-value font-medium">
                      +{formatCurrency(rebateData.cleanBCRebate.insulationRebate)}
                    </span>
                  </div>
                )}
                {rebateData.fortisBonus && rebateData.fortisBonus > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>FortisBC Bonus (stackable)</span>
                    <span className="data-value font-medium">
                      +{formatCurrency(rebateData.fortisBonus)}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-black text-white flex justify-between items-center">
                <span className="font-semibold">Total Rebate</span>
                <span className="text-2xl font-bold data-value">
                  {formatCurrency(rebateData.totalRebate)}
                </span>
              </div>
            </div>
          ) : rebateData.type === "commercial" && rebateData.bcHydroIncentive !== undefined ? (
            <div className="card overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span>BC Hydro Incentive</span>
                  <span className="data-value font-medium">
                    {formatCurrency(rebateData.bcHydroIncentive)}
                  </span>
                </div>
                {rebateData.fortisIncentive && rebateData.fortisIncentive > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>FortisBC Gas Conversion</span>
                    <span className="data-value font-medium">
                      +{formatCurrency(rebateData.fortisIncentive)}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-black text-white flex justify-between items-center">
                <span className="font-semibold">Total Incentive</span>
                <span className="text-2xl font-bold data-value">
                  {formatCurrency(rebateData.totalIncentive)}
                </span>
              </div>
            </div>
          ) : null}

          {/* Savings Estimate */}
          {savingsData && !isCommercial && (
            <div className="card p-4 bg-green-50">
              <h4 className="font-semibold text-sm mb-3">Estimated Annual Savings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Emissions</p>
                  <p className="text-lg font-bold data-value status-green">
                    -{savingsData.annual.emissionsSavings.toFixed(1)} tCO₂e
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Energy Costs</p>
                  <p className="text-lg font-bold data-value">
                    {formatCurrency(savingsData.annual.costSavings)}/yr
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-gray-600">
                  Lifetime savings (15 yrs): {formatCurrency(savingsData.lifetime.costSavings)} + {savingsData.lifetime.emissionsSavings.toFixed(0)} tCO₂e
                </p>
              </div>
            </div>
          )}

          {/* Requirements */}
          <div className="text-xs text-gray-500">
            <h4 className="font-semibold uppercase tracking-wider mb-2">Requirements</h4>
            <ul className="space-y-1">
              {rebateData.requirements?.map((req, i) => (
                <li key={i}>• {req}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 pt-4 border-t border-gray-200">
        <p>
          Rebate amounts are estimates based on CleanBC Better Homes program guidelines.
          Actual amounts may vary. Visit{" "}
          <a
            href="https://betterhomesbc.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            betterhomesbc.ca
          </a>{" "}
          for official information.
        </p>
      </div>
    </motion.div>
  );
}

