import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/twilio/ws-incoming
 *
 * Twilio webhook for inbound calls. Returns TwiML that connects the call
 * to the Pipecat WebSocket voice agent via <Connect><Stream>.
 *
 * Configure your Twilio phone number's "A call comes in" webhook to point
 * to: https://YOUR_NEXTJS_NGROK_URL/api/twilio/ws-incoming
 */
export async function POST(req: NextRequest) {
  const pipecatWsUrl = process.env.PIPECAT_WS_URL;

  if (!pipecatWsUrl) {
    console.error("[ws-incoming] PIPECAT_WS_URL not configured");
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We're sorry, the voice agent is not available right now. Please try again later.</Say>
  <Hangup />
</Response>`;
    return new NextResponse(errorTwiml, {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // Extract caller info from Twilio's form data
  const formData = await req.formData();
  const callerNumber = formData.get("From") as string || "unknown";
  const calledNumber = formData.get("To") as string || "unknown";
  const callSid = formData.get("CallSid") as string || "unknown";

  console.log(`[ws-incoming] Inbound call from ${callerNumber} to ${calledNumber} (SID: ${callSid})`);

  // Return TwiML with <Connect><Stream> pointing to Pipecat WebSocket
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(pipecatWsUrl)}">
      <Parameter name="direction" value="inbound" />
      <Parameter name="from_number" value="${escapeXml(callerNumber)}" />
      <Parameter name="to_number" value="${escapeXml(calledNumber)}" />
    </Stream>
  </Connect>
  <Pause length="300" />
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
