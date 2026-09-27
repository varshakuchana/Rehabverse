import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RehabVerse | Move • Play • Progress",
  description: "Turn your existing home exercise plan into interactive quests, or explore general movement experiences with Nova.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="sr-only z-50 rounded-xl bg-indigo-600 p-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
