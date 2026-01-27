import { NextRequest, NextResponse } from "next/server";

// Perplexity API configuration for Intelligence Research
// Uses HIGHER temperature for comprehensive, creative research results
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

const INTELLIGENCE_SYSTEM_PROMPT = `You are a competitive intelligence analyst specializing in the HVAC industry. Your role is to provide comprehensive, well-researched analysis of companies, market trends, and industry developments.

IMPORTANT RESPONSE GUIDELINES:
1. Provide detailed, actionable intelligence
2. Include specific facts, figures, and dates when available
3. Cite sources with [1], [2], etc. notation
4. Structure your response with clear headings and bullet points
5. Focus on recent developments (2025-2026)
6. Be thorough - include all relevant information found

You may respond in either:
- Well-structured Markdown (preferred for detailed analysis)
- JSON format if specifically requested

Always prioritize accuracy and comprehensiveness over brevity.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      messages,
      returnJson = false, // Set to true if caller wants JSON
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Perplexity API key not configured" },
        { status: 500 }
      );
    }

    // Prepare messages with intelligence-focused system prompt
    const fullMessages = [
      { role: "system", content: INTELLIGENCE_SYSTEM_PROMPT },
      ...messages,
    ];

    // Higher temperature for comprehensive research (more creative/thorough)
    const requestBody = {
      model: "sonar-reasoning-pro",
      messages: fullMessages,
      temperature: 0.7, // Higher for comprehensive research
      max_tokens: 8000, // More tokens for detailed responses
      top_p: 0.9, // Allow more diverse responses
    };

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Intelligence API error:", errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip <think> tags from reasoning model
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    content = content.replace(/<think>[\s\S]*/gi, '');
    content = content.trim();

    // Return response
    return NextResponse.json({
      id: data.id || `intel-${Date.now()}`,
      content: content,
      citations: data.citations || [],
      isMarkdown: !content.startsWith('{'), // Flag if response is markdown
    });

  } catch (error: any) {
    console.error("Intelligence Research API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

