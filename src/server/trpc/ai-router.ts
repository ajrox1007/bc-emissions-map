import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { chunkText } from "../lib/chunker";
import { generateEmbeddings } from "../lib/embeddings";
import { upsertVectors, deleteDocumentVectors } from "../lib/pinecone";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

/**
 * Background vectorization: chunks text, generates embeddings, upserts to Pinecone.
 * Updates document status in DB throughout the process.
 */
async function vectorizeInBackground(
  prisma: any,
  documentId: string,
  content: string,
  filename: string,
  category?: string
) {
  try {
    // Mark as processing
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { vectorizationStatus: "processing", vectorizationError: null },
    });

    // Chunk the text
    const chunks = chunkText(content);
    if (chunks.length === 0) {
      await prisma.uploadedDocument.update({
        where: { id: documentId },
        data: {
          vectorizationStatus: "completed",
          chunkCount: 0,
        },
      });
      return;
    }

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

    // Upsert to Pinecone
    const vectorCount = await upsertVectors(documentId, chunks, embeddings, {
      filename,
      category,
    });

    // Mark as completed
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        vectorizationStatus: "completed",
        chunkCount: vectorCount,
      },
    });
  } catch (error: any) {
    console.error(`Vectorization failed for doc ${documentId}:`, error);
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        vectorizationStatus: "failed",
        vectorizationError: error.message || "Unknown error",
      },
    });
  }
}

/**
 * After saving custom projects, generate AI insights and store them on the file record.
 */
