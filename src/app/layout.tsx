import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { EnvironmentBadge } from "@/components/layout/EnvironmentBadge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

// Initialize Sentry for client-side (only in browser)
if (typeof window !== 'undefined') {
  require('../sentry.client.config');
}

const dmSans = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Family Money Tracker",
  description: "Track your family finances with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <EnvironmentBadge />
        <Analytics />
      </body>
    </html>
  );
}
