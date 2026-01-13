/**
 * British Columbia Regulatory Benchmarks for HVAC & Emissions
 * Updated: January 2025
 * 
 * Sources:
 * - CleanBC Roadmap to 2030
 * - BC Building Code 2024
 * - BC Energy Step Code
 * - Zero Carbon Step Code
 * - CleanBC Better Homes Program
 */

// =============================================================================
// BC GHG REDUCTION TARGETS (Provincial)
// =============================================================================

export const BC_GHG_TARGETS = {
  baseYear: 2007,
  targets: [
    { year: 2025, reductionPercent: 16, description: "Interim target" },
    { year: 2030, reductionPercent: 40, description: "Legislated target" },
    { year: 2040, reductionPercent: 60, description: "Legislated target" },
    { year: 2050, reductionPercent: 80, description: "Net-zero pathway" },
  ],
} as const;

// =============================================================================
// ZERO CARBON STEP CODE (Effective Dec 2024)
// =============================================================================

export const ZERO_CARBON_STEP_CODE = {
  effectiveDate: "2024-12-01",
  levels: [
    {
      level: "EL-1",
      name: "Enhanced Compliance",
      ghgiLimit: { // kg CO2e/m²/year
        residential: 12,
        commercial: 25,
      },
      description: "Base requirement for new construction",
      mandatory: true,
    },
    {
      level: "EL-2",
      name: "Low Carbon",
      ghgiLimit: {
        residential: 6,
        commercial: 15,
      },
      description: "Reduced carbon heating systems required",
      mandatory: false,
    },
    {
      level: "EL-3",
      name: "Carbon Neutral Ready",
      ghgiLimit: {
        residential: 3,
        commercial: 8,
      },
      description: "Heat pump or electric heating required",
      mandatory: false,
    },
    {
      level: "EL-4",
      name: "Zero Carbon",
      ghgiLimit: {
        residential: 0,
        commercial: 0,
      },
      description: "No on-site fossil fuel combustion",
      mandatory: false,
    },
  ],
} as const;

// =============================================================================
// BC ENERGY STEP CODE (Building Envelope)
// =============================================================================

export const BC_ENERGY_STEP_CODE = {
  targetYear: 2032, // All new buildings net-zero energy ready
  steps: [
    { step: 1, tedi: 50, meui: 130, description: "10% better than code" },
    { step: 2, tedi: 40, meui: 120, description: "20% better than code" },
    { step: 3, tedi: 30, meui: 100, description: "40% better than code" },
    { step: 4, tedi: 20, meui: 70, description: "Net-zero ready (residential)" },
    { step: 5, tedi: 15, meui: 50, description: "Net-zero ready (all)" },
  ],
  // TEDI = Thermal Energy Demand Intensity (kWh/m²/year)
  // MEUI = Mechanical Energy Use Intensity (kWh/m²/year)
} as const;

// =============================================================================
// HVAC EQUIPMENT EFFICIENCY STANDARDS (BC & Federal)
// =============================================================================

export const HVAC_EFFICIENCY_STANDARDS = {
  effectiveDate: "2025-01-01",
  
  residential: {
    gasFurnace: {
      maxInput: 66, // kW (220,000 BTU/Hr)
      minAFUE: 92, // %
      description: "Minimum AFUE for gas-fired furnaces",
    },
    gasBoiler: {
      maxInput: 88, // kW (300,000 BTU/Hr)
      minAFUE: 90, // %
      description: "Minimum AFUE for gas-fired boilers",
    },
    heatPumpAirSource: {
      maxCapacity: 19, // kW (65,000 BTU/Hr)
      minSEER: 15, // Updated 2025
      minHSPF: 8.8,
      minEER: 12.2,
      description: "Minimum efficiency for split-system heat pumps",
    },
    heatPumpColdClimate: {
      minCOP: 1.75, // at -25°C
      minSEER: 15,
      minHSPF: 10,
      description: "Cold climate heat pump requirements",
    },
    centralAC: {
      maxCapacity: 19, // kW
      minSEER: 15,
      minEER: 12.2,
      description: "Minimum efficiency for central air conditioners",
    },
  },
  
  commercial: {
    gasBoilerLarge: {
      minInput: 88, // kW
      minEfficiency: 90, // % combustion efficiency
      effectiveDate: "2023-01-01",
      description: "Large commercial gas boilers",
    },
    rooftopUnit: {
      minSEER: 14,
      minEER: 11.2,
      minIEER: 12.7,
      description: "Packaged rooftop units",
    },
    vrf: {
      minSEER: 16,
      minEER: 12,
      description: "Variable refrigerant flow systems",
    },
    chiller: {
      minCOP: 5.5, // Full load
      minIPLV: 6.4, // Integrated part load
      description: "Air-cooled chillers",
    },
  },
} as const;

