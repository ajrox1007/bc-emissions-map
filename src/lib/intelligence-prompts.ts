// Competitive Intelligence Prompt Templates
// These prompts are designed for Perplexity Sonar Reasoning Pro API

export type ResearchCategory = 
  | "product_strategy"
  | "market_trends"
  | "competitive_positioning"
  | "customer_pain_points"
  | "market_gaps"
  | "financial_performance"
  | "regulatory"
  | "partnerships_ma"
  | "sales_marketing"
  | "technology_roadmap";

export type ResearchCadence = "daily" | "weekly" | "monthly";

export interface ResearchPrompt {
  id: ResearchCategory;
  name: string;
  description: string;
  cadence: ResearchCadence;
  template: string;
  variables: string[];
}

export const RESEARCH_PROMPTS: ResearchPrompt[] = [
  {
    id: "product_strategy",
    name: "Product & Strategy Tracking",
    description: "Recent announcements, product launches, and strategic moves",
    cadence: "daily",
    template: `Research {COMPETITOR_NAME}'s recent activities in the HVAC industry (2025-2026).

Provide a comprehensive analysis covering:
## Product Launches
- New products, models, or solutions released
- Key features and specifications
- Target markets

## Strategic Moves
- Pricing changes or service model shifts
- Market expansions or geographic focus
- Major announcements

## Technology & Partnerships
- Technology partnerships or integrations
- R&D developments
- Industry collaborations

Include specific dates, figures, and cite all sources with [1], [2] notation.`,
    variables: ["COMPETITOR_NAME"],
  },
  {
    id: "market_trends",
    name: "Market Trends & Innovation",
    description: "Emerging trends in HVAC market",
    cadence: "daily",
    template: `What are the top emerging trends in the HVAC market as of January 2026? Focus on:
- Energy efficiency innovations
- Smart controls and IoT integration
- Heat pump adoption rates
- AI-driven HVAC systems
- Regulatory changes impacting the industry

Which companies (Daikin, Carrier, Trane, Johnson Controls, AAON, Rheem, Mitsubishi Electric, LG Electronics) are leading in each area?

Return as JSON:
{
  "trends": [
    {
      "trend": "trend name",
      "description": "2-3 sentence description",
      "leaders": ["company1", "company2"],
      "importance": "high|medium|low",
      "source": "source"
    }
  ]
}`,
    variables: [],
  },
  {
    id: "competitive_positioning",
    name: "Competitive Positioning Analysis",
    description: "Compare market positioning between competitors",
    cadence: "weekly",
    template: `Compare the market positioning of {COMPETITOR_A}, {COMPETITOR_B}, and {COMPETITOR_C} in the HVAC sector. Analyze:
- Target customer segments
- Pricing strategies
- Key differentiators
- Geographic focus areas
- Customer satisfaction metrics or reviews

Return as JSON:
{
  "comparisons": [
    {
      "company": "company name",
      "targetSegments": ["segment1", "segment2"],
      "pricingStrategy": "description",
      "differentiators": ["diff1", "diff2"],
      "geographicFocus": ["region1", "region2"],
      "satisfactionScore": "if available",
      "source": "source"
    }
  ],
  "summary": "overall comparison summary"
}`,
    variables: ["COMPETITOR_A", "COMPETITOR_B", "COMPETITOR_C"],
  },
  {
    id: "customer_pain_points",
    name: "Customer Pain Points",
    description: "Common complaints and unmet needs",
    cadence: "weekly",
    template: `What are the most common complaints and unmet needs from HVAC customers (residential/commercial facility managers) in 2025-2026? Based on customer reviews, forum discussions, and industry feedback, what solutions are competitors NOT addressing well?

Return as JSON:
{
  "painPoints": [
    {
      "issue": "pain point",
      "segment": "residential|commercial",
      "frequency": "how common",
      "currentSolutions": "what competitors offer",
      "gaps": "what's missing",
      "opportunity": "potential solution",
      "source": "source"
    }
  ]
}`,
    variables: [],
  },
  {
    id: "market_gaps",
    name: "Market Gaps & Opportunities",
    description: "Underserved segments and market opportunities",
    cadence: "weekly",
    template: `Identify underserved segments or gaps in the North American HVAC market as of 2026. Where are smaller players or new entrants finding success that larger competitors are overlooking?

Return as JSON:
{
  "gaps": [
    {
      "segment": "segment name",
      "description": "description of gap",
      "currentPlayers": ["player1", "player2"],
      "opportunity": "opportunity description",
      "barriers": ["barrier1", "barrier2"],
      "importance": "high|medium|low",
      "source": "source"
    }
  ]
}`,
    variables: [],
  },
  {
    id: "financial_performance",
    name: "Financial & Performance Data",
    description: "Revenue, market share, and strategic direction",
    cadence: "monthly",
    template: `Provide recent financial performance, market share data, and strategic direction for {COMPANY_NAME} in the HVAC sector. Include specific numbers where available.

Return as JSON with NUMERIC values where possible:
{
  "company": "{COMPANY_NAME}",
  "financials": {
    "revenueUSD": 24500000000,
    "revenueBillions": "24.5B",
    "revenueGrowthPercent": 8.2,
    "marketSharePercent": 15,
    "grossMarginPercent": 28.5,
    "operatingMarginPercent": 12.3,
    "fiscalYear": "2025"
  },
  "segmentBreakdown": [
    {"segment": "Commercial HVAC", "revenuePercent": 45, "growth": 12},
    {"segment": "Residential HVAC", "revenuePercent": 30, "growth": -5},
    {"segment": "Aftermarket/Service", "revenuePercent": 25, "growth": 18}
  ],
  "quarterlyTrend": [
    {"quarter": "Q1 2025", "revenueBillions": 5.8, "growthPercent": 6},
    {"quarter": "Q2 2025", "revenueBillions": 6.2, "growthPercent": 9},
    {"quarter": "Q3 2025", "revenueBillions": 6.5, "growthPercent": 11},
    {"quarter": "Q4 2025", "revenueBillions": 6.0, "growthPercent": 7}
  ],
  "keyMetrics": [
    {"metric": "Backlog", "value": "$4.2B", "change": "+15%"},
    {"metric": "Free Cash Flow", "value": "$2.1B", "change": "+22%"},
    {"metric": "ROIC", "value": "18.5%", "change": "+2.1pp"}
  ],
  "recentActivity": [
    {
      "type": "acquisition|divestiture|investment",
      "description": "description",
      "value": "$500M",
      "date": "date",
      "source": "source"
    }
  ],
  "guidance": {
    "revenueGuidance": "5-7% growth",
    "marginGuidance": "expanding margins",
    "keyInitiatives": ["data centers", "aftermarket growth"]
  },
  "sources": ["url1", "url2"]
}`,
    variables: ["COMPANY_NAME"],
  },
  {
    id: "regulatory",
    name: "Regulatory & Compliance",
    description: "Regulatory changes affecting this competitor",
    cadence: "monthly",
    template: `What regulatory changes, tariffs, refrigerant restrictions, or energy code updates are most relevant to {COMPETITOR_NAME} and their business in 2025-2026? How is {COMPETITOR_NAME} specifically responding or positioned?

Focus on regulations that directly impact {COMPETITOR_NAME}'s:
- Product lines and offerings
- Geographic markets (especially BC/Canada if applicable)
- Competitive position

Return as JSON:
{
  "regulations": [
    {
      "regulation": "regulation name",
      "type": "tariff|refrigerant|energy_code|emissions",
      "effectiveDate": "date",
      "impact": "how this specifically affects {COMPETITOR_NAME}",
      "affectedProducts": ["product1", "product2"],
      "companyResponse": "how {COMPETITOR_NAME} is responding",
      "source": "source URL"
    }
  ],
  "noDataFound": false
}

If no specific regulatory information is found for {COMPETITOR_NAME}, indicate this clearly.`,
    variables: ["COMPETITOR_NAME"],
  },
  {
    id: "partnerships_ma",
    name: "Partnerships & M&A Activity",
    description: "Recent partnerships, joint ventures, and acquisitions",
    cadence: "weekly",
    template: `Search for any partnerships, joint ventures, acquisitions, or strategic alliances specifically involving {COMPETITOR_NAME} in the HVAC industry. Include:
- Any companies they have acquired or been acquired by
- Distribution agreements or manufacturer partnerships
- Joint ventures with other companies
- Strategic alliances or collaborations
- Any investment deals

If no specific partnerships are found for {COMPETITOR_NAME}, clearly state that no partnerships were found rather than listing unrelated industry news.

Return as JSON:
{
  "activities": [
    {
      "type": "acquisition|partnership|joint_venture|alliance|distribution",
      "parties": ["{COMPETITOR_NAME}", "partner company"],
      "description": "specific description of the deal involving {COMPETITOR_NAME}",
      "rationale": "why this happened",
      "value": "deal value if known",
      "date": "date",
      "source": "source URL"
    }
  ],
  "noDataFound": false
}

IMPORTANT: Only include partnerships that directly involve {COMPETITOR_NAME}. Do NOT include general HVAC industry M&A that does not involve this specific company.`,
    variables: ["COMPETITOR_NAME"],
  },
  {
    id: "sales_marketing",
    name: "Sales & Marketing Strategy",
    description: "Marketing approach and channel strategy",
    cadence: "daily",
    template: `Analyze {COMPETITOR_NAME}'s marketing and sales approach in 2025-2026:
- Key messaging and positioning
- Target audience segments
- Channel strategy (direct, distributors, contractors)
- Recent campaigns or partnerships
- Pricing or promotional strategy

Return as JSON:
{
  "company": "{COMPETITOR_NAME}",
  "messaging": "key marketing message",
  "positioning": "market positioning",
  "targetAudience": ["segment1", "segment2"],
  "channels": [
    {"channel": "name", "strategy": "approach"}
  ],
  "recentCampaigns": [
    {"campaign": "name", "description": "description", "date": "date"}
  ],
  "pricingStrategy": "description",
  "source": "source"
}`,
    variables: ["COMPETITOR_NAME"],
  },
  {
    id: "technology_roadmap",
    name: "Technology Roadmap",
    description: "Technology priorities and product roadmaps",
    cadence: "monthly",
    template: `What are the stated or rumored technology priorities and product roadmaps for {COMPANY_NAME} in HVAC? Focus on:
- AI or machine learning capabilities
- IoT/smart home integration
- Sustainability initiatives
- Next-generation product lines
- R&D focus areas

Return as JSON:
{
  "company": "{COMPANY_NAME}",
  "techPriorities": [
    {
      "area": "AI|IoT|sustainability|product",
      "initiative": "initiative name",
      "description": "description",
      "timeline": "expected timeline",
      "status": "announced|rumored|in_development",
      "source": "source"
    }
  ],
  "rdFocus": ["area1", "area2"],
  "source": "primary source"
}`,
    variables: ["COMPANY_NAME"],
  },
];

