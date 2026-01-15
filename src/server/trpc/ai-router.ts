import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import OpenAI from "openai";

// Initialize Thesys C1 client
const c1Client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// System prompt with comprehensive data context
const SYSTEM_PROMPT = `You are an AI assistant for the BC Emissions Interactive Map application, designed for HVAC business intelligence.

## Available Data Sources

### 1. BC Community Energy & Emissions Data (2022)
- 221 communities across British Columbia
- Emissions by segment: Residential (Res), Commercial/Industrial (CSMI), Mixed
- Energy sources: Electric, Natural Gas, Oil, Propane, Wood, Other
- Connection counts and consumption data
- Key metrics: Total emissions (TCO2e), connections, average emissions per connection

### 2. BC Major Projects Inventory (MPI)
- 830+ proposed and under-construction projects
- Categories: Residential, Commercial, Infrastructure, Institutional, Industrial
- Data includes: Project value, developer, municipality, region, status, timeline
- Total value: ~$312 billion across all projects

### 3. HVAC & Heat Pump Analysis
- CleanBC rebate programs and calculations
- Heat pump conversion opportunities
- BC climate zones and efficiency standards
- Emission reduction potential calculations

### 4. User-Uploaded Documents
- Custom data files uploaded by the user (Excel, PDF, Word, CSV)
- These provide additional context for specific queries

## Your Capabilities

1. **Data Analysis**: Query and analyze emissions, projects, and energy data
2. **Market Intelligence**: Identify HVAC opportunities, lead generation insights
3. **Comparisons**: Compare communities, projects, developers, regions
4. **Calculations**: Emissions savings, rebate estimates, conversion potential
5. **Document Generation**: Create reports, summaries, and analysis documents
6. **Research Mode**: When enabled, search the web for current information

## Response Guidelines

- Always cite specific data when available (e.g., "Vancouver has 1,455,268 TCO2e emissions")
- Use tables and structured formats for data-heavy responses
- Provide actionable insights for HVAC business decisions
- When research mode is enabled, include web sources for current information
- Be precise with numbers and avoid hallucinating statistics

## BC Regulatory Context

- BC's CleanBC targets: 40% reduction by 2030, 60% by 2040, 80% by 2050
- Zero Carbon Step Code: Progressive requirements for new buildings
- Heat pump adoption incentives: Up to $16,000 for residential, higher for commercial
- Climate zones: 4-7A depending on location, affecting equipment requirements`;

// Web search function for research mode
async function webSearch(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
    );
    const data = await response.json();
    
    if (data.AbstractText) {
      return `Web Search Result:\n${data.AbstractText}\nSource: ${data.AbstractURL || 'DuckDuckGo'}`;
    }
    
    // Fallback: return a note that web search is limited
    return `Web search performed for: "${query}". For more detailed results, consider using a dedicated search API.`;
  } catch (error) {
    return `Web search unavailable. Query: "${query}"`;
  }
}

