import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAuditPdf } from "@/server/lib/audit-pdf";

function getResend() {
  const { Resend } = require("resend");
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string;

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    // Find the session by Twilio CallSid
    const session = await prisma.callSession.findUnique({
      where: { twilioCallSid: callSid },
      include: { turns: { orderBy: { turnNumber: "asc" } } },
    });

    if (!session) {
      console.warn(`No session found for CallSid: ${callSid}`);
      return NextResponse.json({ ok: true });
    }

    // Map Twilio status to our status
    let status = session.status;
    if (callStatus === "completed") status = "completed";
    else if (callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer") status = "failed";

    // Update session with final status and duration
    await prisma.callSession.update({
      where: { id: session.id },
      data: {
        status,
        endedAt: new Date(),
        duration: callDuration ? parseInt(callDuration, 10) : null,
      },
    });

    // If call had conversation (more than just greeting), generate audit and email
    if (session.turns.length > 1) {
      try {
        // Reload session with updated data
        const updatedSession = await prisma.callSession.findUnique({
          where: { id: session.id },
          include: { turns: { orderBy: { turnNumber: "asc" } } },
        });

        if (updatedSession) {
          // Generate PDF
          const pdfBase64 = generateAuditPdf({
            ...updatedSession,
            duration: callDuration ? parseInt(callDuration, 10) : null,
            endedAt: new Date(),
            status,
          });

          // Get email recipient from AppSettings
          const setting = await prisma.appSettings.findUnique({
            where: { key: "email_recipient" },
          });

          if (setting?.value) {
            const callTypeLabel = (updatedSession.callType || "Unknown").charAt(0).toUpperCase() +
              (updatedSession.callType || "unknown").slice(1);
            const callerLabel = updatedSession.callerName || updatedSession.callerNumber;
            const dateStr = new Date().toISOString().split("T")[0];

            await getResend().emails.send({
              from: "Elevate Edge <onboarding@resend.dev>",
              to: [setting.value],
              subject: `Call Audit: ${callTypeLabel} Intake - ${callerLabel} (${dateStr})`,
              html: buildAuditEmailHtml(updatedSession),
              attachments: [
                {
                  filename: `Call_Audit_${dateStr}_${updatedSession.twilioCallSid}.pdf`,
                  content: Buffer.from(pdfBase64, "base64"),
                },
              ],
            });

            // Mark audit as sent
            await prisma.callSession.update({
              where: { id: session.id },
              data: { auditPdfSent: true },
            });

            console.log(`Audit PDF emailed for session ${session.id}`);
          } else {
            console.warn("No email recipient configured, skipping audit email");
          }
        }
      } catch (auditErr) {
        console.error("Audit PDF/email error:", auditErr);
        // Don't fail the webhook response for audit errors
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Twilio status callback error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function buildAuditEmailHtml(session: {
  callType: string | null;
  callerNumber: string;
  callerName: string | null;
  callerEmail: string | null;
  twilioCallSid: string;
  startedAt: Date;
  duration: number | null;
  intakeData: string | null;
  summary: string | null;
  turns: { role: string; content: string; turnNumber: number }[];
}): string {
  const callType = (session.callType || "Unknown").charAt(0).toUpperCase() + (session.callType || "unknown").slice(1);
  const date = new Date(session.startedAt).toLocaleString("en-US");
  const duration = session.duration ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s` : "N/A";

  let intakeHtml = "";
  if (session.intakeData) {
    try {
      const data = JSON.parse(session.intakeData);
      const entries = Object.entries(data).filter(([, v]) => v);
      if (entries.length > 0) {
        intakeHtml = `<h3 style="color: #059669; margin-top: 20px;">Collected Data</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            ${entries.map(([k, v]) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; font-weight: bold; color: #6b7280; width: 35%;">${formatLabel(k)}</td>
                <td style="padding: 8px;">${v}</td>
              </tr>
            `).join("")}
          </table>`;
      }
    } catch { /* skip */ }
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Call Intake Audit</h1>
        <p style="color: #d1fae5; margin: 5px 0 0;">Elevate Edge AI Phone Agent</p>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h3 style="color: #059669;">Call Overview</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px; color: #6b7280; font-weight: bold;">Type</td><td style="padding: 6px;">${callType}</td></tr>
          <tr><td style="padding: 6px; color: #6b7280; font-weight: bold;">Caller</td><td style="padding: 6px;">${session.callerName || "Unknown"} (${session.callerNumber})</td></tr>
          ${session.callerEmail ? `<tr><td style="padding: 6px; color: #6b7280; font-weight: bold;">Email</td><td style="padding: 6px;">${session.callerEmail}</td></tr>` : ""}
          <tr><td style="padding: 6px; color: #6b7280; font-weight: bold;">Date</td><td style="padding: 6px;">${date}</td></tr>
          <tr><td style="padding: 6px; color: #6b7280; font-weight: bold;">Duration</td><td style="padding: 6px;">${duration}</td></tr>
        </table>

        ${session.summary ? `<p style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 6px; color: #065f46;"><strong>Summary:</strong> ${session.summary}</p>` : ""}

        ${intakeHtml}

        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
          Full transcript and detailed audit attached as PDF.<br/>
          Call SID: ${session.twilioCallSid}
        </p>
      </div>
    </div>
  `;
}

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}
