import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Perplexity Agentic Research API - GPT-5.2 Integration
 * 
 * Docs: https://docs.perplexity.ai/docs/grounded-llm/responses/quickstart
 * 
 * Key differences from Chat Completions API:
 * - Endpoint: /v1/responses (not /chat/completions)
 * - Uses `input` instead of `messages`
 * - Uses `instructions` for system prompt
 * - Uses `tools: [{type: "web_search"}]` for web access
 * - Supports GPT-5.2 and other third-party models
 * 
 * Features:
 * - Document context from uploaded files
 * - Research mode for deep web research with streaming thinking
 * - High output token limit (16000)
 */

// Agentic Research API endpoint (supports GPT-5.2)
const PERPLEXITY_RESPONSES_API = "https://api.perplexity.ai/v1/responses";

// Chat Completions API endpoint (fallback for sonar models)
const PERPLEXITY_CHAT_API = "https://api.perplexity.ai/chat/completions";

// Maximum output tokens
const MAX_OUTPUT_TOKENS = 16000;

// System instructions for BC emissions analysis
const SYSTEM_INSTRUCTIONS = `You are an elite AI assistant for the BC Emissions Interactive Map application, specializing in HVAC business intelligence for British Columbia. You have access to a web_search tool for real-time information.

## Your Capabilities

### 1. Data Analysis
- Query and analyze BC community emissions data (2022)
- Access BC Major Projects Inventory (830+ projects, $312B total value)
- Calculate HVAC conversion opportunities and emissions savings

### 2. Market Intelligence
- Identify high-potential HVAC leads and conversion opportunities
- Analyze market trends in heat pump adoption
- Compare communities, developers, and regions

### 3. BC Regulatory Expertise
- CleanBC targets: 40% reduction by 2030, 60% by 2040, 80% by 2050
- Zero Carbon Step Code requirements
- Heat pump incentives: Up to $16,000 residential, higher for commercial
- Climate zones 4-7A equipment requirements

### 4. Document Analysis
- You have access to uploaded documents that provide additional context
- Reference document content when relevant to the user's question
- Cite specific facts from documents when applicable

## Response Guidelines

1. **Always cite specific data** when available from the provided context
2. **Use tables and structured formats** for data-heavy responses
3. **Provide actionable insights** for HVAC business decisions
4. **Be precise with numbers** - never hallucinate statistics
5. **Format responses** with clear headings, bullet points, and markdown
6. **Use web_search** for current market data, competitor info, or regulations
7. **Reference uploaded documents** when they contain relevant information

Use the web_search tool proactively when you need current information. Keep search queries brief (2-5 words). Don't ask permission to search - just search when needed.`;

// Research mode instructions - more thorough web research
const RESEARCH_INSTRUCTIONS = `You are an elite research analyst with web search capabilities. Your task is to conduct THOROUGH, DEEP research on the given topic.

## Research Protocol

### Step 1: Initial Analysis
Think through the question carefully. What aspects need research? What sources would be authoritative?

### Step 2: Comprehensive Web Search
- Conduct MULTIPLE searches to cover different angles
- Search for recent news, official sources, academic papers, industry reports
- Cross-reference information from multiple sources
- Look for both Canadian/BC-specific and global context

### Step 3: Deep Analysis
- Synthesize findings from all sources
- Identify patterns, trends, and key insights
- Note any contradictions or uncertainties
- Provide balanced perspective with evidence

### Step 4: Structured Response
Provide a comprehensive report with:
- Executive Summary
- Key Findings (with citations)
- Detailed Analysis
- Data & Statistics
- Implications & Recommendations
- Sources Used

## Guidelines
- Be thorough - don't stop at first result
- Always cite sources with [1], [2], etc.
- Distinguish facts from speculation
- Include specific numbers, dates, and quotes
- If information is outdated or uncertain, say so

IMPORTANT: Think out loud. Share your reasoning process as you research. This helps the user understand your methodology.`;