// Helper to build data context from database
async function buildDataContext(
  query: string,
  ctx: { prisma: any },
  includeDocuments: boolean = true
): Promise<string> {
  let context = "";
  const lowerQuery = query.toLowerCase();

  try {
    // Always include summary stats
    const communityCount = await ctx.prisma.community.count();
    const projectCount = await ctx.prisma.majorProject.count();
    
    context += `\n\n--- Database Summary ---`;
    context += `\nTotal Communities: ${communityCount}`;
    context += `\nTotal Major Projects: ${projectCount}`;

    // If asking about specific community
    const communityKeywords = [
      "vancouver", "surrey", "burnaby", "richmond", "victoria", 
      "kelowna", "kamloops", "nanaimo", "prince george", "abbotsford"
    ];
    
    for (const keyword of communityKeywords) {
      if (lowerQuery.includes(keyword)) {
        const community = await ctx.prisma.community.findFirst({
          where: { orgName: { contains: keyword } },
        });
        if (community) {
          context += `\n\n--- ${community.orgName} Data ---`;
          context += `\nTotal Emissions: ${community.totalEmissions.toLocaleString()} TCO2e`;
          context += `\nResidential: ${community.resEmissions.toLocaleString()} TCO2e`;
          context += `\nCommercial/Industrial: ${community.csmiEmissions.toLocaleString()} TCO2e`;
          context += `\nTotal Connections: ${community.totalConnections.toLocaleString()}`;
          context += `\nElectric Emissions: ${community.electricEmissions.toLocaleString()} TCO2e`;
          context += `\nGas Emissions: ${community.gasEmissions.toLocaleString()} TCO2e`;
        }
        break;
      }
    }

    // If asking about top/highest/largest emissions
    if (lowerQuery.includes("top") || lowerQuery.includes("highest") || lowerQuery.includes("largest")) {
      const topCommunities = await ctx.prisma.community.findMany({
        orderBy: { totalEmissions: "desc" },
        take: 10,
      });
      context += `\n\n--- Top 10 Communities by Emissions ---`;
      topCommunities.forEach((c: any, i: number) => {
        context += `\n${i + 1}. ${c.orgName}: ${c.totalEmissions.toLocaleString()} TCO2e`;
      });
    }

    // If asking about projects
    if (lowerQuery.includes("project") || lowerQuery.includes("construction") || lowerQuery.includes("development")) {
      const projectStats = await ctx.prisma.majorProject.aggregate({
        _sum: { estimatedCost: true },
        _count: true,
      });
      
      const byStatus = await ctx.prisma.majorProject.groupBy({
        by: ["projectStatus"],
        _count: true,
        _sum: { estimatedCost: true },
      });
      
      context += `\n\n--- Project Statistics ---`;
      context += `\nTotal Projects: ${projectStats._count}`;
      context += `\nTotal Value: $${((projectStats._sum.estimatedCost || 0) / 1000).toFixed(1)}B`;
      
      byStatus.forEach((s: any) => {
        context += `\n${s.projectStatus}: ${s._count} projects ($${((s._sum.estimatedCost || 0) / 1000).toFixed(1)}B)`;
      });
    }

    // If asking about LNG or specific project types
    if (lowerQuery.includes("lng") || lowerQuery.includes("gas") || lowerQuery.includes("pipeline")) {
      const lngProjects = await ctx.prisma.majorProject.findMany({
        where: {
          OR: [
            { name: { contains: "LNG" } },
            { name: { contains: "Gas" } },
            { name: { contains: "Pipeline" } },
          ],
        },
        orderBy: { estimatedCost: "desc" },
        take: 10,
      });
      
      if (lngProjects.length > 0) {
        context += `\n\n--- LNG/Gas Projects ---`;
        lngProjects.forEach((p: any, i: number) => {
          context += `\n${i + 1}. ${p.name}: $${(p.estimatedCost / 1000).toFixed(1)}B (${p.projectStatus})`;
        });
      }
    }

    // If asking about developers
    if (lowerQuery.includes("developer") || lowerQuery.includes("who is building")) {
      const developers = await ctx.prisma.majorProject.groupBy({
        by: ["developer"],
        _count: true,
        _sum: { estimatedCost: true },
      });
      
      const topDevs = developers
        .filter((d: any) => d.developer)
        .sort((a: any, b: any) => (b._sum.estimatedCost || 0) - (a._sum.estimatedCost || 0))
        .slice(0, 10);
      
      context += `\n\n--- Top Developers by Project Value ---`;
      topDevs.forEach((d: any, i: number) => {
        context += `\n${i + 1}. ${d.developer}: ${d._count} projects ($${((d._sum.estimatedCost || 0) / 1000).toFixed(1)}B)`;
      });
    }

    // Include uploaded documents if available
    if (includeDocuments) {
      const documents = await ctx.prisma.uploadedDocument.findMany({
        select: { filename: true, summary: true, category: true },
        take: 5,
      });
      
      if (documents.length > 0) {
        context += `\n\n--- Uploaded Documents ---`;
        documents.forEach((doc: any) => {
          context += `\n• ${doc.filename}${doc.category ? ` (${doc.category})` : ""}`;
          if (doc.summary) {
            context += `\n  Summary: ${doc.summary.substring(0, 200)}...`;
          }
        });
      }
    }

  } catch (error) {
    console.error("Error building context:", error);
    context += "\n[Error fetching some data context]";
  }

  return context;
}

