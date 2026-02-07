import { z } from "zod";
import { router, publicProcedure } from "./trpc";

export const callRouter = router({
  // Initiate an outbound call
  initiateCall: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(1),
        callType: z.string().optional(), // pre-set intake type
        callerName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      const response = await fetch(`${baseUrl}/api/twilio/outbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: input.phoneNumber,
          callType: input.callType || "unknown",
          callerName: input.callerName || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate call");
      }
      return data;
    }),

  // List calls with pagination and filters
  listCalls: publicProcedure
    .input(
      z.object({
        callType: z.string().optional(),
        status: z.string().optional(),
        dateFrom: z.string().optional(), // ISO date string
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { callType, status, dateFrom, dateTo, limit, offset } = input;

      const where: Record<string, unknown> = {};
      if (callType) where.callType = callType;
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.startedAt = {};
        if (dateFrom) (where.startedAt as Record<string, unknown>).gte = new Date(dateFrom);
        if (dateTo) (where.startedAt as Record<string, unknown>).lte = new Date(dateTo);
      }

      const [calls, total] = await Promise.all([
        ctx.prisma.callSession.findMany({
          where,
          orderBy: { startedAt: "desc" },
          take: limit,
          skip: offset,
          include: {
            _count: { select: { turns: true } },
          },
        }),
        ctx.prisma.callSession.count({ where }),
      ]);

      return { calls, total };
    }),

  // Get single call with full transcript
  getCall: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.callSession.findUnique({
        where: { id: input.id },
        include: {
          turns: { orderBy: { turnNumber: "asc" } },
        },
      });
    }),

  // Get call statistics
  getCallStats: publicProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCalls,
      callsToday,
      allCalls,
      recentCalls,
    ] = await Promise.all([
      ctx.prisma.callSession.count(),
      ctx.prisma.callSession.count({
        where: { startedAt: { gte: today } },
      }),
      ctx.prisma.callSession.findMany({
        select: { callType: true, status: true, duration: true },
      }),
      ctx.prisma.callSession.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { _count: { select: { turns: true } } },
      }),
    ]);

    // Calculate averages and breakdowns
    const durations = allCalls.filter(c => c.duration != null).map(c => c.duration!);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Count by type
    const byType: Record<string, number> = {};
    for (const call of allCalls) {
      const type = call.callType || "unknown";
      byType[type] = (byType[type] || 0) + 1;
    }

    // Count by status
    const byStatus: Record<string, number> = {};
    for (const call of allCalls) {
      byStatus[call.status] = (byStatus[call.status] || 0) + 1;
    }

    return {
      totalCalls,
      callsToday,
      avgDuration,
      byType,
      byStatus,
      recentCalls,
    };
  }),

  // Delete a call session
  deleteCall: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.callSession.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  // Resend audit email for a call
  resendAudit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.callSession.findUnique({
        where: { id: input.id },
        include: { turns: { orderBy: { turnNumber: "asc" } } },
      });

      if (!session) {
        throw new Error("Call session not found");
      }

      // Trigger the audit via internal API call
      const { generateAuditPdf } = await import("@/server/lib/audit-pdf");
      const { Resend } = await import("resend");

      const resend = new Resend(process.env.RESEND_API_KEY);
      const pdfBase64 = generateAuditPdf(session);

      const setting = await ctx.prisma.appSettings.findUnique({
        where: { key: "email_recipient" },
      });

      if (!setting?.value) {
        throw new Error("No email recipient configured");
      }

      const callTypeLabel = (session.callType || "Unknown").charAt(0).toUpperCase() +
        (session.callType || "unknown").slice(1);
      const callerLabel = session.callerName || session.callerNumber;
      const dateStr = new Date().toISOString().split("T")[0];

      await resend.emails.send({
        from: "Elevate Edge <onboarding@resend.dev>",
        to: [setting.value],
        subject: `[Resend] Call Audit: ${callTypeLabel} Intake - ${callerLabel} (${dateStr})`,
        html: `<p>Re-sent audit report for ${callTypeLabel} call from ${callerLabel}. See attached PDF for full details.</p>`,
        attachments: [
          {
            filename: `Call_Audit_${dateStr}_${session.twilioCallSid}.pdf`,
            content: Buffer.from(pdfBase64, "base64"),
          },
        ],
      });

      await ctx.prisma.callSession.update({
        where: { id: input.id },
        data: { auditPdfSent: true },
      });

      return { success: true };
    }),
});