// Fetch uploaded documents for context
async function getDocumentContext(): Promise<string> {
  try {
    const documents = await prisma.uploadedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 10, // Limit to most recent 10 documents
      select: {
        filename: true,
        summary: true,
        content: true,
        category: true,
      },
    });

    if (documents.length === 0) {
      return "";
    }

    let context = "\n\n[UPLOADED DOCUMENTS CONTEXT]\n";
    context += `You have access to ${documents.length} uploaded document(s) that may be relevant:\n\n`;

    for (const doc of documents) {
      context += `--- Document: ${doc.filename} ---\n`;
      if (doc.category) {
        context += `Category: ${doc.category}\n`;
      }
      if (doc.summary) {
        context += `Summary: ${doc.summary}\n`;
      }
      if (doc.content) {
        // Include first 5000 chars of content for context
        const truncatedContent = doc.content.substring(0, 5000);
        context += `Content Preview:\n${truncatedContent}${doc.content.length > 5000 ? '\n[... content truncated ...]' : ''}\n`;
      }
      context += "\n";
    }

    return context;
  } catch (error) {
    console.error("Error fetching document context:", error);
    return "";
  }
}

// Helper to build data context from database
async function buildDataContext(query: string): Promise<string> {
  let context = "";
  const lowerQuery = query.toLowerCase();

  try {
    const communityCount = await prisma.community.count();
    const projectCount = await prisma.majorProject.count();
    
    context += `\n\n[DATABASE CONTEXT]`;
    context += `\nTotal BC Communities: ${communityCount}`;
    context += `\nTotal Major Projects: ${projectCount}`;

    // Community-specific queries
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
          context += `\n\n[${community.orgName} EMISSIONS DATA]`;
          context += `\n- Total Emissions: ${community.totalEmissions.toLocaleString()} TCO2e`;
          context += `\n- Residential: ${community.resEmissions.toLocaleString()} TCO2e`;
          context += `\n- Commercial/Industrial: ${community.csmiEmissions.toLocaleString()} TCO2e`;
          context += `\n- Total Connections: ${community.totalConnections.toLocaleString()}`;
          context += `\n- Electric Emissions: ${community.electricEmissions.toLocaleString()} TCO2e`;
          context += `\n- Gas Emissions: ${community.gasEmissions.toLocaleString()} TCO2e`;
        }
        break;
      }
    }

    // Top emissions queries
    if (lowerQuery.includes("top") || lowerQuery.includes("highest") || lowerQuery.includes("largest")) {
      const topCommunities = await prisma.community.findMany({
        orderBy: { totalEmissions: "desc" },
        take: 10,
      });
      context += `\n\n[TOP 10 BC COMMUNITIES BY EMISSIONS]`;
      topCommunities.forEach((c: any, i: number) => {
        context += `\n${i + 1}. ${c.orgName}: ${c.totalEmissions.toLocaleString()} TCO2e`;
      });
    }

    // Project queries - include actual project data
    if (lowerQuery.includes("project") || lowerQuery.includes("construction") || lowerQuery.includes("development") || 
        lowerQuery.includes("major") || lowerQuery.includes("$") || lowerQuery.includes("million") || 
        lowerQuery.includes("billion") || lowerQuery.includes("developer") || lowerQuery.includes("build")) {
      
      const projectStats = await prisma.majorProject.aggregate({
        _sum: { estimatedCost: true },
        _count: true,
      });
      
      context += `\n\n[BC MAJOR PROJECTS STATISTICS]`;
      context += `\n- Total Projects: ${projectStats._count}`;
      context += `\n- Total Value: $${((projectStats._sum.estimatedCost || 0) / 1000).toFixed(1)}B`;

      // Determine sorting and filtering based on query
      let orderBy: any = { estimatedCost: "desc" };
      let whereClause: any = {};
      let limit = 50;

      // Check for cost filters
      if (lowerQuery.includes(">$20m") || lowerQuery.includes("> $20m") || lowerQuery.includes("over $20") || lowerQuery.includes("above $20")) {
        whereClause.estimatedCost = { gte: 20 };
      } else if (lowerQuery.includes(">$100m") || lowerQuery.includes("> $100m") || lowerQuery.includes("over $100") || lowerQuery.includes("above $100")) {
        whereClause.estimatedCost = { gte: 100 };
      } else if (lowerQuery.includes(">$1b") || lowerQuery.includes("> $1b") || lowerQuery.includes("billion") || lowerQuery.includes("over $1000")) {
        whereClause.estimatedCost = { gte: 1000 };
      }

      // Check for status filters
      if (lowerQuery.includes("construction started") || lowerQuery.includes("under construction") || lowerQuery.includes("in progress")) {
        whereClause.projectStatus = { contains: "Construction started" };
      } else if (lowerQuery.includes("proposed") || lowerQuery.includes("planning")) {
        whereClause.projectStatus = { contains: "Proposed" };
      } else if (lowerQuery.includes("completed") || lowerQuery.includes("finished")) {
        whereClause.projectStatus = { contains: "Completed" };
      }

      // Check for type filters
      if (lowerQuery.includes("residential") || lowerQuery.includes("housing") || lowerQuery.includes("home")) {
        whereClause.constructionType = { contains: "Residential" };
      } else if (lowerQuery.includes("commercial") || lowerQuery.includes("office") || lowerQuery.includes("retail")) {
        whereClause.constructionType = { contains: "Commercial" };
      } else if (lowerQuery.includes("industrial") || lowerQuery.includes("manufacturing") || lowerQuery.includes("warehouse")) {
        whereClause.constructionType = { contains: "Industrial" };
      } else if (lowerQuery.includes("infrastructure") || lowerQuery.includes("utility") || lowerQuery.includes("lng") || lowerQuery.includes("energy")) {
        whereClause.constructionType = { contains: "Infrastructure" };
      } else if (lowerQuery.includes("institutional") || lowerQuery.includes("hospital") || lowerQuery.includes("school") || lowerQuery.includes("university")) {
        whereClause.constructionType = { contains: "Institutional" };
      }

      // Check for region/location filters
      const regionKeywords = ["metro vancouver", "vancouver", "lower mainland", "victoria", "island", "interior", "northern", "okanagan", "fraser valley"];
      for (const region of regionKeywords) {
        if (lowerQuery.includes(region)) {
          whereClause.OR = [
            { region: { contains: region } },
            { municipality: { contains: region } },
          ];
          break;
        }
      }

      // Fetch actual project records
      const projects = await prisma.majorProject.findMany({
        where: whereClause,
        orderBy,
        take: limit,
        select: {
          name: true,
          estimatedCost: true,
          municipality: true,
          region: true,
          developer: true,
          constructionType: true,
          projectStatus: true,
          projectType: true,
          description: true,
          greenBuilding: true,
          cleanEnergy: true,
        },
      });

      if (projects.length > 0) {
        context += `\n\n[BC MAJOR PROJECTS DATA - ${projects.length} projects matching your query]`;
        context += `\n\n| Project Name | Location | Developer | Type | Status | Value ($M) |`;
        context += `\n|--------------|----------|-----------|------|--------|------------|`;
        
        for (const p of projects) {
          const location = p.municipality || p.region || "BC";
          const developer = p.developer || "N/A";
          const type = p.constructionType || p.projectType || "N/A";
          const status = p.projectStatus || "N/A";
          const value = p.estimatedCost ? `$${p.estimatedCost.toLocaleString()}M` : "N/A";
          const name = p.name.length > 50 ? p.name.substring(0, 47) + "..." : p.name;
          
          context += `\n| ${name} | ${location} | ${developer.substring(0, 20)} | ${type} | ${status} | ${value} |`;
        }

        // Add summary by type
        const byType = projects.reduce((acc: any, p) => {
          const type = p.constructionType || "Other";
          if (!acc[type]) acc[type] = { count: 0, value: 0 };
          acc[type].count++;
          acc[type].value += p.estimatedCost || 0;
          return acc;
        }, {});

        context += `\n\n[SUMMARY BY CONSTRUCTION TYPE]`;
        for (const [type, stats] of Object.entries(byType) as any) {
          context += `\n- ${type}: ${stats.count} projects, $${stats.value.toLocaleString()}M total`;
        }

        // Add green building info if relevant
        const greenProjects = projects.filter(p => p.greenBuilding || p.cleanEnergy);
        if (greenProjects.length > 0) {
          context += `\n\n[GREEN/CLEAN ENERGY PROJECTS: ${greenProjects.length}]`;
          for (const p of greenProjects.slice(0, 10)) {
            context += `\n- ${p.name}: $${p.estimatedCost?.toLocaleString() || 'N/A'}M`;
          }
        }
      }
    }

    // Opportunities/leads queries
    if (lowerQuery.includes("opportunit") || lowerQuery.includes("lead") || lowerQuery.includes("potential")) {
      const opportunities = await prisma.community.findMany({
        where: { gasEmissions: { gt: 10000 } },
        orderBy: { gasEmissions: "desc" },
        take: 10,
      });
      context += `\n\n[HIGH-POTENTIAL HVAC CONVERSION OPPORTUNITIES]`;
      opportunities.forEach((c: any, i: number) => {
        context += `\n${i + 1}. ${c.orgName}: ${c.gasEmissions.toLocaleString()} TCO2e gas, ${c.totalConnections.toLocaleString()} connections`;
      });
    }

    // Heat pump / HVAC specific queries
    if (lowerQuery.includes("heat pump") || lowerQuery.includes("hvac") || lowerQuery.includes("heating") || 
        lowerQuery.includes("cooling") || lowerQuery.includes("inclined") || lowerQuery.includes("suitable")) {
      
      // Projects that might need HVAC - residential and commercial with good budgets
      const hvacProjects = await prisma.majorProject.findMany({
        where: {
          OR: [
            { constructionType: { contains: "Residential" } },
            { constructionType: { contains: "Commercial" } },
            { constructionType: { contains: "Institutional" } },
          ],
          estimatedCost: { gte: 10 }, // $10M+
          projectStatus: { in: ["Proposed", "Construction started"] },
        },
        orderBy: { estimatedCost: "desc" },
        take: 30,
        select: {
          name: true,
          estimatedCost: true,
          municipality: true,
          region: true,
          developer: true,
          constructionType: true,
          projectStatus: true,
          greenBuilding: true,
          cleanEnergy: true,
        },
      });

      if (hvacProjects.length > 0) {
        context += `\n\n[PROJECTS SUITABLE FOR HEAT PUMP / HVAC SYSTEMS - ${hvacProjects.length} projects]`;
        context += `\nThese are active residential, commercial, and institutional projects that would benefit from modern HVAC systems:\n`;
        context += `\n| Project Name | Location | Developer | Type | Status | Value ($M) | Green |`;
        context += `\n|--------------|----------|-----------|------|--------|------------|-------|`;
        
        for (const p of hvacProjects) {
          const location = p.municipality || p.region || "BC";
          const developer = p.developer ? p.developer.substring(0, 20) : "N/A";
          const isGreen = p.greenBuilding || p.cleanEnergy ? "Yes" : "No";
          const name = p.name.length > 40 ? p.name.substring(0, 37) + "..." : p.name;
          
          context += `\n| ${name} | ${location} | ${developer} | ${p.constructionType} | ${p.projectStatus} | $${p.estimatedCost?.toLocaleString() || 'N/A'}M | ${isGreen} |`;
        }
      }
    }

    // Developer-specific queries
    if (lowerQuery.includes("developer") || lowerQuery.includes("company") || lowerQuery.includes("firm") || lowerQuery.includes("who")) {
      const topDevelopers = await prisma.majorProject.groupBy({
        by: ["developer"],
        _count: true,
        _sum: { estimatedCost: true },
        orderBy: { _sum: { estimatedCost: "desc" } },
        take: 20,
        where: { developer: { not: null } },
      });

      if (topDevelopers.length > 0) {
        context += `\n\n[TOP DEVELOPERS BY PROJECT VALUE]`;
        context += `\n| Developer | Projects | Total Value |`;
        context += `\n|-----------|----------|-------------|`;
        
        for (const d of topDevelopers) {
          if (d.developer) {
            const value = d._sum.estimatedCost ? `$${(d._sum.estimatedCost / 1000).toFixed(1)}B` : "N/A";
            context += `\n| ${d.developer.substring(0, 40)} | ${d._count} | ${value} |`;
          }
        }
      }
    }

    // List all projects query (when user wants to see all or a table)
    if (lowerQuery.includes("list") || lowerQuery.includes("table") || lowerQuery.includes("all project") || lowerQuery.includes("show me")) {
      const allProjects = await prisma.majorProject.findMany({
        orderBy: { estimatedCost: "desc" },
        take: 100,
        select: {
          name: true,
          estimatedCost: true,
          municipality: true,
          region: true,
          developer: true,
          constructionType: true,
          projectStatus: true,
        },
      });

      if (allProjects.length > 0) {
        context += `\n\n[BC MAJOR PROJECTS LIST - Top ${allProjects.length} by value]`;
        context += `\n| # | Project Name | Location | Developer | Sector | Status | Value |`;
        context += `\n|---|--------------|----------|-----------|--------|--------|-------|`;
        
        allProjects.forEach((p, i) => {
          const location = p.municipality || p.region || "BC";
          const developer = p.developer ? p.developer.substring(0, 15) : "N/A";
          const name = p.name.length > 35 ? p.name.substring(0, 32) + "..." : p.name;
          const value = p.estimatedCost ? `$${p.estimatedCost.toLocaleString()}M` : "N/A";
          
          context += `\n| ${i + 1} | ${name} | ${location} | ${developer} | ${p.constructionType || 'N/A'} | ${p.projectStatus || 'N/A'} | ${value} |`;
        });
      }
    }

  } catch (error) {
    console.error("Error building context:", error);
    context += "\n[Error fetching database context]";
  }

  return context;
}

