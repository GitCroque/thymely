import type { Metadata } from "next";
import "./globals.css";
import Fathom from "@/component/Fathom";

export const metadata: Metadata = {
  title: "Thymely — Open-source helpdesk for small teams",
  description:
    "Free, self-hosted ticket management system. A simple alternative to Zammad, osTicket, and FreeScout. Deploy in minutes with Docker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <Fathom />
        {children}
      </body>
    </html>
  );
}
