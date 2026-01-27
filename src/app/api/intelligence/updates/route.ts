import { NextRequest, NextResponse } from "next/server";

// Default updates to show when database is not available
const DEFAULT_UPDATES = [
  {
    id: "update-1",
    competitorId: "default-10",
    category: "product",
    title: "Air-to-Water Heat Pump Award",
    description: "Carrier's Air-to-Water Heat Pump with Integrated Domestic Hot Water (AWHP with DHW) named 2025 Green Builder Media Sustainable Product of the Year for its COP up to 4.9, low-GWP refrigerant, and suitability for new construction or retrofits.",
    source: "https://www.carrier.com/residential/en/us/news/news-article/carrier-s-air-to-water-heat-pump-with-integrated-domestic-hot-water-named-a-2025-green-builder-media-sustainable-product-of-the-year.html",
    importance: "medium",
    dateDiscovered: new Date("2026-01-16").toISOString(),
    createdBy: "System",
    pinned: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    competitor: {
      id: "default-10",
      name: "Carrier",
      logoUrl: null,
      territory: ["Global"],
    },
    comments: [],
  },
  {
    id: "update-2",
    competitorId: "default-10",
    category: "product",
    title: "Opti-V VRF Heat Pump Launch",
    description: "Carrier launched the Opti-V system, a variable refrigerant flow heat pump for residential and light commercial use, supporting up to nine indoor units, SEER2 up to 29.7, and operation from -22°F to 122°F. Offered under Carrier and Toshiba Carrier brands with Puron Advance™ compatibility and Energy Star/IRA tax credits.",
    source: "https://www.carrier.com/residential/en/us/news/news-article/carrier-launches-opti-v--a-new-era-of-high-efficiency--heat-pump-solutions-for-residential-and-light-commercial-applications.html",
    importance: "high",
    dateDiscovered: new Date("2026-01-16").toISOString(),
    createdBy: "System",
    pinned: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    competitor: {
      id: "default-10",
      name: "Carrier",
      logoUrl: null,
      territory: ["Global"],
    },
    comments: [],
  },
  {
    id: "update-3",
    competitorId: "default-10",
    category: "product",
    title: "Expanded Ductless Lineup for 2025",
    description: "Carrier finalized its 2025 ductless HVAC portfolio using Puron Advance™ R-454B refrigerant, expanding Infinity tier to single-zone, light commercial, and multi-zone units with heating down to -22°F. Performance tier optimized with reduced SKUs while maintaining capacities, and multi-zone supports up to six indoor units.",
    source: "https://hvac-blog.acca.org/carrier-unveils-expanded-ductless-lineup-for-2025/",
    importance: "high",
    dateDiscovered: new Date("2026-01-16").toISOString(),
    createdBy: "System",
    pinned: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    competitor: {
      id: "default-10",
      name: "Carrier",
      logoUrl: null,
      territory: ["Global"],
    },
    comments: [],
  },
  {
    id: "update-4",
    competitorId: "default-11",
    category: "expansion",
    title: "New Manufacturing Facility in Jeddah",
    description: "Daikin broke ground on a new facility in Jeddah, Saudi Arabia on November 26, 2025, for localized production of chillers and hydronic heat pumps to support Vision 2030 and regional growth in the Middle East.",
    source: "https://www.daikin.com/press/2025/20251127",
    importance: "high",
    dateDiscovered: new Date("2026-01-16").toISOString(),
    createdBy: "System",
    pinned: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    competitor: {
      id: "default-11",
      name: "Daikin Industries",
      logoUrl: null,
      territory: ["Global"],
    },
    comments: [],
  },
];

// Try to import prisma, but don't fail if it's not available
let prisma: any = null;
try {
  prisma = require("@/lib/prisma").prisma;
} catch {
  console.log("Prisma not available, using default updates");
}

// GET /api/intelligence/updates - Get all updates with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const competitorId = searchParams.get("competitorId");
    const category = searchParams.get("category");
    const importance = searchParams.get("importance");
    const includeDismissed = searchParams.get("includeDismissed") === "true";

    // Try database first
    if (prisma) {
      try {
        const where: any = {};

        if (competitorId) {
          where.competitorId = competitorId;
        }

        if (category) {
          where.category = category;
        }

        if (importance) {
          where.importance = importance;
        }

        if (!includeDismissed) {
          where.dismissed = false;
        }

        const updates = await prisma.competitorIntelligence.findMany({
          where,
          orderBy: { dateDiscovered: "desc" },
          include: {
            competitor: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                territory: true,
              },
            },
            comments: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        // Parse competitor territory JSON
        const parsed = updates.map((u: any) => ({
          ...u,
          competitor: u.competitor
            ? {
                ...u.competitor,
                territory: JSON.parse(u.competitor.territory || "[]"),
              }
            : null,
        }));

        return NextResponse.json(parsed);
      } catch (dbError) {
        console.log("Database error, falling back to defaults:", dbError);
      }
    }

    // Return filtered defaults if database is not available
    let filteredUpdates = DEFAULT_UPDATES;
    
    if (competitorId) {
      filteredUpdates = filteredUpdates.filter(u => u.competitorId === competitorId);
    }
    if (category) {
      filteredUpdates = filteredUpdates.filter(u => u.category === category);
    }
    if (importance) {
      filteredUpdates = filteredUpdates.filter(u => u.importance === importance);
    }
    if (!includeDismissed) {
      filteredUpdates = filteredUpdates.filter(u => !u.dismissed);
    }

    return NextResponse.json(filteredUpdates);
  } catch (error) {
    console.error("Error fetching updates:", error);
    // Return defaults on any error
    return NextResponse.json(DEFAULT_UPDATES);
  }
}

// POST /api/intelligence/updates - Create new intelligence update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If no database, return mock created update
    if (!prisma) {
      const mockUpdate = {
        id: `temp-update-${Date.now()}`,
        competitorId: body.competitorId,
        category: body.category,
        title: body.title,
        description: body.description,
        source: body.source || null,
        importance: body.importance || "medium",
        dateDiscovered: new Date().toISOString(),
        createdBy: body.createdBy || "System",
        pinned: body.pinned || false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        competitor: null,
        comments: [],
      };
      return NextResponse.json(mockUpdate);
    }

    const update = await prisma.competitorIntelligence.create({
      data: {
        competitorId: body.competitorId,
        category: body.category,
        title: body.title,
        description: body.description,
        source: body.source || null,
        importance: body.importance || "medium",
        createdBy: body.createdBy || "System",
        pinned: body.pinned || false,
        dismissed: false,
      },
      include: {
        competitor: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            territory: true,
          },
        },
        comments: true,
      },
    });

    return NextResponse.json({
      ...update,
      competitor: update.competitor
        ? {
            ...update.competitor,
            territory: JSON.parse(update.competitor.territory || "[]"),
          }
        : null,
    });
  } catch (error) {
    console.error("Error creating update:", error);
    return NextResponse.json({ error: "Failed to create update" }, { status: 500 });
  }
}