// =============================================================================
// CLEANBC REBATES & INCENTIVES (2025)
// =============================================================================

export const CLEANBC_REBATES = {
  programName: "CleanBC Better Homes & Home Renovation Rebate",
  lastUpdated: "2025-01-01",
  
  heatPumps: {
    airSourceHeatPump: {
      baseRebate: 6000,
      incomeQualifiedBonus: 3000, // For households <$100k income
      switchingBonus: {
        fromGas: 2000,
        fromOil: 3000,
        fromPropane: 3000,
        fromElectricResistance: 2000,
      },
      maxTotal: 12000,
      requirements: [
        "Must be ENERGY STAR certified",
        "Minimum HSPF 8.8 / SEER 15",
        "Installed by licensed contractor",
        "Primary heating system",
      ],
    },
    coldClimateHeatPump: {
      baseRebate: 8000,
      incomeQualifiedBonus: 4000,
      switchingBonus: {
        fromGas: 2500,
        fromOil: 4000,
        fromPropane: 4000,
        fromElectricResistance: 2500,
      },
      maxTotal: 16000,
      requirements: [
        "NEEP Cold Climate certified",
        "COP ≥ 1.75 at -25°C",
        "HSPF ≥ 10",
        "Climate zones 6-8",
      ],
    },
    groundSourceHeatPump: {
      baseRebate: 10000,
      incomeQualifiedBonus: 5000,
      switchingBonus: {
        fromGas: 3000,
        fromOil: 5000,
        fromPropane: 5000,
      },
      maxTotal: 19000,
      requirements: [
        "Closed-loop or open-loop system",
        "Minimum COP 3.6",
        "10-year warranty on ground loop",
      ],
    },
    heatPumpWaterHeater: {
      baseRebate: 1000,
      incomeQualifiedBonus: 500,
      maxTotal: 1500,
      requirements: [
        "Minimum UEF 2.0",
        "Replaces gas, oil, or electric tank",
      ],
    },
  },
  
  insulation: {
    attic: { perSqFt: 0.60, maxRebate: 1600 },
    walls: { perSqFt: 1.50, maxRebate: 3600 },
    basement: { perSqFt: 1.00, maxRebate: 2000 },
    airSealing: { flat: 700, requirements: ["With other insulation upgrade"] },
  },
  
  windows: {
    energyStarMostEfficient: { perWindow: 100, maxRebate: 2000 },
    requirements: ["ENERGY STAR Most Efficient certified", "Replace single/double pane"],
  },
  
  smartThermostats: {
    rebate: 100,
    requirements: ["ENERGY STAR certified", "With heat pump installation"],
  },
} as const;

// =============================================================================
// BC HYDRO COMMERCIAL INCENTIVES (2025-2027)
// =============================================================================

