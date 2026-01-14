/**
 * Script to seed Turso database with BC emissions data
 * 
 * Prerequisites:
 * 1. Create a Turso account: https://turso.tech
 * 2. Install Turso CLI: brew install tursodatabase/tap/turso
 * 3. Create database: turso db create bc-emissions
 * 4. Get credentials:
 *    - TURSO_DATABASE_URL: turso db show bc-emissions --url
 *    - TURSO_AUTH_TOKEN: turso db tokens create bc-emissions
 * 5. Add to .env.local:
 *    TURSO_DATABASE_URL=libsql://your-db.turso.io
 *    TURSO_AUTH_TOKEN=your-token
 * 
 * Run: npx tsx scripts/seed-turso.ts
 */

import { createClient } from "@libsql/client";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

// Load environment variables from .env.local
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  console.error("Please set these in your .env.local file");
  process.exit(1);
}

// Create Turso client
const libsql = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

// BC Community coordinates (complete list from seed.ts)
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

function getCoordinates(orgName: string): { lat: number | null; lng: number | null } {
  const name = orgName.trim();
  
  if (BC_COORDINATES[name]) {
    return { lat: BC_COORDINATES[name].lat, lng: BC_COORDINATES[name].lng };
  }
  
  for (const [key, coords] of Object.entries(BC_COORDINATES)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(name.toLowerCase())) {
      return { lat: coords.lat, lng: coords.lng };
    }
  }
  
  return { lat: null, lng: null };
}

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
  console.log("🚀 Starting Turso database seed...");
  console.log(`📡 Connecting to: ${TURSO_URL}`);
  
  // Drop and recreate tables in Turso with correct schema
  console.log("📋 Creating database schema...");
  
  // Drop existing tables first
  await libsql.execute(`DROP TABLE IF EXISTS EmissionsData`);
  await libsql.execute(`DROP TABLE IF EXISTS Community`);
  
  await libsql.execute(`
    CREATE TABLE Community (
      id TEXT PRIMARY KEY,
      orgUnit TEXT UNIQUE NOT NULL,
      orgName TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      totalEmissions REAL DEFAULT 0,
      resEmissions REAL DEFAULT 0,
      csmiEmissions REAL DEFAULT 0,
      mixedEmissions REAL DEFAULT 0,
      resConnections INTEGER DEFAULT 0,
      csmiConnections INTEGER DEFAULT 0,
      mixedConnections INTEGER DEFAULT 0,
      totalConnections INTEGER DEFAULT 0,
      electricEmissions REAL DEFAULT 0,
      gasEmissions REAL DEFAULT 0,
      oilEmissions REAL DEFAULT 0,
      propaneEmissions REAL DEFAULT 0,
      woodEmissions REAL DEFAULT 0,
      otherEmissions REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  
  await libsql.execute(`
    CREATE TABLE EmissionsData (
      id TEXT PRIMARY KEY,
      communityId TEXT NOT NULL,
      source TEXT NOT NULL,
      energyType TEXT NOT NULL,
      subSector TEXT NOT NULL,
      consumption REAL NOT NULL,
      connections INTEGER,
      emissions REAL NOT NULL,
      year INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (communityId) REFERENCES Community(id)
    )
  `);
  
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_community_orgName ON Community(orgName)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_community_totalEmissions ON Community(totalEmissions)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_emissions_communityId ON EmissionsData(communityId)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_emissions_subSector ON EmissionsData(subSector)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_emissions_year ON EmissionsData(year)`);
  
  console.log("✅ Tables created successfully");
  
  // Find Excel file
  const possiblePaths = [
    path.join(process.cwd(), "..", "bc_utilities_energy_and_emissions_data_at_the_community_level (1).xlsx"),
    path.join(process.cwd(), "bc_utilities_energy_and_emissions_data_at_the_community_level (1).xlsx"),
    path.join(process.cwd(), "data", "bc_utilities_energy_and_emissions_data_at_the_community_level (1).xlsx"),
  ];
  
  let excelPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      excelPath = p;
      break;
    }
  }
  
  if (!excelPath) {
    console.error("❌ Excel file not found. Please place the emissions data file in the project directory.");
    console.error("Looked in:", possiblePaths);
    process.exit(1);
  }
  
  console.log(`📊 Reading Excel file: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes("combined") || name === "Combined"
  ) || workbook.SheetNames[0];
  
  console.log(`📋 Using sheet: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  const rawData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
  
  // Filter for 2022 data
  const data2022 = rawData.filter(row => row.YEAR === 2022);
  console.log(`📈 Found ${data2022.length} records for 2022`);
  
  // Group by community
  const communityMap = new Map<string, {
    orgUnit: string;
    orgName: string;
    totalEmissions: number;
    resEmissions: number;
    csmiEmissions: number;
    mixedEmissions: number;
    resConnections: number;
    csmiConnections: number;
    mixedConnections: number;
    electricEmissions: number;
    gasEmissions: number;
    oilEmissions: number;
    propaneEmissions: number;
    woodEmissions: number;
    otherEmissions: number;
    records: ExcelRow[];
  }>();
  
  for (const record of data2022) {
    const key = record.ORG_UNIT;
    if (!communityMap.has(key)) {
      communityMap.set(key, {
        orgUnit: String(record.ORG_UNIT),
        orgName: record.ORG_NAME,
        totalEmissions: 0,
        resEmissions: 0,
        csmiEmissions: 0,
        mixedEmissions: 0,
        resConnections: 0,
        csmiConnections: 0,
        mixedConnections: 0,
        electricEmissions: 0,
        gasEmissions: 0,
        oilEmissions: 0,
        propaneEmissions: 0,
        woodEmissions: 0,
        otherEmissions: 0,
        records: [],
      });
    }
    
    const community = communityMap.get(key)!;
    community.records.push(record);
    
    const emissions = typeof record["EMISSIONS NET IMPORTS (TCO2e)"] === "number"
      ? record["EMISSIONS NET IMPORTS (TCO2e)"]
      : parseFloat(String(record["EMISSIONS NET IMPORTS (TCO2e)"])) || 0;
    
    const connections = typeof record[" CONNECTION_TOTAL "] === "number"
      ? Math.round(record[" CONNECTION_TOTAL "])
      : Math.round(parseFloat(String(record[" CONNECTION_TOTAL "])) || 0);
    
    community.totalEmissions += emissions;
    
    // By sector
    if (record.SUB_SECTOR === "Res") {
      community.resEmissions += emissions;
      community.resConnections += connections;
    } else if (record.SUB_SECTOR === "CSMI") {
      community.csmiEmissions += emissions;
      community.csmiConnections += connections;
    } else if (record.SUB_SECTOR === "MIXED") {
      community.mixedEmissions += emissions;
      community.mixedConnections += connections;
    }
    
    // By energy type
    const energyType = record.ENERGY_TYPE?.toLowerCase() || "";
    const source = record.SOURCE?.toLowerCase() || "";
    
    if (energyType.includes("electric") || source.includes("hydro") || source.includes("electric")) {
      community.electricEmissions += emissions;
    } else if (energyType.includes("gas") || source.includes("gas") || source.includes("fortis")) {
      community.gasEmissions += emissions;
    } else if (energyType.includes("oil") || source.includes("oil") || source.includes("heating")) {
      community.oilEmissions += emissions;
    } else if (energyType.includes("propane")) {
      community.propaneEmissions += emissions;
    } else if (energyType.includes("wood")) {
      community.woodEmissions += emissions;
    } else {
      community.otherEmissions += emissions;
    }
  }
  
  console.log(`🏘️  Creating ${communityMap.size} communities...`);
  
  let created = 0;
  let totalRecords = 0;
  
  const nowISO = new Date().toISOString();
  
  for (const [_, community] of communityMap) {
    const coords = getCoordinates(community.orgName);
    const communityId = crypto.randomUUID();
    
    // Insert community with ISO date format
    await libsql.execute({
      sql: `INSERT INTO Community (
        id, orgUnit, orgName, latitude, longitude, totalEmissions, resEmissions, csmiEmissions, mixedEmissions,
        resConnections, csmiConnections, mixedConnections, totalConnections,
        electricEmissions, gasEmissions, oilEmissions, propaneEmissions, woodEmissions, otherEmissions,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        communityId,
        community.orgUnit,
        community.orgName,
        coords.lat,
        coords.lng,
        community.totalEmissions,
        community.resEmissions,
        community.csmiEmissions,
        community.mixedEmissions,
        community.resConnections,
        community.csmiConnections,
        community.mixedConnections,
        community.resConnections + community.csmiConnections + community.mixedConnections,
        community.electricEmissions,
        community.gasEmissions,
        community.oilEmissions,
        community.propaneEmissions,
        community.woodEmissions,
        community.otherEmissions,
        nowISO,
        nowISO,
      ],
    });
    
    // Insert emissions data records
    for (const record of community.records) {
      const consumption = typeof record[" CONSUMPTION_TOTAL "] === "number"
        ? record[" CONSUMPTION_TOTAL "]
        : parseFloat(String(record[" CONSUMPTION_TOTAL "])) || 0;
      const connections = typeof record[" CONNECTION_TOTAL "] === "number"
        ? Math.round(record[" CONNECTION_TOTAL "])
        : Math.round(parseFloat(String(record[" CONNECTION_TOTAL "])) || 0);
      const emissions = typeof record["EMISSIONS NET IMPORTS (TCO2e)"] === "number"
        ? record["EMISSIONS NET IMPORTS (TCO2e)"]
        : parseFloat(String(record["EMISSIONS NET IMPORTS (TCO2e)"])) || 0;
      
      await libsql.execute({
        sql: `INSERT INTO EmissionsData (id, communityId, source, energyType, subSector, consumption, connections, emissions, year, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          communityId,
          record.SOURCE || "",
          record.ENERGY_TYPE || "",
          record.SUB_SECTOR || "",
          consumption,
          connections,
          emissions,
          record.YEAR,
          nowISO,
        ],
      });
      totalRecords++;
    }
    
    created++;
    if (created % 20 === 0) {
      console.log(`   Created ${created}/${communityMap.size} communities...`);
    }
  }
  
  console.log("✅ Communities seeded successfully!");
  console.log(`   📊 Communities: ${created}`);
  console.log(`   📈 Emissions records: ${totalRecords}`);
  
  // ===== Seed MajorProject Data =====
  console.log("\n🏗️  Seeding Major Projects...");
  
  // Drop and recreate MajorProject table
  await libsql.execute(`DROP TABLE IF EXISTS MajorProject`);
  
  await libsql.execute(`
    CREATE TABLE MajorProject (
      id TEXT PRIMARY KEY,
      projectId INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      estimatedCost REAL NOT NULL,
      updateActivity TEXT,
      constructionType TEXT,
      constructionSubtype TEXT,
      projectType TEXT,
      region TEXT,
      municipality TEXT,
      latitude REAL,
      longitude REAL,
      developer TEXT,
      architect TEXT,
      projectStatus TEXT NOT NULL,
      projectStage TEXT,
      categoryName TEXT,
      publicFunding INTEGER,
      provincialFunding INTEGER,
      federalFunding INTEGER,
      municipalFunding INTEGER,
      otherPublicFunding INTEGER,
      greenBuilding INTEGER,
      cleanEnergy INTEGER,
      indigenous INTEGER,
      startDate TEXT,
      completionDate TEXT,
      telephone TEXT,
      firstEntryDate TEXT,
      lastUpdate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_project_status ON MajorProject(projectStatus)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_project_constructionType ON MajorProject(constructionType)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_project_developer ON MajorProject(developer)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_project_estimatedCost ON MajorProject(estimatedCost)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_project_region ON MajorProject(region)`);
  
  // Find MPI Excel file
  const mpiPaths = [
    path.join(process.cwd(), "..", "mpi_dataset_q2_2025.xlsx"),
    path.join(process.cwd(), "mpi_dataset_q2_2025.xlsx"),
    path.join(process.cwd(), "data", "mpi_dataset_q2_2025.xlsx"),
  ];
  
  let mpiPath = "";
  for (const p of mpiPaths) {
    if (fs.existsSync(p)) {
      mpiPath = p;
      break;
    }
  }
  
  if (!mpiPath) {
    console.log("⚠️  MPI Excel file not found. Skipping major projects seeding.");
  } else {
    console.log(`📊 Reading MPI file: ${mpiPath}`);
    const mpiWorkbook = XLSX.readFile(mpiPath);
    const mpiSheetName = mpiWorkbook.SheetNames.find(name => 
      name.toLowerCase().includes("mpi") || name.toLowerCase().includes("project")
    ) || mpiWorkbook.SheetNames[0];
    
    console.log(`📋 Using sheet: ${mpiSheetName}`);
    const mpiWorksheet = mpiWorkbook.Sheets[mpiSheetName];
    const mpiRawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(mpiWorksheet);
    
    // Filter for Proposed and Construction started
    const relevantProjects = mpiRawData.filter(row => {
      const status = String(row["PROJECT_STATUS"] || "").toLowerCase();
      return status === "proposed" || status === "construction started";
    });
    
    console.log(`📈 Found ${relevantProjects.length} relevant projects (Proposed + Under Construction)`);
    
    // Municipality/Region to coordinates mapping
    const PROJECT_COORDINATES: Record<string, { lat: number; lng: number }> = {
      ...BC_COORDINATES,
      "Greater Vancouver": { lat: 49.2827, lng: -123.1207 },
      "Lower Mainland": { lat: 49.2, lng: -122.9 },
      "Thompson Okanagan": { lat: 50.5, lng: -119.5 },
      "Vancouver Island": { lat: 49.7, lng: -125.5 },
      "Kootenays": { lat: 49.5, lng: -117.0 },
      "Cariboo": { lat: 52.1, lng: -122.1 },
      "Northeast": { lat: 56.2, lng: -120.8 },
      "Northwest": { lat: 54.5, lng: -128.5 },
    };
    
    function getProjectCoordinates(municipality: string, region: string): { lat: number | null; lng: number | null } {
      // Try municipality first
      if (municipality) {
        const name = municipality.trim();
        if (PROJECT_COORDINATES[name]) {
          return { lat: PROJECT_COORDINATES[name].lat, lng: PROJECT_COORDINATES[name].lng };
        }
        for (const [key, coords] of Object.entries(PROJECT_COORDINATES)) {
          if (name.toLowerCase().includes(key.toLowerCase()) || 
              key.toLowerCase().includes(name.toLowerCase())) {
            return { lat: coords.lat, lng: coords.lng };
          }
        }
      }
      
      // Try region
      if (region) {
        const regionName = region.trim();
        if (PROJECT_COORDINATES[regionName]) {
          return { lat: PROJECT_COORDINATES[regionName].lat, lng: PROJECT_COORDINATES[regionName].lng };
        }
        for (const [key, coords] of Object.entries(PROJECT_COORDINATES)) {
          if (regionName.toLowerCase().includes(key.toLowerCase()) || 
              key.toLowerCase().includes(regionName.toLowerCase())) {
            return { lat: coords.lat, lng: coords.lng };
          }
        }
      }
      
      // Default to BC center with slight randomization
      return { 
        lat: 49.2 + (Math.random() - 0.5) * 2, 
        lng: -123.0 + (Math.random() - 0.5) * 2 
      };
    }
    
    let projectsCreated = 0;
    
    for (const row of relevantProjects) {
      const municipality = String(row["MUNICIPALITY"] || "");
      const region = String(row["REGION"] || "");
      const coords = getProjectCoordinates(municipality, region);
      
      const projectId = Number(row["PROJECT_ID"]) || Math.floor(Math.random() * 1000000);
      const estimatedCost = Number(row["ESTIMATED_COST"]) || 0;
      const developer = row["DEVELOPER"] ? String(row["DEVELOPER"]) : null;
      
      await libsql.execute({
        sql: `INSERT INTO MajorProject (
          id, projectId, name, description, estimatedCost, updateActivity, constructionType, constructionSubtype,
          projectType, region, municipality, latitude, longitude, developer, architect, projectStatus, projectStage,
          categoryName, publicFunding, provincialFunding, federalFunding, municipalFunding, otherPublicFunding,
          greenBuilding, cleanEnergy, indigenous, startDate, completionDate, telephone, firstEntryDate, lastUpdate,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          projectId,
          String(row["PROJECT_NAME"] || "Unknown Project"),
          row["DESCRIPTION"] ? String(row["DESCRIPTION"]) : null,
          estimatedCost,
          row["UPDATE_ACTIVITY"] ? String(row["UPDATE_ACTIVITY"]) : null,
          row["CONSTRUCTION_TYPE"] ? String(row["CONSTRUCTION_TYPE"]) : null,
          row["CONSTRUCTION_SUBTYPE"] ? String(row["CONSTRUCTION_SUBTYPE"]) : null,
          row["PROJECT_TYPE"] ? String(row["PROJECT_TYPE"]) : null,
          region || null,
          municipality || null,
          coords.lat,
          coords.lng,
          developer,
          row["ARCHITECT"] ? String(row["ARCHITECT"]) : null,
          String(row["PROJECT_STATUS"] || "Proposed"),
          row["PROJECT_STAGE"] ? String(row["PROJECT_STAGE"]) : null,
          row["CATEGORY_NAME"] ? String(row["CATEGORY_NAME"]) : null,
          row["PUBLIC_FUNDING"] ? 1 : 0,
          row["PROVINCIAL_FUNDING"] ? 1 : 0,
          row["FEDERAL_FUNDING"] ? 1 : 0,
          row["MUNICIPAL_FUNDING"] ? 1 : 0,
          row["OTHER_PUBLIC_FUNDING"] ? 1 : 0,
          row["GREEN_BUILDING"] ? 1 : 0,
          row["CLEAN_ENERGY"] ? 1 : 0,
          row["INDIGENOUS"] ? 1 : 0,
          row["START_DATE"] ? String(row["START_DATE"]) : null,
          row["COMPLETION_DATE"] ? String(row["COMPLETION_DATE"]) : null,
          row["TELEPHONE"] ? String(row["TELEPHONE"]) : null,
          row["FIRST_ENTRY_DATE"] ? String(row["FIRST_ENTRY_DATE"]) : null,
          row["LAST_UPDATE"] ? String(row["LAST_UPDATE"]) : null,
          nowISO,
          nowISO,
        ],
      });
      
      projectsCreated++;
      if (projectsCreated % 100 === 0) {
        console.log(`   Created ${projectsCreated}/${relevantProjects.length} projects...`);
      }
    }
    
    console.log(`✅ Major Projects seeded: ${projectsCreated}`);
  }
  
  console.log("\n🎉 Turso database seeding complete!");
}

main().catch((e) => {
  console.error("❌ Error seeding database:", e);
  process.exit(1);
});

