import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/intelligence/competitors/[id] - Get single competitor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const competitor = await prisma.competitor.findUnique({
      where: { id: params.id },
      include: {
        intelligence: {
          orderBy: { dateDiscovered: "desc" },
          take: 10,
        },
        battlecard: true,
        _count: {
          select: { intelligence: true },
        },
      },
    });

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    // Parse JSON fields
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
    console.error("Error fetching competitor:", error);
    return NextResponse.json({ error: "Failed to fetch competitor" }, { status: 500 });
  }
}

// PUT /api/intelligence/competitors/[id] - Update competitor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const competitor = await prisma.competitor.update({
      where: { id: params.id },
      data: {
        name: body.name,
        logoUrl: body.logoUrl,
        territory: body.territory ? JSON.stringify(body.territory) : undefined,
        estimatedMarketShare: body.estimatedMarketShare,
        manufacturersRepresented: body.manufacturersRepresented 
          ? JSON.stringify(body.manufacturersRepresented) 
          : undefined,
        keyPersonnel: body.keyPersonnel 
          ? JSON.stringify(body.keyPersonnel) 
          : undefined,
        pricingPositioning: body.pricingPositioning,
        strengths: body.strengths ? JSON.stringify(body.strengths) : undefined,
        weaknesses: body.weaknesses ? JSON.stringify(body.weaknesses) : undefined,
        isActive: body.isActive,
      },
    });

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
    console.error("Error updating competitor:", error);
    return NextResponse.json({ error: "Failed to update competitor" }, { status: 500 });
  }
}

// DELETE /api/intelligence/competitors/[id] - Delete competitor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.competitor.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting competitor:", error);
    return NextResponse.json({ error: "Failed to delete competitor" }, { status: 500 });
  }
}