export const aiRouter = router({
  // Send a chat message
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string(),
          })
        ),
        conversationId: z.string().optional(),
        researchMode: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { messages, conversationId, researchMode } = input;

      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await ctx.prisma.conversation.findUnique({
          where: { id: conversationId },
        });
      }

      if (!conversation) {
        conversation = await ctx.prisma.conversation.create({
          data: {
            title: messages[0]?.content?.substring(0, 50) || "New Conversation",
          },
        });
      }

      // Get the latest user message
      const userMessage = messages[messages.length - 1];
      
      // Save user message to database
      await ctx.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: userMessage.role,
          content: userMessage.content,
          researchMode,
        },
      });

      // Build context from database
      const dataContext = await buildDataContext(userMessage.content, ctx);

      // If research mode is on, do a web search
      let researchContext = "";
      if (researchMode) {
        researchContext = await webSearch(userMessage.content);
      }

      // Build the full message array
      const fullMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...messages.slice(0, -1), // Previous messages
        {
          role: "user" as const,
          content: `${userMessage.content}${dataContext}${researchMode ? `\n\n--- Web Research ---\n${researchContext}` : ""}`,
        },
      ];

      try {
        const completion = await c1Client.chat.completions.create({
          model: "c1-nightly",
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 2000,
        });

        const assistantContent = completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";

        // Save assistant response to database
        await ctx.prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: assistantContent,
            researchMode,
          },
        });

        // Update conversation title if it's the first exchange
        const messageCount = await ctx.prisma.message.count({
          where: { conversationId: conversation.id },
        });
        
        if (messageCount <= 2) {
          await ctx.prisma.conversation.update({
            where: { id: conversation.id },
            data: { title: userMessage.content.substring(0, 50) },
          });
        }

        return {
          content: assistantContent,
          conversationId: conversation.id,
        };
      } catch (error: any) {
        console.error("AI API Error:", error);
        
        // Return a helpful error message
        const errorMessage = error.message?.includes("API key")
          ? "API key error. Please check your Thesys API key configuration."
          : `AI service error: ${error.message || "Unknown error"}. Please try again.`;

        return {
          content: errorMessage,
          conversationId: conversation.id,
          error: true,
        };
      }
    }),

  // Get conversation history
  getConversations: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
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
            orderBy: { createdAt: "asc" },
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

  // Upload and process a document
  uploadDocument: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        content: z.string(), // Base64 encoded or extracted text
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { filename, mimeType, content, category } = input;

      // Create document record
      const document = await ctx.prisma.uploadedDocument.create({
        data: {
          filename,
          mimeType,
          size: content.length,
          content: content.substring(0, 50000), // Limit content size
          category,
        },
      });

      // Generate summary using AI
      try {
        const summaryCompletion = await c1Client.chat.completions.create({
          model: "c1-nightly",
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
        });

        const summary = summaryCompletion.choices[0]?.message?.content || "";

        await ctx.prisma.uploadedDocument.update({
          where: { id: document.id },
          data: { summary },
        });

        return { ...document, summary };
      } catch (error) {
        console.error("Summary generation error:", error);
        return document;
      }
    }),

  // Get all uploaded documents
  getDocuments: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.uploadedDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        summary: true,
        category: true,
        createdAt: true,
      },
    });
  }),

  // Delete a document
  deleteDocument: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.uploadedDocument.delete({
        where: { id: input.id },
      });
    }),

  // Get document content for context
  getDocumentContent: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.uploadedDocument.findUnique({
        where: { id: input.id },
      });
    }),
});

export type AIRouter = typeof aiRouter;

