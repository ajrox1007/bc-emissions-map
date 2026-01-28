import { NextRequest, NextResponse } from "next/server";

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
 * Model Pricing (per 1M tokens):
 * - openai/gpt-5.2: $1.75 input, $14 output, $0.175 cache
 * - openai/gpt-5.1: $1.25 input, $10 output, $0.125 cache
 * - openai/gpt-5-mini: $0.25 input, $2 output, $0.025 cache
 * - anthropic/claude-sonnet-4-5: $3 input, $15 output
 * - google/gemini-2.5-pro: $1.25 input, $5 output
 */

// Agentic Research API endpoint (supports GPT-5.2)
const PERPLEXITY_RESPONSES_API = "https://api.perplexity.ai/v1/responses";

// Chat Completions API endpoint (fallback for sonar models)
const PERPLEXITY_CHAT_API = "https://api.perplexity.ai/chat/completions";

// System instructions for competitive intelligence
const INTELLIGENCE_INSTRUCTIONS = `You are an elite competitive intelligence analyst specializing in the HVAC industry with a Canada-first mandate. You have access to a web_search tool for real-time research.

## CRITICAL GUIDELINES

### Canada-First Priority
1. ALWAYS prioritize Canada and British Columbia specific information
2. Search for Canadian sources, regulatory bodies, and market data first
3. If no Canada-specific data exists, explicitly state "No Canada-specific data found" and explain implications for the Canadian market

### Research Quality Standards
1. Include specific facts, figures, dates, and financial metrics
2. Cite ALL sources with [1], [2], etc. notation
3. Focus on 2025-2026 developments
4. Cross-reference multiple sources for accuracy
5. Distinguish between confirmed facts and speculation

### HVAC Industry Focus
- Heat pumps (air-source, ground-source, water-to-air)
- Refrigerants (R-410A phase-out, R-454B adoption, CO2 systems)
- Energy efficiency standards (SEER2, HSPF2, COP)
- CleanBC regulations and rebates
- BC Step Code compliance
- Cold climate performance (-22°F to -30°F operation)

### Response Structure
Provide comprehensive analysis organized as:
## Executive Summary
Brief 2-3 sentence overview

## Key Findings
- Main discoveries with citations

## Detailed Analysis
Organized sections with specific facts

## Canada/BC Market Implications
Specific relevance to Canadian/BC markets

Use the web_search tool to find current information. Keep search queries brief (2-5 words). Search proactively - don't ask permission.`;

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
        console.log(`Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
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
  options: {
    model?: string;
    returnImages?: boolean;
    imageDomainFilter?: string[];
    imageFormatFilter?: string[];
  } = {}
): Promise<ApiResult> {
  const { 
    model = "openai/gpt-5.2", 
    returnImages = true,
    imageDomainFilter,
    imageFormatFilter 
  } = options;

  try {
    console.log(`Trying Agentic API (${model})...`);

    const requestBody: any = {
      model,
      input: userInput,
      instructions: INTELLIGENCE_INSTRUCTIONS,
      tools: [{ type: "web_search" }],
      max_output_tokens: 8000,
      reasoning: { effort: "high" },
    };

    // Add image retrieval
    if (returnImages) {
      requestBody.return_images = true;
      if (imageDomainFilter) {
        requestBody.image_domain_filter = imageDomainFilter.slice(0, 10);
      }
      const normalizedFormats = normalizeImageFormats(imageFormatFilter);
      if (normalizedFormats && normalizedFormats.length > 0) {
        requestBody.image_format_filter = normalizedFormats.slice(0, 10);
      }
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
      
      // Extract text from response.output_text or response.output array
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

      // Extract citations from annotations
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
          if (img && typeof img === 'object') {
            return img.image_url || img.url || img.src || '';
          }
          return '';
        }).filter((url: string) => url && url.startsWith('http'));
      }

      // Strip thinking tags
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      const usage = data.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      console.log(`✓ Agentic API (${model}) succeeded - tokens: ${usage.total_tokens}, images: ${images.length}`);

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
    return { success: false, error: `${model}: ${response.status} - ${errorText.slice(0, 100)}` };

  } catch (error: any) {
    console.error(`✗ Agentic API (${model}) exception:`, error.message);
    return { success: false, error: `${model}: ${error.message}` };
  }
}

// Chat Completions API call (fallback for sonar models)
async function callChatAPI(
  apiKey: string,
  messages: any[],
  options: {
    model?: string;
    returnImages?: boolean;
    imageDomainFilter?: string[];
    imageFormatFilter?: string[];
  } = {}
): Promise<ApiResult> {
  const { 
    model = "sonar-pro", 
    returnImages = true,
    imageDomainFilter,
    imageFormatFilter 
  } = options;

  try {
    console.log(`Trying Chat API (${model})...`);

    const fullMessages = [
      { role: "system", content: INTELLIGENCE_INSTRUCTIONS },
      ...messages
    ];

    const requestBody: any = {
      model,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 8000,
      top_p: 0.9,
    };

    if (returnImages) {
      requestBody.return_images = true;
      if (imageDomainFilter) {
        requestBody.image_domain_filter = imageDomainFilter.slice(0, 10);
      }
      const normalizedFormats = normalizeImageFormats(imageFormatFilter);
      if (normalizedFormats && normalizedFormats.length > 0) {
        requestBody.image_format_filter = normalizedFormats.slice(0, 10);
      }
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
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      // Parse images
      let images: string[] = [];
      if (data.images && Array.isArray(data.images)) {
        images = data.images.map((img: any) => {
          if (typeof img === 'string') return img;
          if (img && typeof img === 'object') {
            return img.image_url || img.url || img.src || '';
          }
          return '';
        }).filter((url: string) => url && url.startsWith('http'));
      }

      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      console.log(`✓ Chat API (${model}) succeeded - tokens: ${usage.total_tokens || 0}, images: ${images.length}`);

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

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      return_images = true,
      image_domain_filter,
      image_format_filter,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Perplexity API key not configured" }, { status: 500 });
    }

    // Extract user query for Agentic API
    const userMessage = messages.find((m: any) => m.role === "user")?.content || "";

    // Model fallback chain:
    // 1. Try Agentic API with GPT-5.2 (best reasoning + web search)
    // 2. Try Agentic API with GPT-5.1 (fallback)
    // 3. Try Chat API with sonar-pro (most reliable)
    // 4. Try Chat API with sonar (lightweight)

    const agenticModels = ["openai/gpt-5.2", "openai/gpt-5.1", "google/gemini-3-pro", "anthropic/claude-sonnet-4-5"];
    const chatModels = ["sonar-pro", "sonar"];

    let result: ApiResult = { success: false };

    // Try Agentic API first (GPT-5.2)
    for (const model of agenticModels) {
      result = await callAgenticAPI(apiKey, userMessage, {
        model,
        returnImages: return_images,
        imageDomainFilter: image_domain_filter,
        imageFormatFilter: image_format_filter,
      });
      if (result.success) break;
    }

    // Fallback to Chat API if Agentic fails
    if (!result.success) {
      for (const model of chatModels) {
        result = await callChatAPI(apiKey, messages, {
          model,
          returnImages: return_images,
          imageDomainFilter: image_domain_filter,
          imageFormatFilter: image_format_filter,
        });
        if (result.success) break;
      }
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "All APIs failed" }, { status: 500 });
    }

    // Calculate cost estimate (per 1M tokens)
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
      id: result.id || `intel-${Date.now()}`,
      content: result.content,
      citations: result.citations || [],
      images: result.images || [],
      isMarkdown: !result.content?.trim().startsWith("{"),
      model: result.model,
      usage: result.usage,
      costEstimate: `$${costEstimate.toFixed(4)}`,
    });

  } catch (error: any) {
    console.error("Intelligence API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
