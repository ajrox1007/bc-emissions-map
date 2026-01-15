import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

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

## Your Capabilities

1. **Data Analysis**: Query and analyze emissions, projects, and energy data
2. **Market Intelligence**: Identify HVAC opportunities, lead generation insights
3. **Comparisons**: Compare communities, projects, developers, regions
4. **Calculations**: Emissions savings, rebate estimates, conversion potential
5. **Document Generation**: Create reports, summaries, and analysis documents

## Response Guidelines

- Always cite specific data when available
- Use tables and structured formats for data-heavy responses
- Provide actionable insights for HVAC business decisions
- Be precise with numbers and avoid hallucinating statistics

## BC Regulatory Context

- BC's CleanBC targets: 40% reduction by 2030, 60% by 2040, 80% by 2050
- Zero Carbon Step Code: Progressive requirements for new buildings
- Heat pump adoption incentives: Up to $16,000 for residential, higher for commercial
- Climate zones: 4-7A depending on location, affecting equipment requirements

When generating UI, you can create:
- Charts and graphs for emissions data visualization
- Tables for comparisons
- Cards for community/project summaries
- Forms for calculations
- Interactive elements for data exploration`;

// Helper to build data context from database
async function buildDataContext(query: string): Promise<string> {
  let context = "";
  const lowerQuery = query.toLowerCase();

  try {
    // Always include summary stats
    const communityCount = await prisma.community.count();
    const projectCount = await prisma.majorProject.count();
    
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
        const community = await prisma.community.findFirst({
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
      const topCommunities = await prisma.community.findMany({
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
      const projectStats = await prisma.majorProject.aggregate({
        _sum: { estimatedCost: true },
        _count: true,
      });
      
      const byStatus = await prisma.majorProject.groupBy({
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
      const lngProjects = await prisma.majorProject.findMany({
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
      const developers = await prisma.majorProject.groupBy({
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
    const documents = await prisma.uploadedDocument.findMany({
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

  } catch (error) {
    console.error("Error building context:", error);
    context += "\n[Error fetching some data context]";
  }

  return context;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Get the latest user message for context building
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
    const userQuery = lastUserMessage?.content || "";

    // Build context from database
    const dataContext = await buildDataContext(userQuery);

    // Prepare messages with system prompt and context
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(0, -1),
      {
        role: "user",
        content: `${userQuery}${dataContext}`,
      },
    ];

    const completion = await c1Client.chat.completions.create({
      model: "c1-nightly",
      messages: fullMessages as any,
      temperature: 0.7,
      max_tokens: 4000,
    });

    const assistantContent = completion.choices[0]?.message?.content || "";

    // Save conversation to database
    try {
      let conversation = await prisma.conversation.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation || messages.length <= 1) {
        conversation = await prisma.conversation.create({
          data: {
            title: userQuery.substring(0, 50) || "New Conversation",
          },
        });
      }

      // Save user message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: userQuery,
        },
      });

      // Save assistant message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: assistantContent,
        },
      });
    } catch (dbError) {
      console.error("Error saving to database:", dbError);
    }

    // Return in OpenAI-compatible format for C1Chat
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "c1-nightly",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: assistantContent,
          },
          finish_reason: "stop",
        },
      ],
    });
  } catch (error: any) {
    console.error("C1 Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

