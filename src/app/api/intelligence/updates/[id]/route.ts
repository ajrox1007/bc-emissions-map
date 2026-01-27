import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/intelligence/updates/[id] - Get single update
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const update = await prisma.competitorIntelligence.findUnique({
      where: { id },
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

    if (!update) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

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
    console.error("Error fetching update:", error);
    return NextResponse.json({ error: "Failed to fetch update" }, { status: 500 });
  }
}

// PUT /api/intelligence/updates/[id] - Update an intelligence update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const update = await prisma.competitorIntelligence.update({
      where: { id },
      data: {
        category: body.category,
        title: body.title,
        description: body.description,
        source: body.source,
        importance: body.importance,
        pinned: body.pinned,
        dismissed: body.dismissed,
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
        comments: {
          orderBy: { createdAt: "asc" },
        },
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
    console.error("Error updating update:", error);
    return NextResponse.json({ error: "Failed to update update" }, { status: 500 });
  }
}

// DELETE /api/intelligence/updates/[id] - Delete an intelligence update
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.competitorIntelligence.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting update:", error);
    return NextResponse.json({ error: "Failed to delete update" }, { status: 500 });
  }
}

// POST /api/intelligence/updates/[id]/comment - Add comment to update
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const comment = await prisma.intelligenceComment.create({
      data: {
        intelligenceId: id,
        userName: body.userName || "Anonymous",
        commentText: body.commentText,
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

