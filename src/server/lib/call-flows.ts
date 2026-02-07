// Call flow logic for Twilio AI Phone Agent
// Defines intake schemas, AI prompts, and state management

export interface IntakeField {
  key: string;
  label: string;
  question: string;
  required: boolean;
}

export const DESIGN_INTAKE_FIELDS: IntakeField[] = [
  { key: "buildingType", label: "Building Type", question: "What type of building is this for? For example, residential home, office, warehouse, or retail space.", required: true },
  { key: "buildingSize", label: "Building Size", question: "What is the approximate size of the building in square feet?", required: true },
  { key: "location", label: "Location", question: "Where is the building located? City and province or full address if you have it.", required: true },
  { key: "projectGoals", label: "Project Goals", question: "What are your main goals for this project? For example, new construction, retrofit, energy efficiency upgrade, or switching to heat pumps.", required: true },
  { key: "timeline", label: "Timeline", question: "What is your target timeline for this project?", required: true },
  { key: "budget", label: "Budget Range", question: "Do you have an approximate budget range in mind for this project?", required: false },
  { key: "existingSystem", label: "Existing System", question: "What HVAC system is currently in place, if any?", required: false },
  { key: "specialRequirements", label: "Special Requirements", question: "Are there any special requirements we should know about? For example, noise restrictions, zoning constraints, or accessibility needs.", required: false },
];

export const SERVICE_INTAKE_FIELDS: IntakeField[] = [
  { key: "systemType", label: "System Type", question: "What type of HVAC system do you have? For example, heat pump, furnace, boiler, or rooftop unit.", required: true },
  { key: "systemAge", label: "System Age", question: "How old is the system, approximately?", required: true },
  { key: "symptoms", label: "Symptoms/Issue", question: "Can you describe the issue you're experiencing? Any unusual noises, smells, or performance problems?", required: true },
  { key: "urgency", label: "Urgency Level", question: "How urgent is this? Is it a complete breakdown, reduced performance, or a routine maintenance need?", required: true },
  { key: "location", label: "Location", question: "Where is the property located?", required: true },
  { key: "siteConstraints", label: "Site Constraints", question: "Are there any site access constraints we should know about?", required: false },
  { key: "makeModel", label: "Make and Model", question: "Do you know the make and model of the system?", required: false },
];

export const QUOTE_INTAKE_FIELDS: IntakeField[] = [
  { key: "projectScope", label: "Project Scope", question: "What are you looking for a quote on? New installation, replacement, or repair?", required: true },
  { key: "buildingType", label: "Building Type", question: "What type of building is this for?", required: true },
  { key: "buildingSize", label: "Building Size", question: "What is the approximate size of the space in square feet?", required: true },
  { key: "location", label: "Location", question: "Where is the property located?", required: true },
  { key: "existingSystem", label: "Existing System", question: "What system is currently in place, if any?", required: false },
  { key: "timeline", label: "Timeline", question: "When are you hoping to have this completed?", required: false },
  { key: "budget", label: "Budget Range", question: "Do you have a budget range in mind?", required: false },
];

export const GREETING_MESSAGE = "Thank you for calling Elevate Edge. I'm your AI assistant and I can help you with HVAC design consultations, service requests, quotes, and emergencies. How can I help you today?";

export function buildOutboundGreeting(callType?: string, callerName?: string): string {
  const name = callerName ? `, ${callerName}` : "";
  if (callType && callType !== "unknown") {
    const typeLabels: Record<string, string> = {
      design: "an HVAC design consultation",
      service: "your HVAC service request",
      quote: "your HVAC quote request",
      general: "your HVAC inquiry",
    };
    const label = typeLabels[callType] || "your HVAC inquiry";
    return `Hi${name}, this is Elevate Edge calling about ${label}. I'm an AI assistant and I'd like to collect some details to get you connected with the right specialist. Do you have a few minutes to go through some questions?`;
  }
  return `Hi${name}, this is Elevate Edge calling. I'm an AI assistant. I'd like to help you with your HVAC needs. Could you tell me what you're looking for — a design consultation, service, a quote, or something else?`;
}

export function getFieldsForCallType(callType: string): IntakeField[] {
  switch (callType) {
    case "design": return DESIGN_INTAKE_FIELDS;
    case "service": return SERVICE_INTAKE_FIELDS;
    case "quote": return QUOTE_INTAKE_FIELDS;
    default: return [];
  }
}

