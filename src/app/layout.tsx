import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FutureTech Radar | AI, Deep Tech & Business Intelligence",
  description:
    "Live web crawler tracking breakthroughs, research papers, and business news across 16 key future technologies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}
