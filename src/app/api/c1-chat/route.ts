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
 */

// Agentic Research API endpoint (supports GPT-5.2)
const PERPLEXITY_RESPONSES_API = "https://api.perplexity.ai/v1/responses";

// Chat Completions API endpoint (fallback for sonar models)
const PERPLEXITY_CHAT_API = "https://api.perplexity.ai/chat/completions";

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

## Response Guidelines

1. **Always cite specific data** when available from the provided context
2. **Use tables and structured formats** for data-heavy responses
3. **Provide actionable insights** for HVAC business decisions
4. **Be precise with numbers** - never hallucinate statistics
5. **Format responses** with clear headings, bullet points, and markdown
6. **Use web_search** for current market data, competitor info, or regulations

Use the web_search tool proactively when you need current information. Keep search queries brief (2-5 words). Don't ask permission to search - just search when needed.`;

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

    // Project queries
    if (lowerQuery.includes("project") || lowerQuery.includes("construction") || lowerQuery.includes("development")) {
      const projectStats = await prisma.majorProject.aggregate({
        _sum: { estimatedCost: true },
        _count: true,
      });
      
      context += `\n\n[BC MAJOR PROJECTS STATISTICS]`;
      context += `\n- Total Projects: ${projectStats._count}`;
      context += `\n- Total Value: $${((projectStats._sum.estimatedCost || 0) / 1000).toFixed(1)}B`;
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
  } = {}
): Promise<ApiResult> {
  const { model = "openai/gpt-5.2", returnImages = false } = options;

  try {
    console.log(`Trying Agentic API (${model})...`);

    const requestBody: any = {
      model,
      input: userInput,
      instructions: systemInstructions,
      tools: [{ type: "web_search" }],
      max_output_tokens: 6000,
    };

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
      
      // Extract text
      let content = data.output_text || "";
      if (!content && data.output && Array.isArray(data.output)) {
        for (const item of data.output) {
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

      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const usage = data.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      
      console.log(`✓ Agentic API (${model}) succeeded - tokens: ${usage.total_tokens}`);

      return {
        success: true,
        content,
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
  } = {}
): Promise<ApiResult> {
  const { model = "sonar-pro", returnImages = false, imageDomainFilter, imageFormatFilter } = options;

  try {
    console.log(`Trying Chat API (${model})...`);

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const requestBody: any = {
      model,
      messages: fullMessages,
      temperature: 0.2,
      max_tokens: 6000,
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
      console.log(`✓ Chat API (${model}) succeeded - tokens: ${usage.total_tokens || 0}`);

      return {
        success: true,
        content,
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
    const dataContext = skipContext ? "" : await buildDataContext(userQuery);
    const fullUserInput = dataContext ? `${userQuery}${dataContext}` : userQuery;
    const systemPrompt = customSystemPrompt || SYSTEM_INSTRUCTIONS;

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
      citations: result.citations || [],
      images: result.images || [],
      usage: result.usage,
      costEstimate: `$${costEstimate.toFixed(4)}`,
    });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
