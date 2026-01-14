import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

// BC Municipality coordinates for mapping projects
const BC_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Abbotsford": { lat: 49.0504, lng: -122.3045 },
  "Armstrong": { lat: 50.4496, lng: -119.1970 },
  "Burnaby": { lat: 49.2488, lng: -122.9805 },
  "Campbell River": { lat: 50.0244, lng: -125.2475 },
  "Castlegar": { lat: 49.3256, lng: -117.6662 },
  "Chetwynd": { lat: 55.6978, lng: -121.6308 },
  "Chilliwack": { lat: 49.1577, lng: -121.9509 },
  "Colwood": { lat: 48.4236, lng: -123.4958 },
  "Comox": { lat: 49.6736, lng: -124.9022 },
  "Coquitlam": { lat: 49.2838, lng: -122.7932 },
  "Courtenay": { lat: 49.6841, lng: -124.9946 },
  "Cranbrook": { lat: 49.5097, lng: -115.7689 },
  "Dawson Creek": { lat: 55.7596, lng: -120.2377 },
  "Delta": { lat: 49.0847, lng: -123.0586 },
  "Duncan": { lat: 48.7787, lng: -123.7079 },
  "Enderby": { lat: 50.5506, lng: -119.1399 },
  "Esquimalt": { lat: 48.4323, lng: -123.4141 },
  "Fernie": { lat: 49.5041, lng: -115.0631 },
  "Fort Nelson": { lat: 58.8050, lng: -122.7002 },
  "Fort St. James": { lat: 54.4433, lng: -124.2547 },
  "Fort St. John": { lat: 56.2465, lng: -120.8476 },
  "Golden": { lat: 51.2991, lng: -116.9628 },
  "Grand Forks": { lat: 49.0323, lng: -118.4405 },
  "Hope": { lat: 49.3859, lng: -121.4419 },
  "Houston": { lat: 54.3972, lng: -126.6410 },
  "Invermere": { lat: 50.5072, lng: -116.0304 },
  "Kamloops": { lat: 50.6745, lng: -120.3273 },
  "Kelowna": { lat: 49.8880, lng: -119.4960 },
  "Kimberley": { lat: 49.6696, lng: -115.9783 },
  "Kitimat": { lat: 54.0523, lng: -128.6543 },
  "Ladysmith": { lat: 48.9975, lng: -123.8183 },
  "Lake Country": { lat: 50.0731, lng: -119.4163 },
  "Langford": { lat: 48.4471, lng: -123.5058 },
  "Langley": { lat: 49.1044, lng: -122.5596 },
  "Langley City": { lat: 49.1044, lng: -122.6590 },
  "Langley Township": { lat: 49.1044, lng: -122.5596 },
  "Lillooet": { lat: 50.6865, lng: -121.9421 },
  "Lytton": { lat: 50.2317, lng: -121.5778 },
  "Mackenzie": { lat: 55.3384, lng: -123.0917 },
  "Maple Ridge": { lat: 49.2193, lng: -122.5984 },
  "Merritt": { lat: 50.1126, lng: -120.7947 },
  "Mission": { lat: 49.1344, lng: -122.3109 },
  "Nanaimo": { lat: 49.1659, lng: -123.9401 },
  "Nelson": { lat: 49.4928, lng: -117.2948 },
  "New Westminster": { lat: 49.2057, lng: -122.9110 },
  "North Cowichan": { lat: 48.8244, lng: -123.7275 },
  "North Saanich": { lat: 48.6134, lng: -123.4166 },
  "North Vancouver": { lat: 49.3165, lng: -123.0688 },
  "North Vancouver City": { lat: 49.3165, lng: -123.0688 },
  "North Vancouver District": { lat: 49.3480, lng: -123.0649 },
  "Oak Bay": { lat: 48.4262, lng: -123.3180 },
  "Oliver": { lat: 49.1828, lng: -119.5504 },
  "Osoyoos": { lat: 49.0328, lng: -119.4669 },
  "Parksville": { lat: 49.3150, lng: -124.3112 },
  "Peachland": { lat: 49.7732, lng: -119.7375 },
  "Pemberton": { lat: 50.3194, lng: -122.8066 },
  "Penticton": { lat: 49.4991, lng: -119.5937 },
  "Pitt Meadows": { lat: 49.2216, lng: -122.6890 },
  "Port Alberni": { lat: 49.2339, lng: -124.8055 },
  "Port Coquitlam": { lat: 49.2636, lng: -122.7811 },
  "Port Hardy": { lat: 50.7239, lng: -127.4939 },
  "Port Moody": { lat: 49.2838, lng: -122.8316 },
  "Powell River": { lat: 49.8352, lng: -124.5247 },
  "Prince George": { lat: 53.9171, lng: -122.7497 },
  "Prince Rupert": { lat: 54.3150, lng: -130.3208 },
  "Princeton": { lat: 49.4587, lng: -120.5109 },
  "Qualicum Beach": { lat: 49.3486, lng: -124.4378 },
  "Quesnel": { lat: 52.9784, lng: -122.4936 },
  "Revelstoke": { lat: 50.9981, lng: -118.1957 },
  "Richmond": { lat: 49.1666, lng: -123.1336 },
  "Rossland": { lat: 49.0786, lng: -117.7997 },
  "Saanich": { lat: 48.4565, lng: -123.3771 },
  "Salmon Arm": { lat: 50.7002, lng: -119.2838 },
  "Sechelt": { lat: 49.4742, lng: -123.7553 },
  "Sidney": { lat: 48.6511, lng: -123.3981 },
  "Smithers": { lat: 54.7807, lng: -127.1641 },
  "Sooke": { lat: 48.3752, lng: -123.7357 },
  "Sparwood": { lat: 49.7336, lng: -114.8878 },
  "Squamish": { lat: 49.7016, lng: -123.1558 },
  "Stewart": { lat: 55.9389, lng: -130.0055 },
  "Summerland": { lat: 49.6006, lng: -119.6778 },
  "Surrey": { lat: 49.1913, lng: -122.8490 },
  "Terrace": { lat: 54.5182, lng: -128.5965 },
  "Tofino": { lat: 49.1530, lng: -125.9066 },
  "Trail": { lat: 49.0955, lng: -117.7105 },
  "Tumbler Ridge": { lat: 55.1275, lng: -120.9939 },
  "Ucluelet": { lat: 48.9424, lng: -125.5466 },
  "Vancouver": { lat: 49.2827, lng: -123.1207 },
  "Vanderhoof": { lat: 54.0167, lng: -124.0000 },
  "Vernon": { lat: 50.2671, lng: -119.2720 },
  "Victoria": { lat: 48.4284, lng: -123.3656 },
  "View Royal": { lat: 48.4517, lng: -123.4332 },
  "West Kelowna": { lat: 49.8625, lng: -119.5833 },
  "West Vancouver": { lat: 49.3270, lng: -123.1659 },
  "Whistler": { lat: 50.1163, lng: -122.9574 },
  "White Rock": { lat: 49.0253, lng: -122.8028 },
  "Williams Lake": { lat: 52.1418, lng: -122.1417 },
  "100 Mile House": { lat: 51.6425, lng: -121.2898 },
  // Regional centers for fallback
  "Vancouver Island": { lat: 49.6500, lng: -125.4500 },
  "Mainland/Southwest": { lat: 49.2827, lng: -123.1207 },
  "Thompson-Okanagan": { lat: 50.2671, lng: -119.2720 },
  "Kootenay": { lat: 49.5097, lng: -115.7689 },
  "Cariboo": { lat: 52.1418, lng: -122.1417 },
  "North Coast": { lat: 54.3150, lng: -130.3208 },
  "Nechako": { lat: 54.2304, lng: -125.7603 },
  "Northeast": { lat: 56.2465, lng: -120.8476 },
};

