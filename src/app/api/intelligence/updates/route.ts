import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/intelligence/updates - Get all updates with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const competitorId = searchParams.get("competitorId");
    const category = searchParams.get("category");
    const importance = searchParams.get("importance");
    const includeDismissed = searchParams.get("includeDismissed") === "true";

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
    const parsed = updates.map((u) => ({
      ...u,
      competitor: u.competitor
        ? {
            ...u.competitor,
            territory: JSON.parse(u.competitor.territory || "[]"),
          }
        : null,
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error fetching updates:", error);
    return NextResponse.json({ error: "Failed to fetch updates" }, { status: 500 });
  }
}

// POST /api/intelligence/updates - Create new intelligence update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

