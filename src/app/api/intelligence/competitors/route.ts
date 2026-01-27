import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/intelligence/competitors - Get all competitors
export async function GET() {
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
    const parsed = competitors.map((c) => ({
      ...c,
      territory: JSON.parse(c.territory || "[]"),
      manufacturersRepresented: c.manufacturersRepresented ? JSON.parse(c.manufacturersRepresented) : [],
      keyPersonnel: c.keyPersonnel ? JSON.parse(c.keyPersonnel) : [],
      strengths: c.strengths ? JSON.parse(c.strengths) : [],
      weaknesses: c.weaknesses ? JSON.parse(c.weaknesses) : [],
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
  }
}

// POST /api/intelligence/competitors - Create new competitor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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