// Normalize image formats
function normalizeImageFormats(formats?: string[]): string[] | undefined {
  if (!formats) return undefined;
  const validFormats = new Set(["bmp", "gif", "jpeg", "png", "webp", "svg"]);
  return formats
    .map((f) => (f.toLowerCase() === "jpg" ? "jpeg" : f.toLowerCase()))
    .filter((f) => validFormats.has(f));
}

// Retry with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
}

interface ApiResult {
  success: boolean;
  content?: string;
  thinking?: string;
  citations?: string[];
  images?: string[];
  id?: string;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  error?: string;
}

// Agentic Research API call (supports GPT-5.2)
async function callAgenticAPI(
  apiKey: string,
  userInput: string,
  systemInstructions: string,
  options: {
    model?: string;
    returnImages?: boolean;
    researchMode?: boolean;
  } = {}
): Promise<ApiResult> {
  const { model = "openai/gpt-5.2", returnImages = false, researchMode = false } = options;

  try {
    console.log(`Trying Agentic API (${model})${researchMode ? ' [RESEARCH MODE]' : ''}...`);

    const requestBody: any = {
      model,
      input: userInput,
      instructions: systemInstructions,
      tools: [{ type: "web_search" }],
      max_output_tokens: MAX_OUTPUT_TOKENS,
    };

    // Enable reasoning for research mode to get thinking process
    if (researchMode) {
      requestBody.reasoning = { effort: "high" };
    }

    if (returnImages) {
      requestBody.return_images = true;
    }

    const response = await fetchWithRetry(
      PERPLEXITY_RESPONSES_API,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      2
    );

    if (response.ok) {
      const data = await response.json();
      
      // Extract text content and thinking/reasoning
      let content = data.output_text || "";
      let thinking = "";
      
      if (data.output && Array.isArray(data.output)) {
        for (const item of data.output) {
          // Extract reasoning/thinking content
          if (item.type === "reasoning" && item.content) {
            if (Array.isArray(item.content)) {
              for (const c of item.content) {
                if (c.type === "thinking" && c.thinking) {
                  thinking += c.thinking + "\n";
                }
              }
            } else if (typeof item.content === "string") {
              thinking += item.content + "\n";
            }
          }
          
          // Extract output text
          if (item.content && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === "output_text" && c.text) {
                content += c.text;
              }
            }
          }
        }
      }

      // Extract citations
      const citations: string[] = [];
      if (data.output && Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.content && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.annotations && Array.isArray(c.annotations)) {
                for (const a of c.annotations) {
                  if (a.type === "citation" && a.url) {
                    citations.push(a.url);
                  }
                }
              }
            }
          }
        }
      }

      // Parse images
      let images: string[] = [];
      if (data.images && Array.isArray(data.images)) {
        images = data.images.map((img: any) => {
          if (typeof img === 'string') return img;
          if (img && typeof img === 'object') return img.image_url || img.url || '';
          return '';
        }).filter((url: string) => url && url.startsWith('http'));
      }

      // Extract thinking from <think> tags if present
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/gi);
      if (thinkMatch) {
        for (const match of thinkMatch) {
          const thinkContent = match.replace(/<\/?think>/gi, '').trim();
          if (thinkContent) {
            thinking += thinkContent + "\n";
          }
        }
      }
      
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const usage = data.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      
      console.log(`✓ Agentic API (${model}) succeeded - tokens: ${usage.total_tokens}${thinking ? ' [with thinking]' : ''}`);

      return {
        success: true,
        content,
        thinking: thinking.trim() || undefined,
        citations: [...new Set(citations)],
        images,
        id: data.id,
        model,
        usage,
      };
    }

    const errorText = await response.text();
    console.error(`✗ Agentic API (${model}) failed: ${response.status}`, errorText.slice(0, 200));
    return { success: false, error: `${model}: ${response.status}` };

  } catch (error: any) {
    console.error(`✗ Agentic API (${model}) exception:`, error.message);
    return { success: false, error: `${model}: ${error.message}` };
  }
}