export const BC_HYDRO_COMMERCIAL = {
  programName: "BC Hydro Energy Efficiency Incentives",
  applicationDeadline: "2026-02-12",
  completionDeadline: "2027-03-14",
  
  hvacUpgrades: {
    heatPumpConversion: {
      incentivePerKW: 200,
      maxIncentive: 50000,
      requirements: ["Replace gas/oil system", "Minimum COP 3.0"],
    },
    rooftopUnitUpgrade: {
      incentivePerKW: 150,
      maxIncentive: 30000,
      requirements: ["Minimum 14 SEER", "Replace existing unit"],
    },
    vrf: {
      incentivePerTon: 500,
      maxIncentive: 100000,
      requirements: ["Minimum 16 SEER", "Heat recovery capable"],
    },
    buildingAutomation: {
      percentOfCost: 50,
      maxIncentive: 75000,
      requirements: ["DDC controls", "Occupancy scheduling"],
    },
  },
  
  customProjects: {
    incentivePerKWh: 0.05, // Annual savings
    maxIncentive: 500000,
    requirements: ["Energy study required", "5+ year measure life"],
  },
} as const;

// =============================================================================
// FORTISBC INCENTIVES (Gas to Electric Conversion)
// =============================================================================

export const FORTISBC_INCENTIVES = {
  programName: "FortisBC Energy Efficiency Programs",
  
  residential: {
    heatPumpConversion: {
      incentive: 2000,
      stacksWithCleanBC: true,
      requirements: ["Replace gas furnace/boiler", "Primary heating"],
    },
    waterHeaterConversion: {
      incentive: 500,
      requirements: ["Replace gas water heater with heat pump"],
    },
  },
  
  commercial: {
    gasToElectric: {
      incentivePerGJ: 8, // Per GJ of annual gas reduction
      maxIncentive: 100000,
    },
  },
} as const;

// =============================================================================
// EMISSION FACTORS (BC Grid & Fuels)
// =============================================================================

export const BC_EMISSION_FACTORS = {
  year: 2024,
  
  electricity: {
    gridIntensity: 10.67, // g CO2e/kWh (BC Hydro - very clean)
    marginalIntensity: 40, // g CO2e/kWh (for avoided emissions calc)
  },
  
  naturalGas: {
    kgCO2ePerGJ: 49.87,
    kgCO2ePerM3: 1.89,
    kgCO2ePerTherm: 5.31,
  },
  
  propane: {
    kgCO2ePerLitre: 1.51,
    kgCO2ePerGJ: 59.36,
  },
  
  heatingOil: {
    kgCO2ePerLitre: 2.72,
    kgCO2ePerGJ: 69.19,
  },
  
  wood: {
    kgCO2ePerGJ: 0, // Considered carbon neutral in BC
    particulateMatter: true, // Air quality concern
  },
} as const;

// =============================================================================
// COMMUNITY BENCHMARKS (Per Capita Targets)
// =============================================================================

export const COMMUNITY_BENCHMARKS = {
  // Based on BC averages and CleanBC targets
  residential: {
    current2022: {
      avgPerCapita: 2.1, // tCO2e per person
      avgPerHousehold: 4.8, // tCO2e per household
    },
    target2030: {
      avgPerCapita: 1.3, // 40% reduction
      avgPerHousehold: 2.9,
    },
    target2040: {
      avgPerCapita: 0.8, // 60% reduction
      avgPerHousehold: 1.9,
    },
    excellent: {
      perCapita: 0.5, // Top performers
      perHousehold: 1.2,
    },
  },
  
  commercial: {
    // kg CO2e per m² per year
    office: { current: 45, target2030: 27, zeroCarbon: 0 },
    retail: { current: 55, target2030: 33, zeroCarbon: 0 },
    warehouse: { current: 30, target2030: 18, zeroCarbon: 0 },
    restaurant: { current: 120, target2030: 72, zeroCarbon: 0 },
    hotel: { current: 65, target2030: 39, zeroCarbon: 0 },
    healthcare: { current: 85, target2030: 51, zeroCarbon: 0 },
    education: { current: 50, target2030: 30, zeroCarbon: 0 },
  },
} as const;

// =============================================================================
// HEAT PUMP CONVERSION POTENTIAL
// =============================================================================

