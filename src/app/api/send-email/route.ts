import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { subject, htmlBody, pdfBase64 } = await req.json();

    if (!subject || !htmlBody) {
      return NextResponse.json(
        { error: "Missing subject or htmlBody" },
        { status: 400 }
      );
    }

    // Fetch recipient from AppSettings
    const setting = await prisma.appSettings.findUnique({
      where: { key: "email_recipient" },
    });

    if (!setting?.value) {
      return NextResponse.json(
        { error: "No email recipient configured. Please set your email in Settings." },
        { status: 400 }
      );
    }

    const recipient = setting.value;

    // Build attachments array
    const attachments: { filename: string; content: Buffer }[] = [];
    if (pdfBase64) {
      // Strip data URI prefix if present
      const base64Data = pdfBase64.replace(/^data:application\/pdf;[^,]+,/, "");
      attachments.push({
        filename: `Research_Report_${new Date().toISOString().split("T")[0]}.pdf`,
        content: Buffer.from(base64Data, "base64"),
      });
    }

    const { data, error } = await resend.emails.send({
      from: "Elevate Edge <onboarding@resend.dev>",
      to: [recipient],
      subject,
      html: htmlBody,
      attachments,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error("Send email error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
