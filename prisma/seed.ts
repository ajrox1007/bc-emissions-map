import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

// BC Community coordinates (major municipalities and regions)
// These are approximate center coordinates for mapping
const BC_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Abbotsford": { lat: 49.0504, lng: -122.3045 },
  "Alberni-Clayoquot": { lat: 49.2339, lng: -124.8055 },
  "Alberni-Clayoquot Unincorporated Areas": { lat: 49.4, lng: -125.2 },
  "Alert Bay": { lat: 50.5838, lng: -126.9308 },
  "Anmore": { lat: 49.3166, lng: -122.8560 },
  "Armstrong": { lat: 50.4496, lng: -119.1970 },
  "Ashcroft": { lat: 50.7248, lng: -121.2815 },
  "Barriere": { lat: 51.1827, lng: -120.1240 },
  "Belcarra": { lat: 49.3196, lng: -122.9227 },
  "Bowen Island": { lat: 49.3848, lng: -123.3364 },
  "British Columbia": { lat: 53.7267, lng: -127.6476 },
  "Bulkley-Nechako": { lat: 54.2304, lng: -125.7603 },
  "Bulkley-Nechako Unincorporated Areas": { lat: 54.1, lng: -125.5 },
  "Burnaby": { lat: 49.2488, lng: -122.9805 },
  "Burns Lake": { lat: 54.2304, lng: -125.7603 },
  "Cache Creek": { lat: 50.8101, lng: -121.3265 },
  "Campbell River": { lat: 50.0244, lng: -125.2475 },
  "Canal Flats": { lat: 50.1519, lng: -115.8064 },
  "Capital": { lat: 48.4284, lng: -123.3656 },
  "Capital Unincorporated Areas": { lat: 48.5, lng: -123.5 },
  "Cariboo": { lat: 52.1418, lng: -122.1417 },
  "Cariboo Unincorporated Areas": { lat: 52.3, lng: -122.3 },
  "Castlegar": { lat: 49.3256, lng: -117.6662 },
  "Central Coast": { lat: 52.3786, lng: -127.4685 },
  "Central Coast Unincorporated Areas": { lat: 52.4, lng: -127.5 },
  "Central Kootenay": { lat: 49.4928, lng: -117.2948 },
  "Central Kootenay Unincorporated Areas": { lat: 49.6, lng: -117.4 },
  "Central Okanagan": { lat: 49.8880, lng: -119.4960 },
  "Central Okanagan Unincorporated Areas": { lat: 50.0, lng: -119.5 },
  "Central Saanich": { lat: 48.5143, lng: -123.3860 },
  "Chase": { lat: 50.8189, lng: -119.6856 },
  "Chetwynd": { lat: 55.6978, lng: -121.6308 },
  "Chilliwack": { lat: 49.1577, lng: -121.9509 },
  "Clearwater": { lat: 51.6489, lng: -120.0402 },
  "Clinton": { lat: 51.0909, lng: -121.5856 },
  "Cold Lake 149": { lat: 54.46, lng: -110.18 },
  "Coldstream": { lat: 50.2211, lng: -119.2494 },
  "Colwood": { lat: 48.4236, lng: -123.4958 },
  "Columbia-Shuswap": { lat: 51.2333, lng: -118.8500 },
  "Columbia-Shuswap Unincorporated Areas": { lat: 51.3, lng: -118.9 },
  "Comox": { lat: 49.6736, lng: -124.9022 },
  "Comox Valley": { lat: 49.6894, lng: -125.0067 },
  "Comox Valley Unincorporated Areas": { lat: 49.7, lng: -125.1 },
  "Coquitlam": { lat: 49.2838, lng: -122.7932 },
  "Courtenay": { lat: 49.6841, lng: -124.9946 },
  "Cowichan Valley": { lat: 48.7787, lng: -123.7079 },
  "Cowichan Valley Unincorporated Areas": { lat: 48.8, lng: -123.8 },
  "Cranbrook": { lat: 49.5097, lng: -115.7689 },
  "Creston": { lat: 49.0955, lng: -116.5135 },
  "Cumberland": { lat: 49.6195, lng: -125.0303 },
  "Dawson Creek": { lat: 55.7596, lng: -120.2377 },
  "Delta": { lat: 49.0847, lng: -123.0586 },
  "Duncan": { lat: 48.7787, lng: -123.7079 },
  "East Kootenay": { lat: 49.5, lng: -115.8 },
  "East Kootenay Unincorporated Areas": { lat: 49.6, lng: -115.9 },
  "Elkford": { lat: 50.0229, lng: -114.9225 },
  "Enderby": { lat: 50.5506, lng: -119.1399 },
  "Esquimalt": { lat: 48.4323, lng: -123.4141 },
  "Fernie": { lat: 49.5041, lng: -115.0631 },
  "Fort Nelson": { lat: 58.8050, lng: -122.7002 },
  "Fort St. James": { lat: 54.4433, lng: -124.2547 },
  "Fort St. John": { lat: 56.2465, lng: -120.8476 },
  "Fraser Valley": { lat: 49.1, lng: -121.9 },
  "Fraser Valley Unincorporated Areas": { lat: 49.2, lng: -122.0 },
  "Fraser Lake": { lat: 54.0519, lng: -124.8515 },
  "Fraser-Fort George": { lat: 53.9171, lng: -122.7497 },
  "Fraser-Fort George Unincorporated Areas": { lat: 54.0, lng: -122.8 },
  "Gibsons": { lat: 49.3971, lng: -123.5052 },
  "Gold River": { lat: 49.7773, lng: -126.0501 },
  "Golden": { lat: 51.2991, lng: -116.9628 },
  "Grand Forks": { lat: 49.0323, lng: -118.4405 },
  "Granisle": { lat: 54.3911, lng: -126.2457 },
  "Greenwood": { lat: 49.0917, lng: -118.6748 },
  "Harrison Hot Springs": { lat: 49.3044, lng: -121.7847 },
  "Hazelton": { lat: 55.2519, lng: -127.6672 },
  "Highlands": { lat: 48.4799, lng: -123.5016 },
  "Hope": { lat: 49.3859, lng: -121.4419 },
  "Houston": { lat: 54.3972, lng: -126.6410 },
  "Hudson's Hope": { lat: 56.0311, lng: -121.9076 },
  "Invermere": { lat: 50.5072, lng: -116.0304 },
  "Kamloops": { lat: 50.6745, lng: -120.3273 },
  "Kaslo": { lat: 49.9096, lng: -116.9138 },
  "Kelowna": { lat: 49.8880, lng: -119.4960 },
  "Kent": { lat: 49.2118, lng: -121.7556 },
  "Keremeos": { lat: 49.2022, lng: -119.8294 },
  "Kimberley": { lat: 49.6696, lng: -115.9783 },
  "Kitimat": { lat: 54.0523, lng: -128.6543 },
  "Kitimat-Stikine": { lat: 55.0, lng: -128.0 },
  "Kitimat-Stikine Unincorporated Areas": { lat: 55.2, lng: -128.2 },
  "Kootenay Boundary": { lat: 49.3, lng: -117.8 },
  "Kootenay Boundary Unincorporated Areas": { lat: 49.4, lng: -117.9 },
  "Ladysmith": { lat: 48.9975, lng: -123.8183 },
  "Lake Country": { lat: 50.0731, lng: -119.4163 },
  "Lake Cowichan": { lat: 48.8256, lng: -124.0541 },
  "Langford": { lat: 48.4471, lng: -123.5058 },
  "Langley City": { lat: 49.1044, lng: -122.6590 },
  "Langley Township": { lat: 49.1044, lng: -122.5596 },
  "Lantzville": { lat: 49.2485, lng: -124.0636 },
  "Lillooet": { lat: 50.6865, lng: -121.9421 },
  "Lions Bay": { lat: 49.4547, lng: -123.2380 },
  "Logan Lake": { lat: 50.4942, lng: -120.8127 },
  "Lumby": { lat: 50.2511, lng: -118.9657 },
  "Lytton": { lat: 50.2317, lng: -121.5778 },
  "Mackenzie": { lat: 55.3384, lng: -123.0917 },
  "Maple Ridge": { lat: 49.2193, lng: -122.5984 },
  "Masset": { lat: 54.0108, lng: -132.1467 },
  "McBride": { lat: 53.3004, lng: -120.1682 },
  "Merritt": { lat: 50.1126, lng: -120.7947 },
  "Metchosin": { lat: 48.3828, lng: -123.5367 },
  "Metro-Vancouver": { lat: 49.2827, lng: -123.1207 },
  "Metro-Vancouver Unincorporated Areas": { lat: 49.3, lng: -123.2 },
  "Midway": { lat: 49.0014, lng: -118.7697 },
  "Mission": { lat: 49.1344, lng: -122.3109 },
  "Montrose": { lat: 49.1053, lng: -117.5970 },
  "Nakusp": { lat: 50.2430, lng: -117.8012 },
  "Nanaimo": { lat: 49.1659, lng: -123.9401 },
  "Nanaimo Unincorporated Areas": { lat: 49.2, lng: -124.0 },
  "Nelson": { lat: 49.4928, lng: -117.2948 },
  "New Denver": { lat: 49.9932, lng: -117.3788 },
  "New Hazelton": { lat: 55.2564, lng: -127.5919 },
  "New Westminster": { lat: 49.2057, lng: -122.9110 },
  "North Coast": { lat: 54.3150, lng: -130.3208 },
  "North Coast Unincorporated Areas": { lat: 54.4, lng: -130.4 },
  "North Cowichan": { lat: 48.8244, lng: -123.7275 },
  "North Okanagan": { lat: 50.3, lng: -119.3 },
  "North Okanagan Unincorporated Areas": { lat: 50.4, lng: -119.4 },
  "North Saanich": { lat: 48.6134, lng: -123.4166 },
  "North Vancouver City": { lat: 49.3165, lng: -123.0688 },
  "North Vancouver District": { lat: 49.3480, lng: -123.0649 },
  "Northern Rockies": { lat: 58.8, lng: -122.7 },
  "Northern Rockies Unincorporated Areas": { lat: 58.9, lng: -122.8 },
  "Oak Bay": { lat: 48.4262, lng: -123.3180 },
  "Oliver": { lat: 49.1828, lng: -119.5504 },
  "Osoyoos": { lat: 49.0328, lng: -119.4669 },
  "Okanagan-Similkameen": { lat: 49.3, lng: -119.6 },
  "Okanagan-Similkameen Unincorporated Areas": { lat: 49.4, lng: -119.7 },
  "Parksville": { lat: 49.3150, lng: -124.3112 },
  "Peace River": { lat: 56.2, lng: -120.8 },
  "Peace River Unincorporated Areas": { lat: 56.3, lng: -120.9 },
  "Peachland": { lat: 49.7732, lng: -119.7375 },
  "Pemberton": { lat: 50.3194, lng: -122.8066 },
  "Penticton": { lat: 49.4991, lng: -119.5937 },
  "Pitt Meadows": { lat: 49.2216, lng: -122.6890 },
  "Port Alberni": { lat: 49.2339, lng: -124.8055 },
  "Port Alice": { lat: 50.3835, lng: -127.4477 },
  "Port Clements": { lat: 53.6761, lng: -132.1787 },
  "Port Coquitlam": { lat: 49.2636, lng: -122.7811 },
  "Port Edward": { lat: 54.2303, lng: -130.2875 },
  "Port Hardy": { lat: 50.7239, lng: -127.4939 },
  "Port McNeill": { lat: 50.5875, lng: -127.0849 },
  "Port Moody": { lat: 49.2838, lng: -122.8316 },
  "Pouce Coupe": { lat: 55.7168, lng: -120.1339 },
  "Powell River": { lat: 49.8352, lng: -124.5247 },
  "Prince George": { lat: 53.9171, lng: -122.7497 },
  "Prince Rupert": { lat: 54.3150, lng: -130.3208 },
  "Princeton": { lat: 49.4587, lng: -120.5109 },
  "Qualicum Beach": { lat: 49.3486, lng: -124.4378 },
  "Quesnel": { lat: 52.9784, lng: -122.4936 },
  "Radium Hot Springs": { lat: 50.6190, lng: -116.0686 },
  "Regional District of Nanaimo": { lat: 49.17, lng: -123.94 },
  "Revelstoke": { lat: 50.9981, lng: -118.1957 },
  "Richmond": { lat: 49.1666, lng: -123.1336 },
  "Rossland": { lat: 49.0786, lng: -117.7997 },
  "Saanich": { lat: 48.4565, lng: -123.3771 },
  "Salmo": { lat: 49.1950, lng: -117.2770 },
  "Salmon Arm": { lat: 50.7002, lng: -119.2838 },
  "Sayward": { lat: 50.3841, lng: -125.9587 },
  "Sechelt": { lat: 49.4742, lng: -123.7553 },
  "Sicamous": { lat: 50.8375, lng: -118.9802 },
  "Sidney": { lat: 48.6511, lng: -123.3981 },
  "Silverton": { lat: 49.9573, lng: -117.3878 },
  "Slocan": { lat: 49.7628, lng: -117.4731 },
  "Smithers": { lat: 54.7807, lng: -127.1641 },
  "Sooke": { lat: 48.3752, lng: -123.7357 },
  "Sparwood": { lat: 49.7336, lng: -114.8878 },
  "Spallumcheen": { lat: 50.4467, lng: -119.1869 },
  "Squamish": { lat: 49.7016, lng: -123.1558 },
  "Squamish-Lillooet": { lat: 50.1, lng: -122.9 },
  "Squamish-Lillooet Unincorporated Areas": { lat: 50.2, lng: -123.0 },
  "Stewart": { lat: 55.9389, lng: -130.0055 },
  "Strathcona": { lat: 50.0, lng: -125.5 },
  "Strathcona Unincorporated Areas": { lat: 50.1, lng: -125.6 },
  "Summerland": { lat: 49.6006, lng: -119.6778 },
  "Sun Peaks": { lat: 50.8835, lng: -119.8892 },
  "Sunshine Coast": { lat: 49.5, lng: -123.7 },
  "Sunshine Coast Unincorporated Areas": { lat: 49.6, lng: -123.8 },
  "Surrey": { lat: 49.1913, lng: -122.8490 },
  "Tahsis": { lat: 49.9163, lng: -126.6624 },
  "Taylor": { lat: 56.1575, lng: -120.6851 },
  "Telkwa": { lat: 54.6983, lng: -127.0466 },
  "Terrace": { lat: 54.5182, lng: -128.5965 },
  "Thompson-Nicola": { lat: 50.7, lng: -120.3 },
  "Thompson-Nicola Unincorporated Areas": { lat: 50.8, lng: -120.4 },
  "Tofino": { lat: 49.1530, lng: -125.9066 },
  "Trail": { lat: 49.0955, lng: -117.7105 },
  "Tumbler Ridge": { lat: 55.1275, lng: -120.9939 },
  "Ucluelet": { lat: 48.9424, lng: -125.5466 },
  "Valemount": { lat: 52.8303, lng: -119.2644 },
  "Vancouver": { lat: 49.2827, lng: -123.1207 },
  "Vanderhoof": { lat: 54.0167, lng: -124.0000 },
  "Vernon": { lat: 50.2671, lng: -119.2720 },
  "Victoria": { lat: 48.4284, lng: -123.3656 },
  "View Royal": { lat: 48.4517, lng: -123.4332 },
  "Warfield": { lat: 49.1000, lng: -117.7500 },
  "Wells": { lat: 53.1036, lng: -121.5558 },
  "West Kelowna": { lat: 49.8625, lng: -119.5833 },
  "West Vancouver": { lat: 49.3270, lng: -123.1659 },
  "Whistler": { lat: 50.1163, lng: -122.9574 },
  "White Rock": { lat: 49.0253, lng: -122.8028 },
  "Williams Lake": { lat: 52.1418, lng: -122.1417 },
  "Zeballos": { lat: 49.9833, lng: -126.8475 },
  "100 Mile House": { lat: 51.6425, lng: -121.2898 },
  "One Hundred Mile House": { lat: 51.6425, lng: -121.2898 },
};

