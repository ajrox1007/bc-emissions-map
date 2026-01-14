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

// BC Community coordinates (same as seed.ts)
const BC_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Vancouver": { lat: 49.2827, lng: -123.1207 },
  "Victoria": { lat: 48.4284, lng: -123.3656 },
  "Surrey": { lat: 49.1913, lng: -122.8490 },
  "Burnaby": { lat: 49.2488, lng: -122.9805 },
  "Richmond": { lat: 49.1666, lng: -123.1336 },
  "Kelowna": { lat: 49.8880, lng: -119.4960 },
  "Abbotsford": { lat: 49.0504, lng: -122.3045 },
  "Coquitlam": { lat: 49.2838, lng: -122.7932 },
  "Langley": { lat: 49.1044, lng: -122.5827 },
  "Nanaimo": { lat: 49.1659, lng: -123.9401 },
  "Kamloops": { lat: 50.6745, lng: -120.3273 },
  "Chilliwack": { lat: 49.1579, lng: -121.9514 },
  "Prince George": { lat: 53.9171, lng: -122.7497 },
  "Vernon": { lat: 50.2671, lng: -119.2720 },
  "Courtenay": { lat: 49.6879, lng: -124.9936 },
  "Campbell River": { lat: 50.0244, lng: -125.2475 },
  "Penticton": { lat: 49.4991, lng: -119.5937 },
  "Port Coquitlam": { lat: 49.2624, lng: -122.7811 },
  "West Kelowna": { lat: 49.8625, lng: -119.5833 },
  "North Vancouver": { lat: 49.3165, lng: -123.0688 },
  "West Vancouver": { lat: 49.3270, lng: -123.1659 },
  "New Westminster": { lat: 49.2057, lng: -122.9110 },
  "Port Moody": { lat: 49.2849, lng: -122.8316 },
  "Delta": { lat: 49.0847, lng: -123.0587 },
  "Maple Ridge": { lat: 49.2193, lng: -122.5984 },
  "White Rock": { lat: 49.0254, lng: -122.8029 },
  "Mission": { lat: 49.1337, lng: -122.3117 },
  "Squamish": { lat: 49.7016, lng: -123.1559 },
  "Whistler": { lat: 50.1163, lng: -122.9574 },
  "Powell River": { lat: 49.8353, lng: -124.5247 },
  "Fort St. John": { lat: 56.2465, lng: -120.8476 },
  "Dawson Creek": { lat: 55.7596, lng: -120.2377 },
  "Prince Rupert": { lat: 54.3150, lng: -130.3208 },
  "Terrace": { lat: 54.5182, lng: -128.5926 },
  "Kitimat": { lat: 54.0523, lng: -128.6538 },
  "Williams Lake": { lat: 52.1294, lng: -122.1383 },
  "Quesnel": { lat: 52.9784, lng: -122.4927 },
  "Cranbrook": { lat: 49.5097, lng: -115.7694 },
  "Nelson": { lat: 49.4928, lng: -117.2948 },
  "Trail": { lat: 49.0966, lng: -117.7103 },
  "Castlegar": { lat: 49.3246, lng: -117.6662 },
  "Revelstoke": { lat: 51.0000, lng: -118.1957 },
  "Golden": { lat: 51.2981, lng: -116.9636 },
  "Salmon Arm": { lat: 50.7022, lng: -119.2722 },
  "Parksville": { lat: 49.3150, lng: -124.3116 },
  "Qualicum Beach": { lat: 49.3500, lng: -124.4350 },
  "Port Alberni": { lat: 49.2339, lng: -124.8055 },
  "Tofino": { lat: 49.1530, lng: -125.9066 },
  "Ucluelet": { lat: 48.9419, lng: -125.5466 },
  "Fernie": { lat: 49.5040, lng: -115.0628 },
  "Invermere": { lat: 50.5072, lng: -116.0313 },
  "Smithers": { lat: 54.7804, lng: -127.1743 },
  "Houston": { lat: 54.3989, lng: -126.6474 },
  "Burns Lake": { lat: 54.2319, lng: -125.7603 },
  "Vanderhoof": { lat: 54.0166, lng: -124.0059 },
  "100 Mile House": { lat: 51.6418, lng: -121.2950 },
  "Merritt": { lat: 50.1113, lng: -120.7862 },
  "Hope": { lat: 49.3858, lng: -121.4419 },
  "Harrison Hot Springs": { lat: 49.3017, lng: -121.7850 },
  "Summerland": { lat: 49.6006, lng: -119.6778 },
  "Oliver": { lat: 49.1828, lng: -119.5503 },
  "Osoyoos": { lat: 49.0326, lng: -119.4681 },
  "Grand Forks": { lat: 49.0336, lng: -118.4400 },
  "Rossland": { lat: 49.0783, lng: -117.8023 },
  "Kimberley": { lat: 49.6697, lng: -115.9778 },
  "Sparwood": { lat: 49.7333, lng: -114.8853 },
  "Elkford": { lat: 50.0234, lng: -114.9225 },
  "Valemount": { lat: 52.8302, lng: -119.2636 },
  "McBride": { lat: 53.3000, lng: -120.1667 },
  "Mackenzie": { lat: 55.3379, lng: -123.0965 },
  "Tumbler Ridge": { lat: 55.1289, lng: -121.0000 },
  "Chetwynd": { lat: 55.6975, lng: -121.6400 },
  "Hudson's Hope": { lat: 56.0333, lng: -121.9000 },
  "Fort Nelson": { lat: 58.8050, lng: -122.7002 },
  "Stewart": { lat: 55.9364, lng: -129.9853 },
  "Hazelton": { lat: 55.2500, lng: -127.6667 },
  "Fraser Lake": { lat: 54.0500, lng: -124.8500 },
  "Fort St. James": { lat: 54.4333, lng: -124.2500 },
  "Metro-Vancouver": { lat: 49.2827, lng: -123.1207 },
  "Capital": { lat: 48.4284, lng: -123.3656 },
  "Fraser Valley": { lat: 49.0504, lng: -122.3045 },
  "Okanagan-Similkameen": { lat: 49.4991, lng: -119.5937 },
  "Central Okanagan": { lat: 49.8880, lng: -119.4960 },
  "North Okanagan": { lat: 50.2671, lng: -119.2720 },
  "Thompson-Nicola": { lat: 50.6745, lng: -120.3273 },
  "Cariboo": { lat: 52.1294, lng: -122.1383 },
  "Kootenay Boundary": { lat: 49.0966, lng: -117.7103 },
  "Central Kootenay": { lat: 49.4928, lng: -117.2948 },
  "East Kootenay": { lat: 49.5097, lng: -115.7694 },
  "Columbia Shuswap": { lat: 51.0000, lng: -118.1957 },
  "Comox Valley": { lat: 49.6879, lng: -124.9936 },
  "Strathcona": { lat: 50.0244, lng: -125.2475 },
  "Cowichan Valley": { lat: 48.7787, lng: -123.7079 },
  "Nanaimo RD": { lat: 49.1659, lng: -123.9401 },
  "Alberni-Clayoquot": { lat: 49.2339, lng: -124.8055 },
  "Powell River RD": { lat: 49.8353, lng: -124.5247 },
  "Sunshine Coast": { lat: 49.4756, lng: -123.7545 },
  "Squamish-Lillooet": { lat: 50.1163, lng: -122.9574 },
  "Peace River": { lat: 56.2465, lng: -120.8476 },
  "Fraser-Fort George": { lat: 53.9171, lng: -122.7497 },
  "Bulkley-Nechako": { lat: 54.7804, lng: -127.1743 },
  "Kitimat-Stikine": { lat: 54.5182, lng: -128.5926 },
  "North Coast": { lat: 54.3150, lng: -130.3208 },
  "Northern Rockies": { lat: 58.8050, lng: -122.7002 },
  "British Columbia": { lat: 54.5, lng: -125.5 },
  "BC Total": { lat: 54.5, lng: -125.5 },
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
  
  // Create tables in Turso
  console.log("📋 Creating database schema...");
  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS Community (
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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS EmissionsData (
      id TEXT PRIMARY KEY,
      communityId TEXT NOT NULL,
      source TEXT NOT NULL,
      energyType TEXT NOT NULL,
      subSector TEXT NOT NULL,
      consumption REAL NOT NULL,
      connections INTEGER,
      emissions REAL NOT NULL,
      year INTEGER NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (communityId) REFERENCES Community(id)
    )
  `);
  
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_community_orgName ON Community(orgName)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_community_totalEmissions ON Community(totalEmissions)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_emissions_communityId ON EmissionsData(communityId)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_emissions_subSector ON EmissionsData(subSector)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS idx_emissions_year ON EmissionsData(year)`);
  
  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await libsql.execute(`DELETE FROM EmissionsData`);
  await libsql.execute(`DELETE FROM Community`);
  
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
  
  for (const [_, community] of communityMap) {
    const coords = getCoordinates(community.orgName);
    const communityId = crypto.randomUUID();
    
    // Insert community
    await libsql.execute({
      sql: `INSERT INTO Community (
        id, orgUnit, orgName, latitude, longitude, totalEmissions, resEmissions, csmiEmissions, mixedEmissions,
        resConnections, csmiConnections, mixedConnections, totalConnections,
        electricEmissions, gasEmissions, oilEmissions, propaneEmissions, woodEmissions, otherEmissions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        sql: `INSERT INTO EmissionsData (id, communityId, source, energyType, subSector, consumption, connections, emissions, year)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
      });
      totalRecords++;
    }
    
    created++;
    if (created % 20 === 0) {
      console.log(`   Created ${created}/${communityMap.size} communities...`);
    }
  }
  
  console.log("✅ Turso database seeded successfully!");
  console.log(`   📊 Communities: ${created}`);
  console.log(`   📈 Emissions records: ${totalRecords}`);
}

main().catch((e) => {
  console.error("❌ Error seeding database:", e);
  process.exit(1);
});

