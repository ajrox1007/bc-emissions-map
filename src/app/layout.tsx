import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { TRPCProvider } from "@/lib/providers";
import "./globals.css";

// Swiss-style typography - clean, geometric sans-serif
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "BC Emissions Map | Community-Level Greenhouse Gas Data",
  description:
    "Interactive visualization of British Columbia's community-level greenhouse gas emissions data for 2022. Explore residential, commercial, and industrial emissions across BC municipalities.",
  keywords: ["BC emissions", "greenhouse gas", "climate data", "British Columbia", "carbon emissions"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
