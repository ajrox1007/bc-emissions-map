import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { generateAuditPdf } from "@/server/lib/audit-pdf";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/call-complete
 *
 * Called by the Pipecat bot when a call ends. Receives complete call session
 * data and persists it to the database, then generates and emails an audit PDF.
 *
 * Body:
 * {
 *   twilioCallSid: string,
 *   callerNumber: string,
 *   direction: "inbound" | "outbound",
 *   callType: string,
 *   callerName?: string,
 *   callerEmail?: string,
 *   callerAddress?: string,
 *   intakeData?: string (JSON),
 *   summary?: string,
 *   turns: { role: string, content: string, turnNumber: number, extractedData?: string }[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      twilioCallSid,
      callerNumber,
      direction,
      callType,
      callerName,
      callerEmail,
      callerAddress,
      intakeData,
      summary,
      turns,
    } = body;

    if (!twilioCallSid || !callerNumber) {
      return NextResponse.json(
        { error: "Missing twilioCallSid or callerNumber" },
        { status: 400 }
      );
    }

    console.log(`[call-complete] Saving call ${twilioCallSid} (${direction}, ${callType})`);

    // Check if session already exists (outbound calls pre-create it)
    let session = await prisma.callSession.findUnique({
      where: { twilioCallSid },
    });

    if (session) {
      // Update existing session
      session = await prisma.callSession.update({
        where: { twilioCallSid },
        data: {
          status: "completed",
          callType: callType || session.callType,
          callerName: callerName || session.callerName,
          callerEmail: callerEmail || session.callerEmail,
          callerAddress: callerAddress || session.callerAddress,
          intakeData: intakeData || session.intakeData,
          summary: summary || session.summary,
          endedAt: new Date(),
        },
      });
    } else {
      // Create new session (inbound calls)
      session = await prisma.callSession.create({
        data: {
          twilioCallSid,
          callerNumber,
          direction: direction || "inbound",
          status: "completed",
          callType: callType || "unknown",
          callerName: callerName || null,
          callerEmail: callerEmail || null,
          callerAddress: callerAddress || null,
          intakeData: intakeData || null,
          summary: summary || null,
          endedAt: new Date(),
        },
      });
    }

    // Save conversation turns
    if (turns && Array.isArray(turns) && turns.length > 0) {
      const turnData = turns.map(
        (t: { role: string; content: string; turnNumber: number; extractedData?: string }) => ({
          sessionId: session!.id,
          role: t.role,
          content: t.content,
          turnNumber: t.turnNumber,
          extractedData: t.extractedData || null,
        })
      );

      await prisma.callTurn.createMany({ data: turnData });
    }

    console.log(`[call-complete] Session ${session.id} saved with ${turns?.length || 0} turns`);

    // Generate audit PDF and send email if there were conversation turns
    if (turns && turns.length > 1) {
      try {
        const fullSession = await prisma.callSession.findUnique({
          where: { id: session.id },
          include: { turns: { orderBy: { turnNumber: "asc" } } },
        });

        if (fullSession) {
          const pdfBase64 = generateAuditPdf({
            ...fullSession,
            endedAt: new Date(),
            status: "completed",
          });

          // Get email recipient from AppSettings
          const setting = await prisma.appSettings.findUnique({
            where: { key: "email_recipient" },
          });

          if (setting?.value) {
            const callTypeLabel =
              (fullSession.callType || "Unknown").charAt(0).toUpperCase() +
              (fullSession.callType || "unknown").slice(1);
            const callerLabel = fullSession.callerName || fullSession.callerNumber;
            const dateStr = new Date().toISOString().split("T")[0];

            await resend.emails.send({
              from: "Elevate Edge <onboarding@resend.dev>",
              to: [setting.value],
              subject: `Call Audit: ${callTypeLabel} Intake - ${callerLabel} (${dateStr})`,
              html: buildAuditEmailHtml(fullSession),
              attachments: [
                {
                  filename: `Call_Audit_${dateStr}_${fullSession.twilioCallSid}.pdf`,
                  content: Buffer.from(pdfBase64, "base64"),
                },
              ],
            });

            await prisma.callSession.update({
              where: { id: session.id },
              data: { auditPdfSent: true },
            });

            console.log(`[call-complete] Audit PDF emailed for session ${session.id}`);
          } else {
            console.warn("[call-complete] No email recipient configured, skipping audit email");
          }
        }
      } catch (auditErr) {
        console.error("[call-complete] Audit PDF/email error:", auditErr);
        // Don't fail the response for audit errors
      }
    }

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("[call-complete] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
  const callType =
    (session.callType || "Unknown").charAt(0).toUpperCase() +
    (session.callType || "unknown").slice(1);
  const date = new Date(session.startedAt).toLocaleString("en-US");
  const duration = session.duration
    ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
    : "N/A";

  let intakeHtml = "";
  if (session.intakeData) {
    try {
      const data = JSON.parse(session.intakeData);
      const entries = Object.entries(data).filter(([, v]) => v);
      if (entries.length > 0) {
        intakeHtml = `<h3 style="color: #059669; margin-top: 20px;">Collected Data</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            ${entries
              .map(
                ([k, v]) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; font-weight: bold; color: #6b7280; width: 35%;">${formatLabel(k)}</td>
                <td style="padding: 8px;">${v}</td>
              </tr>
            `
              )
              .join("")}
          </table>`;
      }
    } catch {
      /* skip */
    }
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Call Intake Audit</h1>
        <p style="color: #d1fae5; margin: 5px 0 0;">Elevate Edge AI Phone Agent (Pipecat)</p>
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
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
