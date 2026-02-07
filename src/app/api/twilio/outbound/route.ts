import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/twilio/outbound
 *
 * Initiates an outbound call via Twilio using <Connect><Stream> TwiML
 * to connect the call to the Pipecat WebSocket voice agent.
 */
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, callType, callerName } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const pipecatWsUrl = process.env.PIPECAT_WS_URL;

    if (!accountSid || !authToken || !twilioNumber) {
      return NextResponse.json({ error: "Twilio credentials not configured" }, { status: 500 });
    }

    if (!pipecatWsUrl) {
      return NextResponse.json(
        { error: "PIPECAT_WS_URL not configured. Set it to your Pipecat server's WebSocket URL (e.g. wss://xxxx.ngrok-free.app/ws)" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // Build TwiML with <Connect><Stream> pointing to Pipecat WebSocket
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(pipecatWsUrl)}">
      <Parameter name="call_type" value="${escapeXml(callType || "unknown")}" />
      <Parameter name="caller_name" value="${escapeXml(callerName || "")}" />
      <Parameter name="direction" value="outbound" />
      <Parameter name="from_number" value="${escapeXml(twilioNumber)}" />
      <Parameter name="to_number" value="${escapeXml(phoneNumber)}" />
    </Stream>
  </Connect>
  <Pause length="300" />
</Response>`;

    // Initiate the outbound call with inline TwiML
    const call = await client.calls.create({
      to: phoneNumber,
      from: twilioNumber,
      twiml,
    });

    // Pre-create session so we have it ready
    await prisma.callSession.create({
      data: {
        twilioCallSid: call.sid,
        callerNumber: phoneNumber,
        direction: "outbound",
        status: "active",
        callType: callType || "unknown",
        callerName: callerName || null,
      },
    });

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
    });
  } catch (err: unknown) {
    console.error("Outbound call error:", err);
    const message = err instanceof Error ? err.message : "Failed to initiate call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