// Default competitors to track with domains for logo fetching
export const DEFAULT_COMPETITORS = [
  { name: "Johnson Barrows BC", type: "local", domain: "johnsonbarrows.com" },
  { name: "Master Group", type: "local", domain: "master.ca" },
  { name: "Riada Sales", type: "local", domain: "riadasales.com" },
  { name: "E.H. Price Solutions", type: "local", domain: "price-?"  },
  { name: "J&S Sales BC", type: "local", domain: "jssales.ca" },
  { name: "Engineered Air", type: "regional", domain: "?"  },
  { name: "Trane Technologies", type: "national", domain: "trane.com" },
  { name: "Mitsubishi Electric HVAC", type: "national", domain: "mitsubishicomfort.com" },
  { name: "LG Electronics HVAC", type: "national", domain: "lghvac.com" },
  { name: "Carrier", type: "national", domain: "carrier.com" },
  { name: "Daikin", type: "national", domain: "daikin.com" },
  { name: "Lennox", type: "national", domain: "lennox.com" },
  { name: "Johnson Controls", type: "national", domain: "johnsoncontrols.com" },
  { name: "Rheem", type: "national", domain: "rheem.com" },
  { name: "AAON", type: "national", domain: "aaon.com" },
];

// Company name to domain mapping for logo fetching
export const COMPANY_DOMAINS: Record<string, string> = {
  "carrier": "carrier.com",
  "daikin": "daikin.com",
  "trane": "trane.com",
  "lennox": "lennox.com",
  "johnson controls": "johnsoncontrols.com",
  "rheem": "rheem.com",
  "aaon": "aaon.com",
  "mitsubishi": "mitsubishicomfort.com",
  "mitsubishi electric": "mitsubishicomfort.com",
  "lg": "lg.com",
  "lg electronics": "lg.com",
  "engineered air": "?"  ,
  "master group": "master.ca",
  "modine": "modine.com",
  "schneider electric": "se.com",
  "bain capital": "baincapital.com",
  "goldman sachs": "goldmansachs.com",
};