export const CONVERSION_FACTORS = {
  // Typical energy savings when converting to heat pump
  fromGasFurnace: {
    efficiencyGain: 2.5, // COP vs AFUE
    emissionReduction: 0.75, // 75% reduction
    costSavingsPercent: 30, // Varies by energy prices
  },
  fromOilFurnace: {
    efficiencyGain: 3.0,
    emissionReduction: 0.85,
    costSavingsPercent: 45,
  },
  fromPropane: {
    efficiencyGain: 2.8,
    emissionReduction: 0.80,
    costSavingsPercent: 50,
  },
  fromElectricResistance: {
    efficiencyGain: 3.0,
    emissionReduction: 0, // Already electric
    costSavingsPercent: 60,
  },
  fromElectricBaseboard: {
    efficiencyGain: 3.0,
    emissionReduction: 0,
    costSavingsPercent: 65,
  },
} as const;

// =============================================================================
// CLIMATE ZONES (BC)
// =============================================================================

export const BC_CLIMATE_ZONES = {
  zone4: {
    name: "Coastal",
    hdd: 2500, // Heating degree days (base 18°C)
    regions: ["Vancouver", "Victoria", "Lower Mainland", "Sunshine Coast"],
    coldClimateHeatPumpRequired: false,
  },
  zone5: {
    name: "Interior Valleys",
    hdd: 3500,
    regions: ["Kelowna", "Kamloops", "Penticton", "Vernon"],
    coldClimateHeatPumpRequired: false,
  },
  zone6: {
    name: "Mountain/Northern",
    hdd: 4500,
    regions: ["Prince George", "Williams Lake", "Cranbrook"],
    coldClimateHeatPumpRequired: true,
  },
  zone7a: {
    name: "Northern BC",
    hdd: 5500,
    regions: ["Fort St. John", "Dawson Creek", "Terrace"],
    coldClimateHeatPumpRequired: true,
  },
  zone7b: {
    name: "Far North",
    hdd: 6500,
    regions: ["Fort Nelson", "Northern Rockies"],
    coldClimateHeatPumpRequired: true,
  },
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function calculatePotentialRebate(params: {
  heatPumpType: "airSource" | "coldClimate" | "groundSource";
  currentSystem: "gas" | "oil" | "propane" | "electricResistance";
  householdIncome: number;
  includeInsulation?: boolean;
  insulationSqFt?: number;
}): {
  baseRebate: number;
  switchingBonus: number;
  incomeBonus: number;
  insulationRebate: number;
  total: number;
  maxPossible: number;
} {
  const { heatPumpType, currentSystem, householdIncome, includeInsulation, insulationSqFt } = params;
  
  const hpConfig = heatPumpType === "airSource" 
    ? CLEANBC_REBATES.heatPumps.airSourceHeatPump
    : heatPumpType === "coldClimate"
    ? CLEANBC_REBATES.heatPumps.coldClimateHeatPump
    : CLEANBC_REBATES.heatPumps.groundSourceHeatPump;
  
  const baseRebate = hpConfig.baseRebate;
  
  const switchingKey = currentSystem === "gas" ? "fromGas" 
    : currentSystem === "oil" ? "fromOil"
    : currentSystem === "propane" ? "fromPropane"
    : "fromElectricResistance";
  
  const switchingBonus = hpConfig.switchingBonus[switchingKey as keyof typeof hpConfig.switchingBonus] || 0;
  const incomeBonus = householdIncome < 100000 ? hpConfig.incomeQualifiedBonus : 0;
  
  let insulationRebate = 0;
  if (includeInsulation && insulationSqFt) {
    insulationRebate = Math.min(
      insulationSqFt * CLEANBC_REBATES.insulation.attic.perSqFt,
      CLEANBC_REBATES.insulation.attic.maxRebate
    );
  }
  
  const subtotal = baseRebate + switchingBonus + incomeBonus + insulationRebate;
  const total = Math.min(subtotal, hpConfig.maxTotal + insulationRebate);
  
  return {
    baseRebate,
    switchingBonus,
    incomeBonus,
    insulationRebate,
    total,
    maxPossible: hpConfig.maxTotal + CLEANBC_REBATES.insulation.attic.maxRebate,
  };
}

export function calculateEmissionsSavings(params: {
  currentSystem: "gas" | "oil" | "propane" | "electric";
  annualConsumption: number; // GJ for gas/oil/propane, kWh for electric
  heatPumpCOP?: number;
}): {
  currentEmissions: number; // tCO2e/year
  newEmissions: number;
  savings: number;
  savingsPercent: number;
} {
  const { currentSystem, annualConsumption, heatPumpCOP = 3.0 } = params;
  
  let currentEmissions = 0;
  let newEmissions = 0;
  
  if (currentSystem === "gas") {
    currentEmissions = (annualConsumption * BC_EMISSION_FACTORS.naturalGas.kgCO2ePerGJ) / 1000;
    // Convert GJ to kWh (1 GJ = 277.78 kWh), then divide by COP
    const electricKWh = (annualConsumption * 277.78) / heatPumpCOP;
    newEmissions = (electricKWh * BC_EMISSION_FACTORS.electricity.gridIntensity) / 1000000;
  } else if (currentSystem === "oil") {
    currentEmissions = (annualConsumption * BC_EMISSION_FACTORS.heatingOil.kgCO2ePerGJ) / 1000;
    const electricKWh = (annualConsumption * 277.78) / heatPumpCOP;
    newEmissions = (electricKWh * BC_EMISSION_FACTORS.electricity.gridIntensity) / 1000000;
  } else if (currentSystem === "propane") {
    currentEmissions = (annualConsumption * BC_EMISSION_FACTORS.propane.kgCO2ePerGJ) / 1000;
    const electricKWh = (annualConsumption * 277.78) / heatPumpCOP;
    newEmissions = (electricKWh * BC_EMISSION_FACTORS.electricity.gridIntensity) / 1000000;
  } else {
    // Electric resistance
    currentEmissions = (annualConsumption * BC_EMISSION_FACTORS.electricity.gridIntensity) / 1000000;
    newEmissions = currentEmissions / heatPumpCOP;
  }
  
  const savings = currentEmissions - newEmissions;
  const savingsPercent = currentEmissions > 0 ? (savings / currentEmissions) * 100 : 0;
  
  return {
    currentEmissions,
    newEmissions,
    savings,
    savingsPercent,
  };
}

export function getClimateZone(latitude: number): keyof typeof BC_CLIMATE_ZONES {
  // Simplified zone determination based on latitude
  if (latitude < 49.5) return "zone4"; // Coastal/Lower Mainland
  if (latitude < 51) return "zone5"; // Interior valleys
  if (latitude < 54) return "zone6"; // Mountain
  if (latitude < 57) return "zone7a"; // Northern
  return "zone7b"; // Far north
}

export function getComplianceStatus(
  emissions: number,
  segment: "residential" | "commercial",
  buildingType?: string
): {
  currentLevel: string;
  nextLevel: string;
  reductionNeeded: number;
  complianceYear: number;
} {
  const levels = ZERO_CARBON_STEP_CODE.levels;
  const limit = segment === "residential" ? "residential" : "commercial";
  
  // Find current level
  let currentLevel = "Below EL-1";
  let nextLevel = "EL-1";
  let reductionNeeded = 0;
  
  for (let i = levels.length - 1; i >= 0; i--) {
    if (emissions <= levels[i].ghgiLimit[limit]) {
      currentLevel = levels[i].level;
      nextLevel = i > 0 ? levels[i - 1].level : "Zero Carbon Achieved";
      reductionNeeded = i > 0 ? emissions - levels[i - 1].ghgiLimit[limit] : 0;
      break;
    }
  }
  
  if (currentLevel === "Below EL-1") {
    reductionNeeded = emissions - levels[0].ghgiLimit[limit];
  }
  
  return {
    currentLevel,
    nextLevel,
    reductionNeeded: Math.max(0, reductionNeeded),
    complianceYear: currentLevel === "Below EL-1" ? 2025 : 2030,
  };
}