// Regional center coordinates for fallback
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  "1. Vancouver Island/Coast": { lat: 49.6500, lng: -125.4500 },
  "2. Mainland/Southwest": { lat: 49.2827, lng: -123.1207 },
  "3. Thompson-Okanagan": { lat: 50.2671, lng: -119.2720 },
  "4. Kootenay": { lat: 49.5097, lng: -115.7689 },
  "5. Cariboo": { lat: 52.1418, lng: -122.1417 },
  "6. North Coast": { lat: 54.3150, lng: -130.3208 },
  "7. Nechako": { lat: 54.2304, lng: -125.7603 },
  "8. Northeast": { lat: 56.2465, lng: -120.8476 },
};

function getCoordinates(municipality: string | undefined, region: string): { lat: number | null; lng: number | null } {
  // Try exact match first
  if (municipality && BC_COORDINATES[municipality]) {
    return BC_COORDINATES[municipality];
  }

  // Try partial match
  if (municipality) {
    for (const [key, coords] of Object.entries(BC_COORDINATES)) {
      if (municipality.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(municipality.toLowerCase())) {
        return coords;
      }
    }
  }

  // Fall back to regional center
  if (REGION_CENTERS[region]) {
    // Add small random offset to prevent overlapping markers
    const offset = () => (Math.random() - 0.5) * 0.5;
    return {
      lat: REGION_CENTERS[region].lat + offset(),
      lng: REGION_CENTERS[region].lng + offset(),
    };
  }

  return { lat: null, lng: null };
}

function parseExcelDate(value: number | undefined): Date | null {
  if (!value) return null;
  // Excel dates are days since 1900-01-01
  const date = new Date((value - 25569) * 86400 * 1000);
  return isNaN(date.getTime()) ? null : date;
}