interface ExcelRow {
  YEAR: number;
  SOURCE: string;
  "Data Source ID": string;
  ORG_UNIT: string;
  ORG_NAME: string;
  ORG_PART: string;
  ENERGY_TYPE: string;
  ENERGY_UNIT: string;
  SUB_SECTOR: string;
  " CONSUMPTION_TOTAL ": number;
  " CONNECTION_TOTAL ": number;
  "EMISSIONS NET IMPORTS (TCO2e)": number | string;
  "Look up": string;
}

async function main() {
  console.log("Starting seed process...");

  // Read the Excel file
  const excelPath = path.join(__dirname, "..", "..", "bc_utilities_energy_and_emissions_data_at_the_community_level (1).xlsx");
  console.log(`Reading Excel file from: ${excelPath}`);
  
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets["Combined"];
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

  // Filter for 2022 data
  const data2022 = data.filter((row) => row.YEAR === 2022);
  console.log(`Found ${data2022.length} records for 2022`);

  // Get unique communities
  const communityMap = new Map<string, {
    orgUnit: string;
    orgName: string;
    records: ExcelRow[];
  }>();

  for (const row of data2022) {
    const key = row.ORG_UNIT;
    if (!communityMap.has(key)) {
      communityMap.set(key, {
        orgUnit: row.ORG_UNIT,
        orgName: row.ORG_NAME,
        records: [],
      });
    }
    communityMap.get(key)!.records.push(row);
  }

  console.log(`Found ${communityMap.size} unique communities`);

  // Clear existing data
  await prisma.emissionsData.deleteMany();
  await prisma.community.deleteMany();
  console.log("Cleared existing data");

  // Insert communities and their emissions data
  let communitiesCreated = 0;
  let emissionsCreated = 0;

  for (const [, communityData] of communityMap) {
    const coords = BC_COORDINATES[communityData.orgName];
    
    // Calculate aggregated emissions and connections by segment
    let resEmissions = 0;
    let csmiEmissions = 0;
    let mixedEmissions = 0;
    let resConnections = 0;
    let csmiConnections = 0;
    let mixedConnections = 0;
    // Emissions by energy type
    let electricEmissions = 0;
    let gasEmissions = 0;
    let oilEmissions = 0;
    let propaneEmissions = 0;
    let woodEmissions = 0;
    let otherEmissions = 0;

    for (const record of communityData.records) {
      const emissions = typeof record["EMISSIONS NET IMPORTS (TCO2e)"] === "number"
        ? record["EMISSIONS NET IMPORTS (TCO2e)"]
        : parseFloat(String(record["EMISSIONS NET IMPORTS (TCO2e)"])) || 0;

      const connections = typeof record[" CONNECTION_TOTAL "] === "number"
        ? Math.round(record[" CONNECTION_TOTAL "])
        : Math.round(parseFloat(String(record[" CONNECTION_TOTAL "])) || 0);

      if (record.SUB_SECTOR === "Res") {
        resEmissions += emissions;
        resConnections += connections;
      } else if (record.SUB_SECTOR === "CSMI") {
        csmiEmissions += emissions;
        csmiConnections += connections;
      } else if (record.SUB_SECTOR === "MIXED") {
        mixedEmissions += emissions;
        mixedConnections += connections;
      }

      // Track emissions by energy type
      // ELEC = Electricity, NG = Natural Gas, RNG = Renewable NG, 
      // PPRO = Propane, WOOD = Wood, OIL = Heating Oil, DPRO = Diesel/Propane
      const energyType = record.ENERGY_TYPE;
      if (energyType === "ELEC") {
        electricEmissions += emissions;
      } else if (energyType === "NG" || energyType === "RNG") {
        gasEmissions += emissions;
      } else if (energyType === "OIL") {
        oilEmissions += emissions;
      } else if (energyType === "PPRO" || energyType === "DPRO") {
        propaneEmissions += emissions;
      } else if (energyType === "WOOD") {
        woodEmissions += emissions;
      } else {
        otherEmissions += emissions;
      }
    }

    const totalEmissions = resEmissions + csmiEmissions + mixedEmissions;
    const totalConnections = resConnections + csmiConnections + mixedConnections;

    // Create community
    const community = await prisma.community.create({
      data: {
        orgUnit: String(communityData.orgUnit),
        orgName: communityData.orgName,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        totalEmissions,
        resEmissions,
        csmiEmissions,
        mixedEmissions,
        resConnections,
        csmiConnections,
        mixedConnections,
        totalConnections,
        electricEmissions,
        gasEmissions,
        oilEmissions,
        propaneEmissions,
        woodEmissions,
        otherEmissions,
      },
    });
    communitiesCreated++;

    // Create emissions data records
    for (const record of communityData.records) {
      const emissions = typeof record["EMISSIONS NET IMPORTS (TCO2e)"] === "number"
        ? record["EMISSIONS NET IMPORTS (TCO2e)"]
        : parseFloat(String(record["EMISSIONS NET IMPORTS (TCO2e)"])) || 0;

      const consumption = typeof record[" CONSUMPTION_TOTAL "] === "number"
        ? record[" CONSUMPTION_TOTAL "]
        : parseFloat(String(record[" CONSUMPTION_TOTAL "])) || 0;

      const connections = typeof record[" CONNECTION_TOTAL "] === "number"
        ? Math.round(record[" CONNECTION_TOTAL "])
        : Math.round(parseFloat(String(record[" CONNECTION_TOTAL "])) || 0);

      await prisma.emissionsData.create({
        data: {
          communityId: community.id,
          source: record.SOURCE,
          energyType: record.ENERGY_TYPE,
          subSector: record.SUB_SECTOR,
          consumption,
          connections,
          emissions,
          year: record.YEAR,
        },
      });
      emissionsCreated++;
    }
  }

  console.log(`Created ${communitiesCreated} communities`);
  console.log(`Created ${emissionsCreated} emissions records`);

  // Print summary stats
  const stats = await prisma.community.aggregate({
    _sum: { totalEmissions: true },
    _avg: { totalEmissions: true },
    _max: { totalEmissions: true },
    _count: true,
  });

  console.log("\n=== Summary Statistics ===");
  console.log(`Total Communities: ${stats._count}`);
  console.log(`Total Emissions: ${stats._sum.totalEmissions?.toLocaleString()} TCO2e`);
  console.log(`Average Emissions: ${stats._avg.totalEmissions?.toLocaleString()} TCO2e`);
  console.log(`Max Emissions: ${stats._max.totalEmissions?.toLocaleString()} TCO2e`);

  // Top 5 communities
  const topCommunities = await prisma.community.findMany({
    orderBy: { totalEmissions: "desc" },
    take: 5,
    select: { orgName: true, totalEmissions: true },
  });

  console.log("\nTop 5 Communities by Emissions:");
  topCommunities.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.orgName}: ${c.totalEmissions.toLocaleString()} TCO2e`);
  });

  console.log("\nSeed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

