import type { Metadata } from "next";
import { IBM_Plex_Serif, Manrope } from "next/font/google";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const metadataBase = process.env.KNOWLEDGE_BASE_SITE_URL
  ? new URL(process.env.KNOWLEDGE_BASE_SITE_URL)
  : undefined;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Thymely Knowledge Base",
    template: "%s | Thymely Knowledge Base",
  },
  description:
    "Public support articles for Thymely. Find product answers, setup guides, and operational how-tos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
