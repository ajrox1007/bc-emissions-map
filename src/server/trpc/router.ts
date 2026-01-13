import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  BC_GHG_TARGETS,
  ZERO_CARBON_STEP_CODE,
  CLEANBC_REBATES,
  BC_HYDRO_COMMERCIAL,
  FORTISBC_INCENTIVES,
  BC_EMISSION_FACTORS,
  COMMUNITY_BENCHMARKS,
  CONVERSION_FACTORS,
  BC_CLIMATE_ZONES,
  calculatePotentialRebate,
  calculateEmissionsSavings,
  getClimateZone,
  getComplianceStatus,
} from "@/lib/bc-benchmarks";

export const appRouter = router({
  // Get all communities with emissions data
  getAllCommunities: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.community.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { totalEmissions: "desc" },
    });
  }),

  // Get filtered communities by segment and threshold
  getFilteredCommunities: publicProcedure
    .input(
      z.object({
        segments: z.array(z.enum(["Res", "CSMI", "MIXED"])).optional(),
        threshold: z.number().optional(),
        minEmissions: z.number().optional(),
        maxEmissions: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { segments, threshold = 10000, minEmissions, maxEmissions } = input;

      const communities = await ctx.prisma.community.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { totalEmissions: "desc" },
      });

      // Calculate filtered emissions and add metadata
      const result = communities.map((community) => {
        // Calculate emissions based on selected segments
        let filteredEmissions = community.totalEmissions;
        if (segments && segments.length > 0) {
          filteredEmissions = 0;
          if (segments.includes("Res")) filteredEmissions += community.resEmissions;
          if (segments.includes("CSMI")) filteredEmissions += community.csmiEmissions;
          if (segments.includes("MIXED")) filteredEmissions += community.mixedEmissions;
        }

        return {
          id: community.id,
          orgUnit: community.orgUnit,
          orgName: community.orgName,
          latitude: community.latitude,
          longitude: community.longitude,
          totalEmissions: community.totalEmissions,
          resEmissions: community.resEmissions,
          csmiEmissions: community.csmiEmissions,
          mixedEmissions: community.mixedEmissions,
          filteredEmissions,
          exceedsThreshold: filteredEmissions > threshold,
          thresholdDiff: filteredEmissions - threshold,
          thresholdPercent: ((filteredEmissions - threshold) / threshold) * 100,
        };
      });

      // Apply emission range filters
      let filtered = result;
      if (minEmissions !== undefined) {
        filtered = filtered.filter((c) => c.filteredEmissions >= minEmissions);
      }
      if (maxEmissions !== undefined) {
        filtered = filtered.filter((c) => c.filteredEmissions <= maxEmissions);
      }

      return filtered;
    }),

  // Get community details with segment breakdown
  getCommunityDetails: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const community = await ctx.prisma.community.findUnique({
        where: { id: input.id },
        include: {
          emissionsData: {
            orderBy: { emissions: "desc" },
          },
        },
      });

      if (!community) {
        throw new Error("Community not found");
      }

      // Group emissions by source
      const emissionsBySource = community.emissionsData.reduce(
        (acc, data) => {
          if (!acc[data.source]) {
            acc[data.source] = { res: 0, csmi: 0, mixed: 0, total: 0 };
          }
          if (data.subSector === "Res") acc[data.source].res += data.emissions;
          if (data.subSector === "CSMI") acc[data.source].csmi += data.emissions;
          if (data.subSector === "MIXED") acc[data.source].mixed += data.emissions;
          acc[data.source].total += data.emissions;
          return acc;
        },
        {} as Record<string, { res: number; csmi: number; mixed: number; total: number }>
      );

      return {
        ...community,
        emissionsBySource,
      };
    }),

  // Get summary statistics
  getSummaryStats: publicProcedure
    .input(
      z.object({
        segments: z.array(z.enum(["Res", "CSMI", "MIXED"])).optional(),
        threshold: z.number().default(10000),
      })
    )
    .query(async ({ ctx, input }) => {
      const { segments, threshold } = input;

      const communities = await ctx.prisma.community.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
      });

      const totalCommunities = communities.length;

      // Calculate emissions based on segments
      const communitiesWithEmissions = communities.map((c) => {
        let emissions = c.totalEmissions;
        if (segments && segments.length > 0) {
          emissions = 0;
          if (segments.includes("Res")) emissions += c.resEmissions;
          if (segments.includes("CSMI")) emissions += c.csmiEmissions;
          if (segments.includes("MIXED")) emissions += c.mixedEmissions;
        }
        return { ...c, calculatedEmissions: emissions };
      });

      const totalEmissions = communitiesWithEmissions.reduce(
        (sum, c) => sum + c.calculatedEmissions,
        0
      );

      const avgEmissions = totalCommunities > 0 ? totalEmissions / totalCommunities : 0;

      const exceedingThreshold = communitiesWithEmissions.filter(
        (c) => c.calculatedEmissions > threshold
      ).length;

      const percentExceeding =
        totalCommunities > 0 ? (exceedingThreshold / totalCommunities) * 100 : 0;

      // Segment breakdown
      const segmentTotals = {
        residential: communities.reduce((sum, c) => sum + c.resEmissions, 0),
        commercial: communities.reduce((sum, c) => sum + c.csmiEmissions, 0),
        mixed: communities.reduce((sum, c) => sum + c.mixedEmissions, 0),
      };

      // Average by segment
      const segmentAverages = {
        residential: totalCommunities > 0 ? segmentTotals.residential / totalCommunities : 0,
        commercial: totalCommunities > 0 ? segmentTotals.commercial / totalCommunities : 0,
        mixed: totalCommunities > 0 ? segmentTotals.mixed / totalCommunities : 0,
      };

      // Top 10 communities
      const top10 = [...communitiesWithEmissions]
        .sort((a, b) => b.calculatedEmissions - a.calculatedEmissions)
        .slice(0, 10)
        .map((c) => ({
          id: c.id,
          name: c.orgName,
          emissions: c.calculatedEmissions,
          exceedsThreshold: c.calculatedEmissions > threshold,
        }));

      return {
        totalCommunities,
        totalEmissions,
        avgEmissions,
        exceedingThreshold,
        percentExceeding,
        segmentTotals,
        segmentAverages,
        top10,
        threshold,
      };
    }),

  // ==========================================================================
  // HVAC BUSINESS FEATURES
  // ==========================================================================

  // Get BC regulatory benchmarks
  getBCBenchmarks: publicProcedure.query(() => {
    return {
      ghgTargets: BC_GHG_TARGETS,
      zeroCarbonStepCode: ZERO_CARBON_STEP_CODE,
      communityBenchmarks: COMMUNITY_BENCHMARKS,
      emissionFactors: BC_EMISSION_FACTORS,
      climateZones: BC_CLIMATE_ZONES,
    };
  }),

  // Heat Pump Conversion Opportunity Finder
  getConversionOpportunities: publicProcedure
    .input(
      z.object({
        minResEmissions: z.number().optional(),
        sortBy: z.enum(["emissions", "potential", "roi"]).default("potential"),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const { minResEmissions = 1000, sortBy, limit } = input;

      const communities = await ctx.prisma.community.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          resEmissions: { gte: minResEmissions },
        },
      });

      const opportunities = communities.map((community) => {
        const climateZone = getClimateZone(community.latitude!);
        const zoneConfig = BC_CLIMATE_ZONES[climateZone];
        
        // Estimate households (rough estimate: 4.8 tCO2e per household average)
        const estimatedHouseholds = Math.round(
          community.resEmissions / COMMUNITY_BENCHMARKS.residential.current2022.avgPerHousehold / 1000
        );

        // Calculate conversion potential (assume 60% of residential emissions are from gas/oil heating)
        const heatingEmissions = community.resEmissions * 0.6;
        const potentialSavings = heatingEmissions * CONVERSION_FACTORS.fromGasFurnace.emissionReduction;
        
        // Estimate annual GJ consumption from emissions
        const estimatedGJConsumption = (heatingEmissions / BC_EMISSION_FACTORS.naturalGas.kgCO2ePerGJ) * 1000;
        
        // Calculate potential rebate value for the community
        const avgRebatePerHome = 8000; // Average including switching bonus
        const totalRebatePotential = estimatedHouseholds * avgRebatePerHome;
        
        // Market opportunity score (0-100)
        const marketScore = Math.min(100, Math.round(
          (potentialSavings / 10000) * 30 + // Emissions weight
          (estimatedHouseholds / 100) * 40 + // Volume weight
          (zoneConfig.coldClimateHeatPumpRequired ? 30 : 20) // Cold climate bonus
        ));

        // Compliance status
        const perCapitaEmissions = community.resEmissions / Math.max(estimatedHouseholds * 2.5, 1);
        const compliance = getComplianceStatus(perCapitaEmissions, "residential");

        return {
          id: community.id,
          orgName: community.orgName,
          latitude: community.latitude,
          longitude: community.longitude,
          resEmissions: community.resEmissions,
          csmiEmissions: community.csmiEmissions,
          totalEmissions: community.totalEmissions,
          climateZone,
          coldClimateRequired: zoneConfig.coldClimateHeatPumpRequired,
          estimatedHouseholds,
          heatingEmissions,
          potentialSavings,
          estimatedGJConsumption,
          totalRebatePotential,
          marketScore,
          compliance,
          // BC 2030 target comparison
          target2030Gap: community.resEmissions - (community.resEmissions * 0.6), // 40% reduction needed
          priority: marketScore >= 70 ? "high" : marketScore >= 40 ? "medium" : "low",
        };
      });

      // Sort based on criteria
      const sorted = opportunities.sort((a, b) => {
        if (sortBy === "emissions") return b.resEmissions - a.resEmissions;
        if (sortBy === "roi") return b.totalRebatePotential - a.totalRebatePotential;
        return b.marketScore - a.marketScore;
      });

      return {
        opportunities: sorted.slice(0, limit),
        summary: {
          totalCommunities: opportunities.length,
          highPriority: opportunities.filter((o) => o.priority === "high").length,
          mediumPriority: opportunities.filter((o) => o.priority === "medium").length,
          totalPotentialSavings: opportunities.reduce((sum, o) => sum + o.potentialSavings, 0),
          totalRebatePotential: opportunities.reduce((sum, o) => sum + o.totalRebatePotential, 0),
          totalEstimatedHouseholds: opportunities.reduce((sum, o) => sum + o.estimatedHouseholds, 0),
        },
      };
    }),

  // Calculate rebate for a specific scenario
  calculateRebate: publicProcedure
    .input(
      z.object({
        heatPumpType: z.enum(["airSource", "coldClimate", "groundSource"]),
        currentSystem: z.enum(["gas", "oil", "propane", "electricResistance"]),
        householdIncome: z.number(),
        includeInsulation: z.boolean().default(false),
        insulationSqFt: z.number().optional(),
        isCommercial: z.boolean().default(false),
        commercialKW: z.number().optional(),
      })
    )
    .query(({ input }) => {
      const {
        heatPumpType,
        currentSystem,
        householdIncome,
        includeInsulation,
        insulationSqFt,
        isCommercial,
        commercialKW,
      } = input;

      if (isCommercial && commercialKW) {
        // Commercial rebate calculation
        const bcHydroIncentive = Math.min(
          commercialKW * BC_HYDRO_COMMERCIAL.hvacUpgrades.heatPumpConversion.incentivePerKW,
          BC_HYDRO_COMMERCIAL.hvacUpgrades.heatPumpConversion.maxIncentive
        );
        
        const fortisIncentive = currentSystem === "gas" 
          ? FORTISBC_INCENTIVES.commercial.gasToElectric.maxIncentive 
          : 0;

        return {
          type: "commercial",
          bcHydroIncentive,
          fortisIncentive,
          totalIncentive: bcHydroIncentive + fortisIncentive,
          requirements: BC_HYDRO_COMMERCIAL.hvacUpgrades.heatPumpConversion.requirements,
          deadline: BC_HYDRO_COMMERCIAL.applicationDeadline,
        };
      }

      // Residential rebate calculation
      const rebate = calculatePotentialRebate({
        heatPumpType,
        currentSystem,
        householdIncome,
        includeInsulation,
        insulationSqFt,
      });

      // Add FortisBC stacking if converting from gas
      let fortisBonus = 0;
      if (currentSystem === "gas") {
        fortisBonus = FORTISBC_INCENTIVES.residential.heatPumpConversion.incentive;
      }

      return {
        type: "residential",
        cleanBCRebate: rebate,
        fortisBonus,
        totalRebate: rebate.total + fortisBonus,
        programDetails: {
          name: CLEANBC_REBATES.programName,
          lastUpdated: CLEANBC_REBATES.lastUpdated,
        },
        requirements: heatPumpType === "airSource"
          ? CLEANBC_REBATES.heatPumps.airSourceHeatPump.requirements
          : heatPumpType === "coldClimate"
          ? CLEANBC_REBATES.heatPumps.coldClimateHeatPump.requirements
          : CLEANBC_REBATES.heatPumps.groundSourceHeatPump.requirements,
      };
    }),

  // Calculate energy & emissions savings
  calculateSavings: publicProcedure
    .input(
      z.object({
        currentSystem: z.enum(["gas", "oil", "propane", "electric"]),
        annualConsumption: z.number(), // GJ or kWh
        heatPumpCOP: z.number().default(3.0),
        annualEnergyCost: z.number().optional(),
      })
    )
    .query(({ input }) => {
      const { currentSystem, annualConsumption, heatPumpCOP, annualEnergyCost } = input;

      const savings = calculateEmissionsSavings({
        currentSystem,
        annualConsumption,
        heatPumpCOP,
      });

      // Estimate cost savings
      let costSavings = 0;
      if (annualEnergyCost) {
        const savingsPercent = CONVERSION_FACTORS[
          currentSystem === "gas" ? "fromGasFurnace" 
          : currentSystem === "oil" ? "fromOilFurnace"
          : currentSystem === "propane" ? "fromPropane"
          : "fromElectricResistance"
        ].costSavingsPercent;
        costSavings = annualEnergyCost * (savingsPercent / 100);
      }

      // Calculate lifetime savings (15 year heat pump lifespan)
      const lifetimeEmissionsSavings = savings.savings * 15;
      const lifetimeCostSavings = costSavings * 15;

      return {
        annual: {
          currentEmissions: savings.currentEmissions,
          newEmissions: savings.newEmissions,
          emissionsSavings: savings.savings,
          savingsPercent: savings.savingsPercent,
          costSavings,
        },
        lifetime: {
          years: 15,
          emissionsSavings: lifetimeEmissionsSavings,
          costSavings: lifetimeCostSavings,
        },
        equivalents: {
          treesPlanted: Math.round(savings.savings * 15 / 0.022), // ~22kg CO2 per tree per year
          carsOffRoad: Math.round(savings.savings / 4.6), // ~4.6 tCO2e per car per year
          flightsAvoided: Math.round(savings.savings / 0.9), // ~0.9 tCO2e per flight
        },
        bcContext: {
          contributionTo2030Target: savings.savings / (BC_GHG_TARGETS.targets[1].reductionPercent / 100),
          comparedToAvgHome: (savings.savings / COMMUNITY_BENCHMARKS.residential.current2022.avgPerHousehold) * 100,
        },
      };
    }),

  // Service Area Analytics
  getServiceAreaAnalytics: publicProcedure
    .input(
      z.object({
        centerLat: z.number().optional(),
        centerLng: z.number().optional(),
        radiusKm: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const { centerLat, centerLng, radiusKm } = input;

      let communities = await ctx.prisma.community.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
      });

      // Filter by radius if center provided
      if (centerLat && centerLng) {
        communities = communities.filter((c) => {
          if (!c.latitude || !c.longitude) return false;
          const distance = Math.sqrt(
            Math.pow((c.latitude - centerLat) * 111, 2) +
            Math.pow((c.longitude - centerLng) * 85, 2) // Approximate km conversion
          );
          return distance <= radiusKm;
        });
      }

      // Group by climate zone
      const byClimateZone = communities.reduce((acc, c) => {
        const zone = getClimateZone(c.latitude!);
        if (!acc[zone]) {
          acc[zone] = { count: 0, totalEmissions: 0, resEmissions: 0, csmiEmissions: 0 };
        }
        acc[zone].count++;
        acc[zone].totalEmissions += c.totalEmissions;
        acc[zone].resEmissions += c.resEmissions;
        acc[zone].csmiEmissions += c.csmiEmissions;
        return acc;
      }, {} as Record<string, { count: number; totalEmissions: number; resEmissions: number; csmiEmissions: number }>);

      // Calculate market metrics
      const totalResEmissions = communities.reduce((sum, c) => sum + c.resEmissions, 0);
      const totalCSMIEmissions = communities.reduce((sum, c) => sum + c.csmiEmissions, 0);
      const estimatedResHouseholds = Math.round(
        totalResEmissions / COMMUNITY_BENCHMARKS.residential.current2022.avgPerHousehold / 1000
      );

      // Estimate revenue potential
      const avgJobValue = 15000; // Average heat pump installation
      const conversionRate = 0.05; // 5% of households convert per year
      const annualMarketSize = estimatedResHouseholds * conversionRate * avgJobValue;

      // Commercial opportunity
      const commercialBuildings = Math.round(totalCSMIEmissions / 100000); // Rough estimate
      const commercialMarketSize = commercialBuildings * 50000; // Avg commercial job

      return {
        serviceArea: {
          communities: communities.length,
          radiusKm,
          center: centerLat && centerLng ? { lat: centerLat, lng: centerLng } : null,
        },
        emissions: {
          total: communities.reduce((sum, c) => sum + c.totalEmissions, 0),
          residential: totalResEmissions,
          commercial: totalCSMIEmissions,
        },
        marketSize: {
          estimatedResHouseholds,
          estimatedCommercialBuildings: commercialBuildings,
          annualResidentialMarket: annualMarketSize,
          annualCommercialMarket: commercialMarketSize,
          totalAnnualMarket: annualMarketSize + commercialMarketSize,
        },
        byClimateZone,
        coldClimateOpportunity: Object.entries(byClimateZone)
          .filter(([zone]) => BC_CLIMATE_ZONES[zone as keyof typeof BC_CLIMATE_ZONES]?.coldClimateHeatPumpRequired)
          .reduce((sum, [, data]) => sum + data.count, 0),
        topCommunities: communities
          .sort((a, b) => b.resEmissions - a.resEmissions)
          .slice(0, 10)
          .map((c) => ({
            id: c.id,
            name: c.orgName,
            resEmissions: c.resEmissions,
            csmiEmissions: c.csmiEmissions,
            climateZone: getClimateZone(c.latitude!),
          })),
      };
    }),

  // Get community HVAC potential
  getCommunityHVACPotential: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const community = await ctx.prisma.community.findUnique({
        where: { id: input.id },
        include: {
          emissionsData: true,
        },
      });

      if (!community) {
        throw new Error("Community not found");
      }

      const climateZone = getClimateZone(community.latitude!);
      const zoneConfig = BC_CLIMATE_ZONES[climateZone];

      // Analyze emission sources
      const gasSources = community.emissionsData.filter(
        (e) => e.source.toLowerCase().includes("gas") || e.source.toLowerCase().includes("fortis")
      );
      const oilSources = community.emissionsData.filter(
        (e) => e.source.toLowerCase().includes("oil") || e.source.toLowerCase().includes("heating")
      );
      const propaneSources = community.emissionsData.filter(
        (e) => e.source.toLowerCase().includes("propane")
      );

      const gasEmissions = gasSources.reduce((sum, e) => sum + e.emissions, 0);
      const oilEmissions = oilSources.reduce((sum, e) => sum + e.emissions, 0);
      const propaneEmissions = propaneSources.reduce((sum, e) => sum + e.emissions, 0);

      // Calculate conversion potential
      const totalFossilEmissions = gasEmissions + oilEmissions + propaneEmissions;
      const potentialReduction = totalFossilEmissions * 0.75; // 75% reduction with heat pumps

      // Estimate households and buildings
      const estimatedHouseholds = Math.round(
        community.resEmissions / COMMUNITY_BENCHMARKS.residential.current2022.avgPerHousehold / 1000
      );
      const estimatedCommercialBuildings = Math.round(community.csmiEmissions / 100000);

      // BC regulatory compliance
      const resCompliance = getComplianceStatus(
        community.resEmissions / Math.max(estimatedHouseholds, 1),
        "residential"
      );
      const comCompliance = getComplianceStatus(
        community.csmiEmissions / Math.max(estimatedCommercialBuildings, 1) / 1000,
        "commercial"
      );

      // Rebate potential
      const avgResRebate = zoneConfig.coldClimateHeatPumpRequired ? 12000 : 8000;
      const totalResRebatePotential = estimatedHouseholds * avgResRebate * 0.3; // 30% adoption

      return {
        community: {
          id: community.id,
          name: community.orgName,
          latitude: community.latitude,
          longitude: community.longitude,
        },
        climateZone: {
          zone: climateZone,
          name: zoneConfig.name,
          coldClimateRequired: zoneConfig.coldClimateHeatPumpRequired,
          heatingDegreeDays: zoneConfig.hdd,
        },
        emissions: {
          total: community.totalEmissions,
          residential: community.resEmissions,
          commercial: community.csmiEmissions,
          byFuel: {
            gas: gasEmissions,
            oil: oilEmissions,
            propane: propaneEmissions,
            other: community.totalEmissions - gasEmissions - oilEmissions - propaneEmissions,
          },
        },
        hvacPotential: {
          totalFossilEmissions,
          potentialReduction,
          reductionPercent: (potentialReduction / community.totalEmissions) * 100,
          estimatedHouseholds,
          estimatedCommercialBuildings,
          recommendedHeatPumpType: zoneConfig.coldClimateHeatPumpRequired ? "coldClimate" : "airSource",
        },
        rebatePotential: {
          perHome: avgResRebate,
          totalCommunity: totalResRebatePotential,
          commercialIncentives: estimatedCommercialBuildings * 30000,
        },
        compliance: {
          residential: resCompliance,
          commercial: comCompliance,
        },
        bcTargets: {
          current: community.totalEmissions,
          target2030: community.totalEmissions * 0.6, // 40% reduction
          target2040: community.totalEmissions * 0.4, // 60% reduction
          gapTo2030: community.totalEmissions * 0.4,
        },
      };
    }),
});

export type AppRouter = typeof appRouter;

