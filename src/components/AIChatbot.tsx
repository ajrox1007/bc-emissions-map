"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, AlignmentType, TableCell, TableRow, Table, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: UploadedFile[];
  thinking?: string;
  researchMode?: boolean;
  citations?: APACitation[];
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content: string; // Base64 or text content
}

interface Citation {
  url: string;
  title?: string;
}

interface APACitation {
  number: number;
  url: string;
  title?: string;
  author?: string;
  date?: string;
  siteName?: string;
}

// Available models from Perplexity API
const AVAILABLE_MODELS = [
  // Agentic Research API Models (GPT-5.x via /v1/responses)
  { id: "openai/gpt-5.2", name: "GPT-5.2", provider: "OpenAI", tier: "premium", description: "Most capable reasoning model" },
  { id: "openai/gpt-5.1", name: "GPT-5.1", provider: "OpenAI", tier: "premium", description: "Previous generation GPT" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "OpenAI", tier: "standard", description: "Fast, lightweight model" },
  // Anthropic Models
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", tier: "premium", description: "Most capable Claude" },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", tier: "standard", description: "Fast Claude variant" },
  // Google Gemini Models
  { id: "google/gemini-3-pro", name: "Gemini 3 Pro", provider: "Google", tier: "premium", description: "Latest Gemini flagship model" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", tier: "standard", description: "Fast, efficient Gemini" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", tier: "standard", description: "Previous Gemini reasoning" },
  // Perplexity Native Models (via /chat/completions)
  { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", provider: "Perplexity", tier: "premium", description: "Deep reasoning + web search" },
  { id: "sonar-pro", name: "Sonar Pro", provider: "Perplexity", tier: "standard", description: "Enhanced web search" },
  { id: "sonar", name: "Sonar", provider: "Perplexity", tier: "basic", description: "Fast web search" },
];

const QUICK_PROMPTS = [
  "What are the top 5 communities by emissions?",
  "Show me all LNG projects over $1B",
  "Which areas have the highest fossil fuel usage?",
  "Generate a market opportunity report for Vancouver",
  "Compare residential vs commercial emissions across BC",
];

// Supported file types
const SUPPORTED_FILE_TYPES = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/json": ".json",
  "text/markdown": ".md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Simulated thinking steps when no real thinking is available
