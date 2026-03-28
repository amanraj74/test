import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VaaniCare 2.0 Command Center",
  description: "AI-powered voice calling system for Indian healthcare",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased overflow-hidden`}>
        <DashboardLayoutWrapper>
          {children}
        </DashboardLayoutWrapper>
      </body>
    </html>
  );
}
