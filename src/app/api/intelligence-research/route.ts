import { NextRequest, NextResponse } from "next/server";

// Perplexity API Endpoints
// Chat Completions API: https://docs.perplexity.ai/docs/grounded-llm/chat-completions/quickstart
const PERPLEXITY_CHAT_API = "https://api.perplexity.ai/chat/completions";
// Agentic Research API: https://docs.perplexity.ai/docs/grounded-llm/responses/quickstart
const PERPLEXITY_RESPONSES_API = "https://api.perplexity.ai/v1/responses";

const INTELLIGENCE_INSTRUCTIONS = `You are a competitive intelligence analyst specializing in the HVAC industry with a Canada-first mandate.

GUIDELINES:
1. Prioritize Canada and BC information; only use global data if Canada-specific unavailable
2. If no Canada data found, explicitly state "No Canada-specific data found"
3. Include specific facts, figures, and dates
4. Structure with clear headings and bullet points
5. Focus on 2025-2026 developments

FORMAT:
## Executive Summary
Brief 2-3 sentence overview

## Key Findings
- Main discoveries

## Detailed Analysis
Organized sections

## Canada/BC Implications
Specific Canadian market relevance`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, return_images = false, image_domain_filter, image_format_filter } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Perplexity API key not configured" }, { status: 500 });
    }

    const userMessage = messages.find((m: any) => m.role === "user")?.content || "";

    // Try Chat Completions API first (more widely available)
    let result = await tryChatAPI(apiKey, messages, return_images, image_domain_filter, image_format_filter);
    
    // If Chat fails, try Agentic Research API (GPT-5.2)
    if (!result.success) {
      console.log("Chat API failed, trying Agentic Research API...");
      result = await tryAgenticAPI(apiKey, userMessage);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "All APIs failed" }, { status: 500 });
    }

    return NextResponse.json({
      id: result.id || `intel-${Date.now()}`,
      content: result.content,
      citations: result.citations || [],
      images: result.images || [],
      isMarkdown: !result.content?.startsWith("{"),
      model: result.model,
    });
  } catch (error: any) {
    console.error("Intelligence API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

interface ApiResult {
  success: boolean;
  content?: string;
  citations?: string[];
  images?: string[];
  id?: string;
  model?: string;
  error?: string;
}

// Normalize image format filters - Perplexity only accepts: bmp, gif, jpeg, png, webp, svg
function normalizeImageFormats(formats?: string[]): string[] | undefined {
  if (!formats) return undefined;
  const validFormats = new Set(["bmp", "gif", "jpeg", "png", "webp", "svg"]);
  return formats
    .map((f) => (f.toLowerCase() === "jpg" ? "jpeg" : f.toLowerCase()))
    .filter((f) => validFormats.has(f));
}

// Chat Completions API (primary - supports images)
async function tryChatAPI(
  apiKey: string,
  messages: any[],
  returnImages: boolean,
  imageDomainFilter?: string[],
  imageFormatFilter?: string[]
): Promise<ApiResult> {
  const models = ["sonar-pro", "sonar"];
  
  for (const model of models) {
    try {
      const fullMessages = [{ role: "system", content: INTELLIGENCE_INSTRUCTIONS }, ...messages];
      const requestBody: any = { 
        model, 
        messages: fullMessages, 
        temperature: 0.7, 
        max_tokens: 8000, 
        top_p: 0.9 
      };

      if (returnImages) {
        requestBody.return_images = true;
        if (imageDomainFilter) requestBody.image_domain_filter = imageDomainFilter.slice(0, 10);
        const normalizedFormats = normalizeImageFormats(imageFormatFilter);
        if (normalizedFormats && normalizedFormats.length > 0) {
          requestBody.image_format_filter = normalizedFormats.slice(0, 10);
        }
      }

      console.log(`Trying Chat API (${model})...`);
      const response = await fetch(PERPLEXITY_CHAT_API, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${apiKey}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "";
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        
        // Parse images - Perplexity returns images in various formats
        let images: string[] = [];
        if (data.images) {
          console.log("Raw images response:", JSON.stringify(data.images).slice(0, 500));
          if (Array.isArray(data.images)) {
            images = data.images.map((img: any) => {
              if (typeof img === 'string') return img;
              if (img && typeof img === 'object') {
                return img.url || img.src || img.image_url || img.href || '';
              }
              return '';
            }).filter((url: string) => url && url.startsWith('http'));
          }
        }
        
        console.log(`Chat API (${model}) succeeded, images found:`, images.length, images.slice(0, 2));
        return { 
          success: true, 
          content, 
          citations: data.citations || [], 
          images, 
          id: data.id, 
          model 
        };
      }
      
      const errText = await response.text();
      console.error(`Chat ${model} failed:`, response.status, errText);
    } catch (e: any) {
      console.error(`Chat ${model} exception:`, e.message);
    }
  }
  return { success: false, error: "All chat models failed" };
}

// Agentic Research API (fallback - GPT-5.2 with web search)
async function tryAgenticAPI(apiKey: string, query: string): Promise<ApiResult> {
  try {
    const requestBody = {
      model: "openai/gpt-5.2",
      input: query,
      instructions: INTELLIGENCE_INSTRUCTIONS,
      tools: [{ type: "web_search" }],
      reasoning: { effort: "high" },
      max_output_tokens: 8000,
    };

    console.log("Trying Agentic API (GPT-5.2)...");
    const response = await fetch(PERPLEXITY_RESPONSES_API, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Agentic API error:", response.status, err);
      return { success: false, error: `Agentic ${response.status}` };
    }

    const data = await response.json();
    let content = data.output_text || "";
    
    // Extract from output array if output_text not present
    if (!content && data.output) {
      for (const item of data.output) {
        if (item.content) {
          for (const c of item.content) {
            if (c.type === "output_text" && c.text) content += c.text;
          }
        }
      }
    }

    // Extract citations
    const citations: string[] = [];
    if (data.output) {
      for (const item of data.output) {
        if (item.content) {
          for (const c of item.content) {
            if (c.annotations) {
              for (const a of c.annotations) {
                if (a.type === "citation" && a.url) citations.push(a.url);
              }
            }
          }
        }
      }
    }

    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!content) return { success: false, error: "Empty agentic response" };

    console.log("Agentic API succeeded");
    return { 
      success: true, 
      content, 
      citations: [...new Set(citations)], 
      images: [], 
      id: data.id, 
      model: "gpt-5.2" 
    };
  } catch (e: any) {
    console.error("Agentic exception:", e.message);
    return { success: false, error: e.message };
  }
}
