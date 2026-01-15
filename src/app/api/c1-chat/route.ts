import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// System prompt with comprehensive data context
const SYSTEM_PROMPT = `You are an AI assistant for the BC Emissions Interactive Map application, designed for HVAC business intelligence in British Columbia.

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

1. Data Analysis: Query and analyze emissions, projects, and energy data
2. Market Intelligence: Identify HVAC opportunities, lead generation insights
3. Comparisons: Compare communities, projects, developers, regions
4. Calculations: Emissions savings, rebate estimates, conversion potential
5. Research: Access real-time web information when needed

## Response Guidelines

- Always cite specific data when available
- Use tables and structured formats for data-heavy responses
- Provide actionable insights for HVAC business decisions
- Be precise with numbers and avoid hallucinating statistics
- Format responses with clear headings and bullet points

## BC Regulatory Context

- BC's CleanBC targets: 40% reduction by 2030, 60% by 2040, 80% by 2050
- Zero Carbon Step Code: Progressive requirements for new buildings
- Heat pump adoption incentives: Up to $16,000 for residential, higher for commercial
- Climate zones: 4-7A depending on location, affecting equipment requirements`;

// Helper to build data context from database
async function buildDataContext(query: string): Promise<string> {
  let context = "";
  const lowerQuery = query.toLowerCase();

  try {
    // Always include summary stats
    const communityCount = await prisma.community.count();
    const projectCount = await prisma.majorProject.count();
    
    context += `\n\n[Database Context]`;
    context += `\nTotal Communities: ${communityCount}`;
    context += `\nTotal Major Projects: ${projectCount}`;

    // If asking about specific community
    const communityKeywords = [
      "vancouver", "surrey", "burnaby", "richmond", "victoria", 
      "kelowna", "kamloops", "nanaimo", "prince george", "abbotsford",
      "coquitlam", "langley", "delta", "maple ridge", "chilliwack"
    ];
    
    for (const keyword of communityKeywords) {
      if (lowerQuery.includes(keyword)) {
        const community = await prisma.community.findFirst({
          where: { orgName: { contains: keyword } },
        });
        if (community) {
          context += `\n\n[${community.orgName} Emissions Data]`;
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
    if (lowerQuery.includes("top") || lowerQuery.includes("highest") || lowerQuery.includes("largest") || lowerQuery.includes("most")) {
      const topCommunities = await prisma.community.findMany({
        orderBy: { totalEmissions: "desc" },
        take: 10,
      });
      context += `\n\n[Top 10 Communities by Emissions]`;
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
      
      context += `\n\n[Project Statistics]`;
      context += `\nTotal Projects: ${projectStats._count}`;
      context += `\nTotal Value: $${((projectStats._sum.estimatedCost || 0) / 1000).toFixed(1)}B`;
      
      byStatus.forEach((s: any) => {
        context += `\n${s.projectStatus}: ${s._count} projects ($${((s._sum.estimatedCost || 0) / 1000).toFixed(1)}B)`;
      });
    }

    // If asking about LNG or specific project types
    if (lowerQuery.includes("lng") || lowerQuery.includes("gas") || lowerQuery.includes("pipeline") || lowerQuery.includes("energy")) {
      const lngProjects = await prisma.majorProject.findMany({
        where: {
          OR: [
            { name: { contains: "LNG" } },
            { name: { contains: "Gas" } },
            { name: { contains: "Pipeline" } },
            { name: { contains: "Energy" } },
          ],
        },
        orderBy: { estimatedCost: "desc" },
        take: 10,
      });
      
      if (lngProjects.length > 0) {
        context += `\n\n[Energy/LNG Projects]`;
        lngProjects.forEach((p: any, i: number) => {
          context += `\n${i + 1}. ${p.name}: $${(p.estimatedCost / 1000).toFixed(1)}B (${p.projectStatus})`;
        });
      }
    }

    // If asking about developers
    if (lowerQuery.includes("developer") || lowerQuery.includes("who is building") || lowerQuery.includes("builder")) {
      const developers = await prisma.majorProject.groupBy({
        by: ["developer"],
        _count: true,
        _sum: { estimatedCost: true },
      });
      
      const topDevs = developers
        .filter((d: any) => d.developer)
        .sort((a: any, b: any) => (b._sum.estimatedCost || 0) - (a._sum.estimatedCost || 0))
        .slice(0, 10);
      
      context += `\n\n[Top Developers by Project Value]`;
      topDevs.forEach((d: any, i: number) => {
        context += `\n${i + 1}. ${d.developer}: ${d._count} projects ($${((d._sum.estimatedCost || 0) / 1000).toFixed(1)}B)`;
      });
    }

    // If asking about fossil fuel or gas heating
    if (lowerQuery.includes("fossil") || lowerQuery.includes("gas heating") || lowerQuery.includes("natural gas")) {
      const highGasCommunities = await prisma.community.findMany({
        orderBy: { gasEmissions: "desc" },
        take: 10,
      });
      context += `\n\n[Communities with Highest Gas Emissions]`;
      highGasCommunities.forEach((c: any, i: number) => {
        const gasPercent = c.totalEmissions > 0 ? ((c.gasEmissions / c.totalEmissions) * 100).toFixed(1) : 0;
        context += `\n${i + 1}. ${c.orgName}: ${c.gasEmissions.toLocaleString()} TCO2e (${gasPercent}% of total)`;
      });
    }

    // If asking about opportunities or leads
    if (lowerQuery.includes("opportunit") || lowerQuery.includes("lead") || lowerQuery.includes("potential")) {
      const opportunities = await prisma.community.findMany({
        where: { gasEmissions: { gt: 10000 } },
        orderBy: { gasEmissions: "desc" },
        take: 10,
      });
      context += `\n\n[High-Potential HVAC Conversion Opportunities]`;
      opportunities.forEach((c: any, i: number) => {
        context += `\n${i + 1}. ${c.orgName}: ${c.gasEmissions.toLocaleString()} TCO2e gas emissions, ${c.totalConnections} connections`;
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

    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    // Debug logging (remove in production)
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("API Key prefix:", apiKey?.substring(0, 8) || "none");
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Perplexity API key not configured. Please add PERPLEXITY_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }
    
    if (apiKey.length < 20) {
      return NextResponse.json(
        { error: "Perplexity API key appears to be invalid (too short)" },
        { status: 500 }
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

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", errorText);
      return NextResponse.json(
        { error: `Perplexity API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantContent = data.choices?.[0]?.message?.content || "";

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

    // Return in OpenAI-compatible format
    return NextResponse.json({
      id: data.id || `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "sonar-pro",
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
      citations: data.citations || [],
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