interface MPIRow {
  PROJECT_ID: number;
  PROJECT_NAME: string;
  PROJECT_DESCRIPTION?: string;
  ESTIMATED_COST: number;
  UPDATE_ACTIVITY?: string;
  CONSTRUCTION_TYPE: string;
  CONSTRUCTION_SUBTYPE?: string;
  PROJECT_TYPE: string;
  REGION: string;
  MUNICIPALITY?: string;
  DEVELOPER: string;
  ARCHITECT?: string;
  PROJECT_STATUS: string;
  PROJECT_STAGE?: string;
  PROJECT_CATEGORY_NAME?: string;
  PUBLIC_FUNDING_IND?: boolean;
  PROVINCIAL_FUNDING?: boolean;
  FEDERAL_FUNDING?: boolean;
  MUNICIPAL_FUNDING?: boolean;
  OTHER_PUBLIC_FUNDING?: boolean;
  GREEN_BUILDING_IND?: boolean;
  CLEAN_ENERGY_IND?: boolean;
  INDIGENOUS_IND?: boolean;
  STANDARDIZED_START_DATE?: string;
  STANDARDIZED_COMPLETION_DATE?: string;
  TELEPHONE?: string;
  FIRST_ENTRY_DATE?: number;
  LAST_UPDATE?: number;
}

async function main() {
  console.log("🚀 Starting MPI data seed...");

  // Read the Excel file
  const excelPath = path.join(__dirname, "..", "..", "mpi_dataset_q2_2025.xlsx");
  console.log(`📊 Reading Excel file from: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets["mpi_dataset_q2_2025"];
  const data: MPIRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`📈 Found ${data.length} projects`);

  // Filter for Proposed and Construction Started only
  const activeProjects = data.filter(
    (row) => row.PROJECT_STATUS === "Proposed" || row.PROJECT_STATUS === "Construction started"
  );

  console.log(`🏗️  Active projects (Proposed + Under Construction): ${activeProjects.length}`);

  // Clear existing MPI data
  await prisma.majorProject.deleteMany();
  console.log("🗑️  Cleared existing MPI data");

  // Insert projects
  let created = 0;
  let withCoords = 0;

  for (const row of activeProjects) {
    // Skip rows without essential data
    if (!row.PROJECT_ID || !row.PROJECT_NAME || !row.ESTIMATED_COST || !row.DEVELOPER) {
      console.log(`   ⚠️ Skipping project with missing data: ${row.PROJECT_NAME || 'Unknown'}`);
      continue;
    }

    const coords = getCoordinates(row.MUNICIPALITY, row.REGION);
    if (coords.lat) withCoords++;

    await prisma.majorProject.create({
      data: {
        projectId: row.PROJECT_ID,
        name: row.PROJECT_NAME,
        description: row.PROJECT_DESCRIPTION || null,
        estimatedCost: row.ESTIMATED_COST || 0,
        updateActivity: row.UPDATE_ACTIVITY || null,
        constructionType: row.CONSTRUCTION_TYPE,
        constructionSubtype: row.CONSTRUCTION_SUBTYPE || null,
        projectType: row.PROJECT_TYPE,
        region: row.REGION,
        municipality: row.MUNICIPALITY || null,
        latitude: coords.lat,
        longitude: coords.lng,
        developer: row.DEVELOPER,
        architect: row.ARCHITECT || null,
        projectStatus: row.PROJECT_STATUS,
        projectStage: row.PROJECT_STAGE || null,
        categoryName: row.PROJECT_CATEGORY_NAME || null,
        publicFunding: row.PUBLIC_FUNDING_IND || false,
        provincialFunding: row.PROVINCIAL_FUNDING || false,
        federalFunding: row.FEDERAL_FUNDING || false,
        municipalFunding: row.MUNICIPAL_FUNDING || false,
        otherPublicFunding: row.OTHER_PUBLIC_FUNDING || false,
        greenBuilding: row.GREEN_BUILDING_IND || false,
        cleanEnergy: row.CLEAN_ENERGY_IND || false,
        indigenous: row.INDIGENOUS_IND || false,
        startDate: row.STANDARDIZED_START_DATE || null,
        completionDate: row.STANDARDIZED_COMPLETION_DATE || null,
        telephone: row.TELEPHONE || null,
        firstEntryDate: parseExcelDate(row.FIRST_ENTRY_DATE),
        lastUpdate: parseExcelDate(row.LAST_UPDATE),
      },
    });
    created++;
  }

  console.log(`\n✅ MPI seed completed!`);
  console.log(`   📊 Projects created: ${created}`);
  console.log(`   📍 With coordinates: ${withCoords}`);

  // Summary stats
  const stats = await prisma.majorProject.groupBy({
    by: ["projectStatus"],
    _count: true,
    _sum: { estimatedCost: true },
  });

  console.log("\n📊 Project Statistics:");
  stats.forEach((s) => {
    console.log(`   ${s.projectStatus}: ${s._count} projects, $${s._sum.estimatedCost?.toLocaleString()}M total`);
  });

  // Top construction types
  const byType = await prisma.majorProject.groupBy({
    by: ["constructionType"],
    _count: true,
    orderBy: { _count: { constructionType: "desc" } },
  });

  console.log("\n🏗️  By Construction Type:");
  byType.forEach((t) => {
    console.log(`   ${t.constructionType}: ${t._count} projects`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