async function generateInsightsInBackground(
  prisma: any,
  fileId: string,
  projects: Array<{
    name: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    category: string | null;
    status: string | null;
    estimatedCost: number | null;
  }>
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  try {
    const totalCost = projects.reduce((s, p) => s + (p.estimatedCost || 0), 0);
    const categories: Record<string, number> = {};
    const statuses: Record<string, number> = {};
    const withCoords = projects.filter((p) => p.latitude && p.longitude).length;

    projects.forEach((p) => {
      if (p.category) categories[p.category] = (categories[p.category] || 0) + 1;
      if (p.status) statuses[p.status] = (statuses[p.status] || 0) + 1;
    });

    const summary = `Total projects: ${projects.length}
With coordinates: ${withCoords}
Total estimated cost: $${totalCost.toLocaleString()}
Categories: ${JSON.stringify(categories)}
Statuses: ${JSON.stringify(statuses)}
Sample projects: ${projects.slice(0, 5).map((p) => `${p.name} (${p.category || "N/A"}, ${p.address || "no address"}, $${p.estimatedCost ?? "N/A"})`).join("; ")}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a data analyst. Given summary statistics about a set of custom projects uploaded by the user, generate 3-5 concise, actionable insights. Focus on geographic distribution, cost patterns, category breakdown, and notable trends. Keep each insight to 1-2 sentences. Return plain text with one insight per line, prefixed with a bullet (•).",
          },
          { role: "user", content: summary },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const insights = data.choices?.[0]?.message?.content?.trim() || "";
      await prisma.customProjectFile.update({
        where: { id: fileId },
        data: { insights },
      });
    }
  } catch (error) {
    console.error("Insights generation failed:", error);
  }
}

export const aiRouter = router({
  // Get conversation history
  getConversations: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        messages: {
          take: 1,
          orderBy: { timestamp: "desc" },
        },
      },
    });
  }),

  // Get messages for a conversation
  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.conversation.findUnique({
        where: { id: input.id },
        include: {
          messages: {
            orderBy: { timestamp: "asc" },
          },
        },
      });
    }),

  // Delete a conversation
  deleteConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.conversation.delete({
        where: { id: input.id },
      });
    }),

  // Delete all conversations
  deleteAllConversations: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.conversation.deleteMany({});
    return { success: true };
  }),

  // Upload and process a document
  uploadDocument: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        content: z.string(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { filename, mimeType, content, category } = input;

      // Create document record
      const document = await ctx.prisma.uploadedDocument.create({
        data: {
          filename,
          mimetype: mimeType,
          size: content.length,
          content: content.substring(0, 50000),
          category,
          vectorizationStatus: "pending",
        },
      });

      // Generate summary using Perplexity
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (apiKey) {
        try {
          const response = await fetch(PERPLEXITY_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                {
                  role: "system",
                  content: "You are a document summarizer. Provide a brief 2-3 sentence summary of the document content.",
                },
                {
                  role: "user",
                  content: `Summarize this document (${filename}):\n\n${content.substring(0, 5000)}`,
                },
              ],
              max_tokens: 200,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const summary = data.choices?.[0]?.message?.content || "";

            await ctx.prisma.uploadedDocument.update({
              where: { id: document.id },
              data: { summary },
            });

            // Fire background vectorization (non-blocking)
            vectorizeInBackground(ctx.prisma, document.id, content, filename, category);

            return { ...document, summary };
          }
        } catch (error) {
          console.error("Summary generation error:", error);
        }
      }

      // Fire background vectorization even if summary fails (non-blocking)
      vectorizeInBackground(ctx.prisma, document.id, content, filename, category);

      return document;
    }),

  // Get all uploaded documents (with vectorization fields)
  getDocuments: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.uploadedDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimetype: true,
        size: true,
        summary: true,
        category: true,
        vectorizationStatus: true,
        chunkCount: true,
        vectorizationError: true,
        createdAt: true,
      },
    });
  }),

  // Delete a document (also removes vectors from Pinecone)
  deleteDocument: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete vectors from Pinecone first
      try {
        await deleteDocumentVectors(input.id);
      } catch (error) {
        console.error("Failed to delete vectors from Pinecone:", error);
        // Continue with DB deletion even if Pinecone fails
      }

      return ctx.prisma.uploadedDocument.delete({
        where: { id: input.id },
      });
    }),

  // Vectorize (or retry) a document
  vectorizeDocument: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.uploadedDocument.findUnique({
        where: { id: input.id },
      });

      if (!doc) {
        throw new Error("Document not found");
      }

      if (!doc.content) {
        throw new Error("Document has no content to vectorize");
      }

      // Delete existing vectors if retrying
      try {
        await deleteDocumentVectors(doc.id);
      } catch {
        // Ignore — may not have vectors yet
      }

      // Fire background vectorization (non-blocking)
      vectorizeInBackground(ctx.prisma, doc.id, doc.content, doc.filename, doc.category || undefined);

      return { success: true };
    }),

  // Get document content for context
  getDocumentContent: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.uploadedDocument.findUnique({
        where: { id: input.id },
      });
    }),

  // ── Custom Projects Upload ─────────────────────────────────────────────────

  // AI-powered column mapping: send headers + sample rows to OpenAI
  parseProjectUpload: publicProcedure
    .input(
      z.object({
        headers: z.array(z.string()),
        sampleRows: z.array(z.array(z.string())),
      })
    )
    .mutation(async ({ input }) => {
      const { headers, sampleRows } = input;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

      const sample = sampleRows
        .slice(0, 3)
        .map((row) => headers.map((h, i) => `${h}: ${row[i] || ""}`).join(", "))
        .join("\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a data mapping assistant. You receive spreadsheet column headers and sample data from any kind of business dataset (HVAC equipment, construction projects, real estate, inventory, etc.).

Map each column to ONE of these standard fields:
- name (the primary identifier — a project name, customer name, equipment name, item name, building name, etc. REQUIRED — always pick the best candidate)
- latitude (numeric latitude coordinate)
- longitude (numeric longitude coordinate)
- address (street address, city name, location, region, or any geographic text — maps with "city", "location", "site", "region", "area", "province", "state", "zip" etc. should map here)
- category (type, kind, classification, equipment type, project type, construction type)
- status (status, stage, phase, condition, state of completion)
- estimatedCost (dollar value, price, cost, amount, budget, total — any monetary column)
- description (notes, details, comments, summary)

RULES:
1. Every column MUST be mapped. No column should be left out.
2. If a column clearly matches a standard field, use that field.
3. If a column contains city names, town names, or any geographic identifiers, ALWAYS map it to "address".
4. If a column contains monetary values (even if named "Value", "Amount", "Price", "Total"), map to "estimatedCost".
5. If a column contains dates, map to "metadata:Date" (or similar).
6. Columns that don't fit any standard field should be mapped to "metadata:<OriginalHeader>".
7. Exactly ONE column must map to "name" — pick the most descriptive/identifying one.

Respond with ONLY a JSON object: {"mapping": {"ColumnHeader": "standardField", ...}}`,
            },
            {
              role: "user",
              content: `Headers: ${JSON.stringify(headers)}\n\nSample rows:\n${sample}`,
            },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI error: ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      let text = data.choices?.[0]?.message?.content?.trim() || "{}";
      if (text.startsWith("```")) text = text.replace(/^```(?:json)?\n?/, "").replace(/```$/, "").trim();

      try {
        const parsed = JSON.parse(text);
        return { mapping: parsed.mapping || parsed } as { mapping: Record<string, string> };
      } catch {
        throw new Error("Failed to parse AI column mapping response");
      }
    }),

  // Save custom projects from a parsed spreadsheet
  saveCustomProjects: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        columnMapping: z.record(z.string(), z.string()),
        rows: z.array(z.record(z.string(), z.string())),
        rawContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { filename, columnMapping, rows, rawContent } = input;

      // Create the file record
      const file = await ctx.prisma.customProjectFile.create({
        data: {
          filename,
          rowCount: rows.length,
          columnMapping: JSON.stringify(columnMapping),
        },
      });

      // Build reverse mapping: standardField -> columnHeader
      const reverseMapping: Record<string, string> = {};
      for (const header of Object.keys(columnMapping)) {
        const field = columnMapping[header];
        reverseMapping[field] = header;
      }

      const parseCost = (val: string | undefined): number | null => {
        if (!val) return null;
        const cleaned = val.replace(/[$,\s]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      const parseLat = (val: string | undefined): number | null => {
        if (!val) return null;
        const num = parseFloat(val);
        return isNaN(num) || num < -90 || num > 90 ? null : num;
      };

      const parseLng = (val: string | undefined): number | null => {
        if (!val) return null;
        const num = parseFloat(val);
        return isNaN(num) || num < -180 || num > 180 ? null : num;
      };

      const projects = rows.map((row) => {
        const metadata: Record<string, string> = {};
        for (const header of Object.keys(columnMapping)) {
          const field = columnMapping[header];
          if (field.startsWith("metadata:") && row[header]) {
            metadata[field.replace("metadata:", "")] = row[header];
          }
        }

        const getName = (): string => {
          const nameHeader = reverseMapping["name"];
          if (nameHeader && row[nameHeader]) return row[nameHeader];
          // Fallback: use first non-empty value
          for (const v of Object.values(row)) {
            if (v && v.length > 0) return v;
          }
          return "Unnamed Project";
        };

        const getField = (field: string): string | null => {
          const header = reverseMapping[field];
          if (!header) return null;
          return row[header] || null;
        };

        return {
          fileId: file.id,
          name: getName(),
          latitude: parseLat(getField("latitude") ?? undefined),
          longitude: parseLng(getField("longitude") ?? undefined),
          address: getField("address"),
          category: getField("category"),
          status: getField("status"),
          estimatedCost: parseCost(getField("estimatedCost") ?? undefined),
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        };
      });

      // ── Geocode addresses that have no coordinates ────────────────────
      const gmapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (gmapsKey) {
        // Collect unique addresses that need geocoding
        const needsGeocode = projects.filter(
          (p) => (p.latitude === null || p.longitude === null) && p.address
        );

        // Deduplicate addresses for efficiency
        const uniqueAddresses = [...new Set(needsGeocode.map((p) => p.address!.toLowerCase().trim()))];
        const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

        // Batch geocode (throttled: max 10 per second for free tier)
        for (const addr of uniqueAddresses) {
          try {
            const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr + ", British Columbia, Canada")}&key=${gmapsKey}`;
            const geoRes = await fetch(geoUrl);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData.status === "OK" && geoData.results?.[0]) {
                const loc = geoData.results[0].geometry.location;
                geocodeCache[addr] = { lat: loc.lat, lng: loc.lng };
              } else {
                geocodeCache[addr] = null;
              }
            }
            // Throttle: ~100ms between requests
            await new Promise((r) => setTimeout(r, 100));
          } catch (e) {
            console.error(`Geocoding failed for "${addr}":`, e);
            geocodeCache[addr] = null;
          }
        }

        // Apply geocoded coordinates back to projects
        for (const p of projects) {
          if ((p.latitude === null || p.longitude === null) && p.address) {
            const cached = geocodeCache[p.address.toLowerCase().trim()];
            if (cached) {
              p.latitude = cached.lat;
              p.longitude = cached.lng;
            }
          }
        }
      }

      await ctx.prisma.customProject.createMany({ data: projects });

      // Vectorize for chatbot context (non-blocking)
      if (rawContent) {
        try {
          const doc = await ctx.prisma.uploadedDocument.create({
            data: {
              filename: `[Custom Projects] ${filename}`,
              mimetype: filename.endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              size: rawContent.length,
              content: rawContent.substring(0, 50000),
              category: "Project Data",
              vectorizationStatus: "pending",
            },
          });
          vectorizeInBackground(ctx.prisma, doc.id, rawContent, filename, "Project Data");
        } catch (e) {
          console.error("Vectorization setup error:", e);
        }
      }

      // Generate insights (non-blocking)
      generateInsightsInBackground(ctx.prisma, file.id, projects).catch(console.error);

      return { fileId: file.id, projectCount: projects.length };
    }),

  // Get all uploaded custom project files
  getCustomProjectFiles: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.customProjectFile.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { projects: true } } },
    });
  }),

  // Get custom projects with optional filters
  getCustomProjects: publicProcedure
    .input(
      z.object({
        fileId: z.string().optional(),
        category: z.string().optional(),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { fileId, category, searchQuery } = input;
      return ctx.prisma.customProject.findMany({
        where: {
          ...(fileId && { fileId }),
          ...(category && { category }),
          ...(searchQuery && {
            OR: [
              { name: { contains: searchQuery } },
              { address: { contains: searchQuery } },
              { category: { contains: searchQuery } },
            ],
          }),
        },
        orderBy: { createdAt: "desc" },
        include: { file: { select: { filename: true } } },
      });
    }),

  // Delete a custom project file and all its projects
  deleteCustomProjectFile: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.customProjectFile.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Get aggregate stats for custom projects
  getCustomProjectStats: publicProcedure.query(async ({ ctx }) => {
    const projects = await ctx.prisma.customProject.findMany();
    const files = await ctx.prisma.customProjectFile.count();

    const withLocation = projects.filter((p) => p.latitude && p.longitude).length;
    const totalCost = projects.reduce((sum, p) => sum + (p.estimatedCost || 0), 0);

    const categories: Record<string, number> = {};
    projects.forEach((p) => {
      const cat = p.category || "Uncategorized";
      categories[cat] = (categories[cat] || 0) + 1;
    });

    return {
      totalProjects: projects.length,
      totalFiles: files,
      withLocation,
      withoutLocation: projects.length - withLocation,
      totalCost,
      categories,
    };
  }),

  // Get app settings (e.g. email_recipient)
  getSettings: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.prisma.appSettings.findUnique({
        where: { key: input.key },
      });
      return setting?.value ?? null;
    }),

  // Upsert an app setting
  updateSettings: publicProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate email if the key is email_recipient
      if (input.key === "email_recipient") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value)) {
          throw new Error("Invalid email address");
        }
      }
      try {
        await ctx.prisma.appSettings.upsert({
          where: { key: input.key },
          update: { value: input.value },
          create: { key: input.key, value: input.value },
        });
      } catch (err: any) {
        console.error("AppSettings upsert error:", err);
        throw new Error("Failed to save setting: " + (err.message || "database error"));
      }
      return { success: true };
    }),
});

export type AIRouter = typeof aiRouter;