export function buildClassificationPrompt(callerSpeech: string): string {
  return `You are a phone intake classifier for an HVAC consulting company called Elevate Edge. Based on the caller's speech, classify their intent into exactly one category.

Categories:
- "design" - New HVAC system design, heat pump installation, building retrofit, new construction HVAC
- "service" - Repair, maintenance, troubleshooting an existing HVAC system
- "quote" - Requesting a price estimate or quote
- "emergency" - Gas leak, carbon monoxide, no heat in freezing conditions, fire/smoke from equipment
- "general" - General questions, not fitting above categories

Caller said: "${callerSpeech}"

Respond with ONLY a JSON object:
{"callType": "design|service|quote|emergency|general", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;
}

export function buildExtractionPrompt(
  callType: string,
  conversationHistory: { role: string; content: string }[],
  collectedData: Record<string, string>,
  fields: IntakeField[]
): string {
  const remainingFields = fields.filter(f => !collectedData[f.key]);
  const remainingRequired = remainingFields.filter(f => f.required);
  const allRequiredCollected = remainingRequired.length === 0;

  const historyText = conversationHistory
    .map(t => `${t.role === "agent" ? "Agent" : "Caller"}: ${t.content}`)
    .join("\n");

  const collectedText = Object.entries(collectedData)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n") || "None yet";

  const remainingText = remainingFields
    .map(f => `- ${f.key} (${f.required ? "required" : "optional"}): ${f.label}`)
    .join("\n") || "All fields collected";

  return `You are an AI phone agent for Elevate Edge, an HVAC consulting company. You are conducting a ${callType} intake call.

Your job:
1. Extract ALL relevant information from the caller's latest message
2. Determine the next question to ask
3. Keep responses conversational, warm, and under 3 sentences
4. If the caller provides information for multiple fields in one response, extract all of them
5. NEVER rush through the call — take your time and be thorough
6. Always ask about optional fields too, they help us serve the caller better

IMPORTANT RULES FOR ENDING THE CALL:
- Do NOT set isComplete to true until ALL of these conditions are met:
  1. All REQUIRED fields have been collected
  2. You have asked about at least some optional fields
  3. You have read back a brief summary of what was collected and asked the caller to confirm it is correct
  4. You have asked "Is there anything else I can help you with?"
  5. The caller has confirmed they have nothing else to add
- If ANY required field is still missing, isComplete MUST be false
- When in doubt, keep the conversation going — do NOT end early

Conversation so far:
${historyText}

Already collected:
${collectedText}

Still needed:
${remainingText}

${allRequiredCollected
    ? "All required fields have been collected. Now ask about remaining optional fields if any. Once those are addressed, read back a summary of the collected information to the caller and ask them to confirm. Only THEN ask if there's anything else. Only set isComplete to true after the caller confirms everything is correct and has nothing else to add."
    : "Required fields are still missing. Keep collecting information. Do NOT set isComplete to true."}

Also extract caller name, email, and address if mentioned at any point.

Respond with ONLY a JSON object:
{
  "extractedFields": {"fieldKey": "value", ...},
  "callerName": "name or null",
  "callerEmail": "email or null",
  "callerAddress": "address or null",
  "nextResponse": "Your spoken response to the caller",
  "isComplete": ${allRequiredCollected ? "true ONLY if you have summarized the info, the caller confirmed it, AND they said they have nothing else to add. Otherwise false." : "false"},
  "summary": "Brief summary of call so far or null"
}`;
}

export function buildEmergencyPrompt(callerSpeech: string): string {
  return `You are an emergency response AI for Elevate Edge HVAC. The caller has an HVAC emergency.

Caller said: "${callerSpeech}"

Assess the situation and respond. Your response should:
1. Acknowledge the emergency calmly
2. Provide immediate safety instructions if applicable (gas leak = evacuate and call 911, CO = open windows and evacuate, no heat = space heater safety tips)
3. Assure them a technician will be dispatched or call back within 15 minutes

Respond with ONLY a JSON object:
{
  "severity": "critical|high|moderate",
  "safetyInstructions": "immediate safety advice",
  "spokenResponse": "What to say to the caller (under 4 sentences)",
  "requiresImmediateDispatch": true/false,
  "emergencyType": "gas_leak|carbon_monoxide|no_heat|equipment_fire|flooding|other"
}`;
}

export function initializeIntakeState(callType: string): Record<string, string> {
  const fields = getFieldsForCallType(callType);
  const state: Record<string, string> = {};
  for (const field of fields) {
    state[field.key] = "";
  }
  return state;
}

export function getIntakeProgress(callType: string, intakeData: Record<string, string>): {
  total: number;
  collected: number;
  requiredTotal: number;
  requiredCollected: number;
  percentage: number;
} {
  const fields = getFieldsForCallType(callType);
  const requiredFields = fields.filter(f => f.required);
  const collected = fields.filter(f => intakeData[f.key]);
  const requiredCollected = requiredFields.filter(f => intakeData[f.key]);

  return {
    total: fields.length,
    collected: collected.length,
    requiredTotal: requiredFields.length,
    requiredCollected: requiredCollected.length,
    percentage: fields.length > 0 ? Math.round((collected.length / fields.length) * 100) : 0,
  };
}
