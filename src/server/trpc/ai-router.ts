import { z } from "zod";
import { router, publicProcedure } from "./trpc";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

export const aiRouter = router({
  // Get conversation history
  getConversations: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        messages: {
          take: 1,
          orderBy: { timestamp: "desc" },
        },
      },
    });
  }),

  // Get messages for a conversation
  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.conversation.findUnique({
        where: { id: input.id },
        include: {
          messages: {
            orderBy: { timestamp: "asc" },
          },
        },
      });
    }),

  // Delete a conversation
  deleteConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.conversation.delete({
        where: { id: input.id },
      });
    }),

  // Upload and process a document
  uploadDocument: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        content: z.string(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { filename, mimeType, content, category } = input;

      // Create document record
      const document = await ctx.prisma.uploadedDocument.create({
        data: {
          filename,
          mimetype: mimeType,
          size: content.length,
          content: content.substring(0, 50000),
          category,
        },
      });

      // Generate summary using Perplexity
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (apiKey) {
        try {
          const response = await fetch(PERPLEXITY_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                {
                  role: "system",
                  content: "You are a document summarizer. Provide a brief 2-3 sentence summary of the document content.",
                },
                {
                  role: "user",
                  content: `Summarize this document (${filename}):\n\n${content.substring(0, 5000)}`,
                },
              ],
              max_tokens: 200,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const summary = data.choices?.[0]?.message?.content || "";

            await ctx.prisma.uploadedDocument.update({
              where: { id: document.id },
              data: { summary },
            });

            return { ...document, summary };
          }
        } catch (error) {
          console.error("Summary generation error:", error);
        }
      }

      return document;
    }),

  // Get all uploaded documents
  getDocuments: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.uploadedDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimetype: true,
        size: true,
        summary: true,
        category: true,
        createdAt: true,
      },
    });
  }),

  // Delete a document
  deleteDocument: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.uploadedDocument.delete({
        where: { id: input.id },
      });
    }),

  // Get document content for context
  getDocumentContent: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.uploadedDocument.findUnique({
        where: { id: input.id },
      });
    }),
});

export type AIRouter = typeof aiRouter;