// Chat Completions API call (fallback)
async function callChatAPI(
  apiKey: string,
  messages: any[],
  systemPrompt: string,
  options: {
    model?: string;
    returnImages?: boolean;
    imageDomainFilter?: string[];
    imageFormatFilter?: string[];
    researchMode?: boolean;
  } = {}
): Promise<ApiResult> {
  const { model = "sonar-pro", returnImages = false, imageDomainFilter, imageFormatFilter, researchMode = false } = options;

  try {
    console.log(`Trying Chat API (${model})${researchMode ? ' [RESEARCH MODE]' : ''}...`);

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const requestBody: any = {
      model,
      messages: fullMessages,
      temperature: researchMode ? 0.3 : 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
      top_p: 0.9,
    };

    if (returnImages) {
      requestBody.return_images = true;
      if (imageDomainFilter) requestBody.image_domain_filter = imageDomainFilter.slice(0, 10);
      const normalizedFormats = normalizeImageFormats(imageFormatFilter);
      if (normalizedFormats?.length) requestBody.image_format_filter = normalizedFormats.slice(0, 10);
    }

    const response = await fetchWithRetry(
      PERPLEXITY_CHAT_API,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      2
    );

    if (response.ok) {
      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      let thinking = "";
      
      // Extract thinking from <think> tags
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/gi);
      if (thinkMatch) {
        for (const match of thinkMatch) {
          const thinkContent = match.replace(/<\/?think>/gi, '').trim();
          if (thinkContent) {
            thinking += thinkContent + "\n";
          }
        }
      }
      
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      let images: string[] = [];
      if (data.images && Array.isArray(data.images)) {
        images = data.images.map((img: any) => {
          if (typeof img === 'string') return img;
          if (img && typeof img === 'object') return img.image_url || img.url || '';
          return '';
        }).filter((url: string) => url && url.startsWith('http'));
      }

      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      console.log(`✓ Chat API (${model}) succeeded - tokens: ${usage.total_tokens || 0}${thinking ? ' [with thinking]' : ''}`);

      return {
        success: true,
        content,
        thinking: thinking.trim() || undefined,
        citations: data.citations || [],
        images,
        id: data.id,
        model,
        usage: {
          input_tokens: usage.prompt_tokens || 0,
          output_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        },
      };
    }

    const errorText = await response.text();
    console.error(`✗ Chat API (${model}) failed: ${response.status}`, errorText.slice(0, 200));
    return { success: false, error: `${model}: ${response.status}` };

  } catch (error: any) {
    console.error(`✗ Chat API (${model}) exception:`, error.message);
    return { success: false, error: `${model}: ${error.message}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      messages, 
      model: requestedModel,
      return_images = false,
      image_domain_filter,
      image_format_filter,
      skipContext = false,
      customSystemPrompt,
      files,
      researchMode = false,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Perplexity API key not configured" },
        { status: 500 }
      );
    }

    // Get user query and build context
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
    const userQuery = lastUserMessage?.content || "";
    
    // Build context from database and uploaded documents
    const dataContext = skipContext ? "" : await buildDataContext(userQuery);
    const documentContext = await getDocumentContext();
    const fullUserInput = `${userQuery}${dataContext}${documentContext}`;
    
    // Use research instructions if research mode is enabled
    const systemPrompt = researchMode 
      ? RESEARCH_INSTRUCTIONS 
      : (customSystemPrompt || SYSTEM_INSTRUCTIONS);
    
    console.log(`Processing request: researchMode=${researchMode}, model=${requestedModel || 'default'}, docs=${documentContext ? 'yes' : 'no'}`);

    // Determine model fallback chain based on requested model
    // Agentic API models (OpenAI, Anthropic, Google)
    const agenticModelIds = [
      "openai/gpt-5.2", "openai/gpt-5.1", "openai/gpt-5-mini",
      "anthropic/claude-sonnet-4-5", "anthropic/claude-haiku-4-5",
      "google/gemini-3-pro", "google/gemini-3-flash", "google/gemini-2.5-pro"
    ];
    // Chat API models (Perplexity native)
    const chatModelIds = ["sonar-reasoning-pro", "sonar-pro", "sonar"];

    // Build model chains based on requested model
    let agenticModels: string[] = [];
    let chatModels: string[] = [];

    if (requestedModel) {
      if (agenticModelIds.includes(requestedModel)) {
        // User selected an Agentic model - put it first, then add fallbacks
        agenticModels = [requestedModel, ...agenticModelIds.filter(m => m !== requestedModel)];
        chatModels = chatModelIds;
      } else if (chatModelIds.includes(requestedModel)) {
        // User selected a Chat model - skip Agentic entirely
        agenticModels = [];
        chatModels = [requestedModel, ...chatModelIds.filter(m => m !== requestedModel)];
      } else {
        // Unknown model, use defaults
        agenticModels = ["openai/gpt-5.2", "openai/gpt-5.1"];
        chatModels = ["sonar-pro", "sonar"];
      }
    } else {
      // No model specified, use defaults
      agenticModels = ["openai/gpt-5.2", "openai/gpt-5.1"];
      chatModels = ["sonar-pro", "sonar"];
    }

    let result: ApiResult = { success: false };

    // Try Agentic API first (GPT-5.2)
    for (const model of agenticModels) {
      result = await callAgenticAPI(apiKey, fullUserInput, systemPrompt, {
        model,
        returnImages: return_images,
        researchMode,
      });
      if (result.success) break;
    }

    // Fallback to Chat API
    if (!result.success) {
      const chatMessages = [
        ...messages.slice(0, -1),
        { role: "user", content: fullUserInput },
      ];
      
      for (const model of chatModels) {
        result = await callChatAPI(apiKey, chatMessages, systemPrompt, {
          model,
          returnImages: return_images,
          imageDomainFilter: image_domain_filter,
          imageFormatFilter: image_format_filter,
          researchMode,
        });
        if (result.success) break;
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { error: `All models failed. Last error: ${result.error}` },
        { status: 500 }
      );
    }

    // Save to database
    try {
      let conversation = await prisma.conversation.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation || messages.length <= 1) {
        conversation = await prisma.conversation.create({
          data: { title: userQuery.substring(0, 50) || "New Conversation" },
        });
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: userQuery,
        },
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: result.content || "",
        },
      });
    } catch (dbError) {
      console.error("Database save error:", dbError);
    }

    // Calculate cost (per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      "openai/gpt-5.2": { input: 1.75, output: 14 },
      "openai/gpt-5.1": { input: 1.25, output: 10 },
      "openai/gpt-5-mini": { input: 0.25, output: 2 },
      "anthropic/claude-sonnet-4-5": { input: 3, output: 15 },
      "anthropic/claude-haiku-4-5": { input: 1, output: 5 },
      "google/gemini-3-pro": { input: 1.5, output: 6 },
      "google/gemini-3-flash": { input: 0.5, output: 2 },
      "google/gemini-2.5-pro": { input: 1.25, output: 5 },
      "sonar-reasoning-pro": { input: 1, output: 4 },
      "sonar-pro": { input: 0.5, output: 1 },
      "sonar": { input: 0.2, output: 0.2 },
    };

    let costEstimate = 0;
    if (result.usage && result.model && pricing[result.model]) {
      const p = pricing[result.model];
      costEstimate = (result.usage.input_tokens * p.input + result.usage.output_tokens * p.output) / 1_000_000;
    }

    return NextResponse.json({
      id: result.id || `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.content,
          },
          finish_reason: "stop",
        },
      ],
      thinking: result.thinking || null,
      citations: result.citations || [],
      images: result.images || [],
      usage: result.usage,
      costEstimate: `$${costEstimate.toFixed(4)}`,
      researchMode,
    });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