// Get logo URL for a company
export function getCompanyLogo(companyName: string): string | null {
  const normalized = companyName.toLowerCase().trim();
  
  // Check exact match first
  if (COMPANY_DOMAINS[normalized]) {
    return `https://logo.clearbit.com/${COMPANY_DOMAINS[normalized]}`;
  }
  
  // Check partial match
  for (const [key, domain] of Object.entries(COMPANY_DOMAINS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return `https://logo.clearbit.com/${domain}`;
    }
  }
  
  // Try to construct domain from name
  const simpleName = normalized.replace(/\s+(hvac|industries|technologies|electric|electronics|group|bc|solutions)$/gi, '').trim();
  if (simpleName.length > 2) {
    return `https://logo.clearbit.com/${simpleName.replace(/\s+/g, '')}.com`;
  }
  
  return null;
}

// Get prompts by cadence
export function getPromptsByCadence(cadence: ResearchCadence): ResearchPrompt[] {
  return RESEARCH_PROMPTS.filter(p => p.cadence === cadence);
}

// Fill template with variables
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(variables)) {
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return filled;
}

// Get research schedule
export function getResearchSchedule() {
  return {
    daily: getPromptsByCadence("daily").map(p => p.name),
    weekly: getPromptsByCadence("weekly").map(p => p.name),
    monthly: getPromptsByCadence("monthly").map(p => p.name),
  };
}