const FALLBACK_THINKING_STEPS = [
  "Analyzing your question and context...",
  "Searching for relevant information...",
  "Processing data and findings...",
  "Formulating response...",
];

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedModel, setSelectedModel] = useState("sonar-pro");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string>("");
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fallback thinking animation when no real thinking is streamed
  useEffect(() => {
    if (!isLoading) {
      // Clear thinking when done loading
      if (!currentThinking) {
        setThinkingSteps([]);
      }
      return;
    }

    // Only show fallback steps if no real thinking is being displayed
    if (currentThinking) return;

    let stepIndex = 0;
    const intervalId = setInterval(() => {
      if (stepIndex < FALLBACK_THINKING_STEPS.length) {
        setThinkingSteps(prev => [...prev, FALLBACK_THINKING_STEPS[stepIndex]]);
        stepIndex++;
      } else {
        // Loop through steps
        setThinkingSteps([]);
        stepIndex = 0;
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isLoading, currentThinking]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // File processing
  const processFile = async (file: File): Promise<UploadedFile | null> => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`File ${file.name} exceeds 10MB limit`);
      return null;
    }

    const supportedTypes = Object.keys(SUPPORTED_FILE_TYPES);
    if (!supportedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setError(`Unsupported file type: ${file.type || file.name.split('.').pop()}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      
      if (file.type.startsWith('image/')) {
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            content: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDFs, we'll send as base64 and let the API handle it
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            content: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else {
        // Text-based files
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type || 'text/plain',
            size: file.size,
            content: reader.result as string,
          });
        };
        reader.readAsText(file);
      }
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const processedFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      const processed = await processFile(file);
      if (processed) {
        processedFiles.push(processed);
      }
    }

    setUploadedFiles((prev) => [...prev, ...processedFiles]);
    setError(null);
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert citations to APA format
  const convertToAPACitations = (rawCitations: any[]): APACitation[] => {
    if (!rawCitations || !Array.isArray(rawCitations)) return [];
    
    return rawCitations.map((citation, index) => {
      const url = typeof citation === 'string' ? citation : citation.url || citation;
      let siteName = "Unknown";
      let title = "Untitled";
      
      try {
        const urlObj = new URL(url);
        siteName = urlObj.hostname.replace('www.', '');
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          title = pathParts[pathParts.length - 1]
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\.\w+$/, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      } catch (e) {}
      
      return {
        number: index + 1,
        url,
        title: typeof citation === 'object' && citation.title ? citation.title : title,
        author: typeof citation === 'object' && citation.author ? citation.author : siteName,
        date: typeof citation === 'object' && citation.date ? citation.date : new Date().getFullYear().toString(),
        siteName,
      };
    });
  };

  // Export message to DOCX with proper markdown parsing
  const exportToDocx = async (content: string, citations: APACitation[] = []) => {
    try {
      const children: any[] = [];
      const lines = content.split('\n');
      let i = 0;

      // Helper to parse inline markdown (bold, italic, links)
      const parseInlineMarkdown = (text: string, apaCitations: APACitation[] = []): any[] => {
        const runs: any[] = [];
        let remaining = text;

        while (remaining.length > 0) {
          // Check for citation [1], [2], etc.
          const citationMatch = remaining.match(/^\[(\d+)\]/);
          if (citationMatch) {
            const citationNum = parseInt(citationMatch[1]);
            const citation = apaCitations.find(c => c.number === citationNum);
            if (citation) {
              runs.push(
                new ExternalHyperlink({
                  children: [new TextRun({ text: `(${citation.author || citation.siteName}, ${citation.date})`, style: "Hyperlink", size: 22 })],
                  link: citation.url,
                })
              );
            } else {
              runs.push(new TextRun({ text: citationMatch[0], size: 22 }));
            }
            remaining = remaining.slice(citationMatch[0].length);
            continue;
          }

          // Check for bold **text**
          const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
          if (boldMatch) {
            runs.push(new TextRun({ text: boldMatch[1], bold: true, size: 22 }));
            remaining = remaining.slice(boldMatch[0].length);
            continue;
          }

          // Check for italic *text*
          const italicMatch = remaining.match(/^\*(.+?)\*/);
          if (italicMatch) {
            runs.push(new TextRun({ text: italicMatch[1], italics: true, size: 22 }));
            remaining = remaining.slice(italicMatch[0].length);
            continue;
          }

          // Check for links [text](url)
          const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);
          if (linkMatch) {
            runs.push(
              new ExternalHyperlink({
                children: [new TextRun({ text: linkMatch[1], style: "Hyperlink", size: 22 })],
                link: linkMatch[2],
              })
            );
            remaining = remaining.slice(linkMatch[0].length);
            continue;
          }

          // Regular text - find next special character
          const nextSpecial = remaining.search(/\*|\[/);
          if (nextSpecial === -1) {
            runs.push(new TextRun({ text: remaining, size: 22 }));
            break;
          } else if (nextSpecial === 0) {
            runs.push(new TextRun({ text: remaining[0], size: 22 }));
            remaining = remaining.slice(1);
          } else {
            runs.push(new TextRun({ text: remaining.slice(0, nextSpecial), size: 22 }));
            remaining = remaining.slice(nextSpecial);
          }
        }

        return runs.length > 0 ? runs : [new TextRun({ text: text, size: 22 })];
      };

      // Title
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Research Report", bold: true, size: 36 })],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      // Date
      children.push(
        new Paragraph({
          children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), italics: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Parse content
      while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (!line.trim()) {
          children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
          i++;
          continue;
        }

        // Headings
        if (line.startsWith('#### ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('#### ', ''), citations), heading: HeadingLevel.HEADING_4, spacing: { before: 200, after: 100 } }));
          i++;
          continue;
        }
        if (line.startsWith('### ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('### ', ''), citations), heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 } }));
          i++;
          continue;
        }
        if (line.startsWith('## ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('## ', ''), citations), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
          i++;
          continue;
        }
        if (line.startsWith('# ')) {
          children.push(new Paragraph({ children: parseInlineMarkdown(line.replace('# ', ''), citations), heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
          i++;
          continue;
        }

        // Tables (detect | at start)
        if (line.trim().startsWith('|') && line.includes('|')) {
          const tableRows: any[] = [];
          let j = i;
          
          while (j < lines.length && lines[j].trim().startsWith('|')) {
            const rowLine = lines[j].trim();
            // Skip separator rows
            if (rowLine.match(/^\|[-:\s|]+\|$/)) {
              j++;
              continue;
            }
            
            const cells = rowLine.split('|').filter(c => c.trim() !== '');
            const isHeader = j === i;
            
            tableRows.push(
              new TableRow({
                children: cells.map(cell => 
                  new TableCell({
                    children: [new Paragraph({ children: parseInlineMarkdown(cell.trim(), citations) })],
                    shading: isHeader ? { fill: "E8E8E8" } : undefined,
                  })
                ),
              })
            );
            j++;
          }
          
          if (tableRows.length > 0) {
            children.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
            children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
          }
          i = j;
          continue;
        }

        // Bullet points
        if (line.match(/^[\s]*[-*•]\s/)) {
          const bulletText = line.replace(/^[\s]*[-*•]\s/, '');
          children.push(
            new Paragraph({
              children: [new TextRun({ text: "• " }), ...parseInlineMarkdown(bulletText, citations)],
              spacing: { before: 50, after: 50 },
              indent: { left: 720 },
            })
          );
          i++;
          continue;
        }

        // Numbered lists
        if (line.match(/^[\s]*\d+\.\s/)) {
          children.push(
            new Paragraph({
              children: parseInlineMarkdown(line, citations),
              spacing: { before: 50, after: 50 },
              indent: { left: 720 },
            })
          );
          i++;
          continue;
        }

        // Regular paragraph
        children.push(
          new Paragraph({
            children: parseInlineMarkdown(line, citations),
            spacing: { before: 100, after: 100 },
          })
        );
        i++;
      }

      // References section
      if (citations.length > 0) {
        children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "References", bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        for (const citation of citations) {
          children.push(
            new Paragraph({
              children: [
                new ExternalHyperlink({
                  children: [
                    new TextRun({ text: `${citation.author || citation.siteName}. (${citation.date}). `, size: 20 }),
                    new TextRun({ text: citation.title, italics: true, size: 20 }),
                    new TextRun({ text: `. Retrieved from ${citation.url}`, size: 20, style: "Hyperlink" }),
                  ],
                  link: citation.url,
                }),
              ],
              spacing: { before: 80, after: 80 },
              indent: { left: 720, hanging: 720 },
            })
          );
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Research_Report_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (error) {
      console.error("DOCX export error:", error);
      alert("Failed to export DOCX. Please try again.");
    }
  };

  // Export message to PDF
  const exportToPdf = async (content: string, citations: APACitation[] = []) => {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      // Helper to add text with page breaks
      const addText = (text: string, fontSize: number, isBold: boolean = false, isItalic: boolean = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", isBold ? "bold" : isItalic ? "italic" : "normal");
        
        // Remove markdown formatting for PDF
        const cleanText = text
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/\[(\d+)\]/g, '[$1]')
          .replace(/\[(.+?)\]\(.+?\)/g, '$1');
        
        const lines = pdf.splitTextToSize(cleanText, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, margin, y);
          y += fontSize * 0.4;
        }
      };

      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Research Report", pageWidth / 2, y, { align: 'center' });
      y += 10;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      pdf.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, y, { align: 'center' });
      y += 15;

      // Parse content
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) {
          y += 3;
          continue;
        }

        if (line.startsWith('#### ')) {
          y += 3;
          addText(line.replace('#### ', ''), 11, true);
          y += 2;
        } else if (line.startsWith('### ')) {
          y += 4;
          addText(line.replace('### ', ''), 12, true);
          y += 2;
        } else if (line.startsWith('## ')) {
          y += 5;
          addText(line.replace('## ', ''), 14, true);
          y += 3;
        } else if (line.startsWith('# ')) {
          y += 6;
          addText(line.replace('# ', ''), 16, true);
          y += 4;
        } else if (line.match(/^[\s]*[-*•]\s/)) {
          addText('  • ' + line.replace(/^[\s]*[-*•]\s/, ''), 10);
        } else if (line.trim().startsWith('|')) {
          // Skip table formatting characters in PDF
          if (!line.match(/^\|[-:\s|]+\|$/)) {
            addText(line.replace(/\|/g, '  '), 9);
          }
        } else {
          addText(line, 10);
        }
      }

      // References
      if (citations.length > 0) {
        y += 10;
        addText('References', 14, true);
        y += 5;
        for (const citation of citations) {
          addText(`${citation.author || citation.siteName}. (${citation.date}). ${citation.title}. ${citation.url}`, 9);
          y += 2;
        }
      }

      pdf.save(`Research_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage: Message = { 
      role: "user", 
      content: input,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      researchMode,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const filesToSend = [...uploadedFiles];
    setUploadedFiles([]);
    setIsLoading(true);
    setError(null);
    setCurrentThinking("");
    setThinkingSteps([]);

    try {
      let fullContent = input;
      
      if (filesToSend.length > 0) {
        fullContent += "\n\n[ATTACHED FILES]\n";
        for (const file of filesToSend) {
          if (file.type.startsWith('image/')) {
            fullContent += `\n[Image: ${file.name}]\n`;
          } else if (file.type === 'application/pdf') {
            fullContent += `\n[PDF Document: ${file.name}]\n`;
          } else {
            fullContent += `\n[File: ${file.name}]\n${file.content.slice(0, 50000)}\n`;
          }
        }
      }

      const response = await fetch("/api/c1-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: fullContent }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          researchMode,
          files: filesToSend.filter(f => f.type.startsWith('image/')).map(f => ({
            type: "image",
            data: f.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || data.content || "I couldn't generate a response.";
      const thinkingContent = data.thinking || null;
      const apaCitations = convertToAPACitations(data.citations || []);
      
      if (apaCitations.length > 0) {
        setCitations(data.citations);
      }

      if (thinkingContent) {
        setCurrentThinking(thinkingContent);
      }

      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: assistantContent,
          thinking: thinkingContent,
          researchMode: data.researchMode,
          citations: apaCitations,
        },
      ]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to send message");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentThinking("");
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleNewConversation = () => {
    setMessages([]);
    setError(null);
    setCitations([]);
    setUploadedFiles([]);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (showModelSelector) {
        setShowModelSelector(false);
      } else {
        handleClose();
      }
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type === 'application/pdf') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);

  // Convert citation numbers [1], [2] to APA hyperlinks
  const renderContentWithAPACitations = (content: string, citations: APACitation[] = []) => {
    if (!citations || citations.length === 0) {
      return content;
    }

    // Replace [1], [2], etc. with markdown hyperlinks
    let processedContent = content;
    citations.forEach((citation) => {
      const pattern = new RegExp(`\\[${citation.number}\\]`, 'g');
      const author = citation.author || citation.siteName || "Source";
      const year = citation.date || new Date().getFullYear().toString();
      // Create APA-style in-text citation as a hyperlink
      const apaLink = `[${author}, ${year}](${citation.url})`;
      processedContent = processedContent.replace(pattern, apaLink);
    });

    return processedContent;
  };

  // Format APA reference list entry
  const formatAPAReference = (citation: APACitation): string => {
    const author = citation.author || citation.siteName || "Unknown";
    const date = citation.date || "n.d.";
    const title = citation.title || "Untitled";
    return `${author}. (${date}). *${title}*. Retrieved from ${citation.url}`;
  };

  const MarkdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-bold text-gray-900 mt-5 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">{children}</h4>
    ),
    p: ({ children }: any) => (
      <p className="text-sm text-gray-700 mb-3 leading-relaxed last:mb-0">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-relaxed ml-2">{children}</li>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-gray-50">{children}</thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{children}</td>
    ),
    code: ({ inline, children }: any) =>
      inline ? (
        <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      ) : (
        <code className="block bg-gray-100 text-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
          {children}
        </code>
      ),
    pre: ({ children }: any) => (
      <pre className="bg-gray-100 rounded-lg overflow-x-auto my-2">{children}</pre>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-gray-700">{children}</em>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 py-2 my-3 text-gray-700 italic bg-gray-50 rounded-r">
        {children}
      </blockquote>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-4 border-gray-200" />,
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-xl z-40 flex items-center justify-center hover:bg-gray-800 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </motion.button>

      {/* Fullscreen Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropZoneRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-50 bg-white flex flex-col ${isDragging ? 'ring-4 ring-inset ring-blue-500' : ''}`}
            onKeyDown={handleKeyDown}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-blue-500/10 z-50 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-dashed border-blue-500">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-xl font-semibold text-gray-900">Drop files here</p>
                      <p className="text-sm text-gray-500 mt-1">PDF, images, text files up to 10MB</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-16 flex-shrink-0 border-b border-gray-200 flex items-center justify-between px-8 bg-white">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="font-semibold text-gray-900">Elevate Edge</h1>
                    <p className="text-xs text-gray-500">Powered by Perplexity Agentic Research API</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Research Mode Toggle */}
                <button
                  onClick={() => setResearchMode(!researchMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all ${
                    researchMode 
                      ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  title={researchMode ? "Research mode enabled - deeper web search" : "Enable research mode for thorough analysis"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="font-medium">Research</span>
                  {researchMode && (
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  )}
                </button>

                {/* Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      selectedModelInfo?.tier === 'premium' ? 'bg-purple-500' :
                      selectedModelInfo?.tier === 'standard' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <span className="font-medium text-gray-700">{selectedModelInfo?.name || 'Select Model'}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {showModelSelector && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Model</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {['OpenAI', 'Anthropic', 'Google', 'Perplexity'].map((provider) => (
                            <div key={provider}>
                              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                <p className="text-xs font-semibold text-gray-500">{provider}</p>
                              </div>
                              {AVAILABLE_MODELS.filter(m => m.provider === provider).map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => {
                                    setSelectedModel(model.id);
                                    setShowModelSelector(false);
                                  }}
                                  className={`w-full px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left ${
                                    selectedModel === model.id ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                    model.tier === 'premium' ? 'bg-purple-500' :
                                    model.tier === 'standard' ? 'bg-blue-500' : 'bg-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900 text-sm">{model.name}</span>
                                      {model.tier === 'premium' && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">PRO</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{model.description}</p>
                                  </div>
                                  {selectedModel === model.id && (
                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleNewConversation}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  New Chat
                </button>
                <a
                  href="/settings"
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Settings
                </a>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-6xl mx-auto px-8 py-8">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      How can I help you today?
                    </h2>
                    <p className="text-gray-500 mb-4 max-w-xl mx-auto">
                      Ask me about BC emissions data, major projects, HVAC opportunities, or market intelligence.
                      {researchMode && (
                        <span className="block mt-2 text-purple-600 font-medium">
                          Research mode is ON - I'll conduct thorough web research for your questions.
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-400 mb-8">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Drag & drop files
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Enable Research mode for deep analysis
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Context from uploaded docs
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                      {QUICK_PROMPTS.slice(0, 4).map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuickPrompt(prompt)}
                          className="text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`${msg.role === "user" ? "max-w-[70%]" : "max-w-[95%]"} ${
                            msg.role === "user"
                              ? "bg-black text-white rounded-2xl rounded-br-md px-4 py-3"
                              : "bg-white rounded-2xl rounded-bl-md px-5 py-5 border border-gray-200 shadow-sm"
                          }`}
                        >
                          {msg.role === "user" ? (
                            <>
                              <p className="text-sm">{msg.content}</p>
                              {msg.files && msg.files.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {msg.files.map((file, fi) => (
                                    <div key={fi} className="flex items-center gap-1.5 text-xs bg-white/10 px-2 py-1 rounded">
                                      {getFileIcon(file.type)}
                                      <span className="truncate max-w-[100px]">{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {msg.researchMode && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-purple-300">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <span>Research mode</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4">
                              {/* Thinking/Reasoning Section */}
                              {msg.thinking && (
                                <details className="group">
                                  <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                    <svg className="w-4 h-4 transform transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <span className="font-medium">View AI Thinking Process</span>
                                    {msg.researchMode && (
                                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">Research</span>
                                    )}
                                  </summary>
                                  <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                                      {msg.thinking}
                                    </div>
                                  </div>
                                </details>
                              )}
                              
                              {/* Main Response Content with APA Citations */}
                              <div className="markdown-content">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={MarkdownComponents}
                                >
                                  {renderContentWithAPACitations(msg.content, msg.citations)}
                                </ReactMarkdown>
                              </div>

                              {/* APA References Section */}
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                  <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                      <svg className="w-4 h-4 transform transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      <span className="font-medium">References ({msg.citations.length})</span>
                                    </summary>
                                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                      <div className="space-y-2">
                                        {msg.citations.map((citation) => (
                                          <div key={citation.number} className="text-xs text-gray-700 leading-relaxed">
                                            <a
                                              href={citation.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="hover:text-blue-600 transition-colors"
                                            >
                                              {citation.author || citation.siteName || "Unknown"}. ({citation.date || "n.d."}). <em>{citation.title || "Untitled"}</em>. Retrieved from {citation.url}
                                            </a>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              )}

                              {/* Export Buttons */}
                              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                                <span className="text-xs text-gray-400">Export:</span>
                                <button
                                  onClick={() => {
                                    setExportingIndex(i);
                                    exportToDocx(msg.content, msg.citations || []).finally(() => setExportingIndex(null));
                                  }}
                                  disabled={exportingIndex === i}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {exportingIndex === i ? 'Exporting...' : 'DOCX'}
                                </button>
                                <button
                                  onClick={() => {
                                    setExportingIndex(i);
                                    exportToPdf(msg.content, msg.citations || []).finally(() => setExportingIndex(null));
                                  }}
                                  disabled={exportingIndex === i}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  PDF
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start w-full max-w-[95%]"
                      >
                        <div className="bg-white rounded-2xl rounded-bl-md px-5 py-4 border border-gray-200 shadow-sm w-full">
                          {/* Header with model info */}
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                            <div className="relative">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                researchMode 
                                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                                  : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                              }`}>
                                {researchMode ? (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                )}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full animate-pulse ${
                                researchMode ? 'bg-purple-400' : 'bg-emerald-400'
                              }`} />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {researchMode ? 'Deep Research' : 'Thinking'} with {selectedModelInfo?.name}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">{selectedModelInfo?.provider}</span>
                                <span className="text-xs text-gray-300">|</span>
                                <span className={`text-xs font-medium ${researchMode ? 'text-purple-500' : 'text-emerald-500'}`}>
                                  {researchMode ? 'Research Mode' : 'Processing'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Real Thinking Display */}
                          <div className="space-y-2">
                            {currentThinking ? (
                              // Show real thinking from API
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">AI Thinking Process</span>
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                                  {currentThinking}
                                </div>
                              </div>
                            ) : (
                              // Fallback: Show animated steps
                              <div className="space-y-2">
                                {thinkingSteps.map((step, index) => (
                                  <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50"
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                      index === thinkingSteps.length - 1 
                                        ? (researchMode ? 'bg-purple-500' : 'bg-emerald-500')
                                        : 'bg-gray-300'
                                    }`}>
                                      {index === thinkingSteps.length - 1 ? (
                                        <div className="flex gap-0.5">
                                          <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                          <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                          <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                      ) : (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`text-sm ${
                                      index === thinkingSteps.length - 1 
                                        ? (researchMode ? 'text-purple-700 font-medium' : 'text-emerald-700 font-medium')
                                        : 'text-gray-500'
                                    }`}>
                                      {step}
                                    </span>
                                  </motion.div>
                                ))}
                                {thinkingSteps.length === 0 && (
                                  <div className="flex items-center gap-3 p-2.5">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                      researchMode ? 'bg-purple-500' : 'bg-emerald-500'
                                    }`}>
                                      <div className="flex gap-0.5">
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                      </div>
                                    </div>
                                    <span className={`text-sm font-medium ${researchMode ? 'text-purple-700' : 'text-emerald-700'}`}>
                                      Starting analysis...
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Research mode indicator */}
                          {researchMode && (
                            <div className="mt-4 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2 text-xs text-purple-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Deep research mode - searching multiple sources for comprehensive analysis</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </main>

            {/* Input Footer */}
            <footer className="flex-shrink-0 border-t border-gray-200 bg-white">
              {/* Uploaded Files Preview */}
              {uploadedFiles.length > 0 && (
                <div className="px-8 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="max-w-6xl mx-auto flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <span className="text-gray-500">{getFileIcon(file.type)}</span>
                        <span className="truncate max-w-[150px] text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-20 px-8 flex items-center">
                <div className="max-w-6xl mx-auto w-full flex gap-3 items-center">
                  {/* File Upload Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.csv,.json,.md,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Upload files"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Ask about emissions, projects, opportunities..."
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                    className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoading ? (
                      "Thinking..."
                    ) : (
                      <>
                        Send
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </footer>

            {/* Error Toast */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow-lg"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
