import { NextRequest, NextResponse } from "next/server";

// Default competitors to show when database is not available
const DEFAULT_COMPETITORS = [
  {
    id: "default-1",
    name: "AAON",
    logoUrl: null,
    territory: ["National"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-2",
    name: "Johnson Barrows BC",
    logoUrl: null,
    territory: ["BC"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "regional",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-3",
    name: "J&S Sales BC",
    logoUrl: null,
    territory: ["BC"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "local",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-4",
    name: "Riada Sales",
    logoUrl: null,
    territory: ["BC", "Alberta"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "regional",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-5",
    name: "E.H. Price Solutions",
    logoUrl: null,
    territory: ["Western Canada"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "regional",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-6",
    name: "Master Group",
    logoUrl: null,
    territory: ["Canada"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-7",
    name: "Engineered Air",
    logoUrl: null,
    territory: ["Canada"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-8",
    name: "Trane Technologies",
    logoUrl: null,
    territory: ["Global"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-9",
    name: "Mitsubishi Electric HVAC",
    logoUrl: null,
    territory: ["Global"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-10",
    name: "Carrier",
    logoUrl: null,
    territory: ["Global"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-11",
    name: "Daikin Industries",
    logoUrl: null,
    territory: ["Global"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
  {
    id: "default-12",
    name: "Lennox International",
    logoUrl: null,
    territory: ["North America"],
    estimatedMarketShare: 0,
    manufacturersRepresented: [],
    keyPersonnel: [],
    pricingPositioning: "unknown",
    strengths: [],
    weaknesses: [],
    isActive: true,
    type: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { intelligence: 0 },
  },
];

// Try to import prisma, but don't fail if it's not available
let prisma: any = null;
try {
  prisma = require("@/lib/prisma").prisma;
} catch {
  console.log("Prisma not available, using default competitors");
}

// GET /api/intelligence/competitors - Get all competitors
export async function GET() {
  try {
    // Try database first
    if (prisma) {
      try {
        const competitors = await prisma.competitor.findMany({
          orderBy: { updatedAt: "desc" },
          include: {
            _count: {
              select: { intelligence: true },
            },
          },
        });

        // Parse JSON fields
        const parsed = competitors.map((c: any) => ({
          ...c,
          territory: JSON.parse(c.territory || "[]"),
          manufacturersRepresented: c.manufacturersRepresented ? JSON.parse(c.manufacturersRepresented) : [],
          keyPersonnel: c.keyPersonnel ? JSON.parse(c.keyPersonnel) : [],
          strengths: c.strengths ? JSON.parse(c.strengths) : [],
          weaknesses: c.weaknesses ? JSON.parse(c.weaknesses) : [],
        }));

        return NextResponse.json(parsed);
      } catch (dbError) {
        console.log("Database error, falling back to defaults:", dbError);
      }
    }

    // Return defaults if database is not available
    return NextResponse.json(DEFAULT_COMPETITORS);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    // Return defaults on any error
    return NextResponse.json(DEFAULT_COMPETITORS);
  }
}

// POST /api/intelligence/competitors - Create new competitor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // If no database, return mock created competitor
    if (!prisma) {
      const mockCompetitor = {
        id: `temp-${Date.now()}`,
        name: body.name,
        logoUrl: body.logoUrl || null,
        territory: body.territory || [],
        estimatedMarketShare: body.estimatedMarketShare || 0,
        manufacturersRepresented: body.manufacturersRepresented || [],
        keyPersonnel: body.keyPersonnel || [],
        pricingPositioning: body.pricingPositioning || null,
        strengths: body.strengths || [],
        weaknesses: body.weaknesses || [],
        isActive: body.isActive ?? true,
        type: body.type || "local",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { intelligence: 0 },
      };
      return NextResponse.json(mockCompetitor);
    }
    
    const competitor = await prisma.competitor.create({
      data: {
        name: body.name,
        logoUrl: body.logoUrl || null,
        territory: JSON.stringify(body.territory || []),
        estimatedMarketShare: body.estimatedMarketShare || 0,
        manufacturersRepresented: body.manufacturersRepresented 
          ? JSON.stringify(body.manufacturersRepresented) 
          : null,
        keyPersonnel: body.keyPersonnel 
          ? JSON.stringify(body.keyPersonnel) 
          : null,
        pricingPositioning: body.pricingPositioning || null,
        strengths: body.strengths ? JSON.stringify(body.strengths) : null,
        weaknesses: body.weaknesses ? JSON.stringify(body.weaknesses) : null,
        isActive: body.isActive ?? true,
      },
    });

    // Return with parsed JSON fields
    return NextResponse.json({
      ...competitor,
      territory: JSON.parse(competitor.territory || "[]"),
      manufacturersRepresented: competitor.manufacturersRepresented 
        ? JSON.parse(competitor.manufacturersRepresented) 
        : [],
      keyPersonnel: competitor.keyPersonnel ? JSON.parse(competitor.keyPersonnel) : [],
      strengths: competitor.strengths ? JSON.parse(competitor.strengths) : [],
      weaknesses: competitor.weaknesses ? JSON.parse(competitor.weaknesses) : [],
    });
  } catch (error) {
    console.error("Error creating competitor:", error);
    return NextResponse.json({ error: "Failed to create competitor" }, { status: 500 });
  }
}
