import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// Display: Bricolage Grotesque, big and warm, readable from across a room.
const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
// Body: Atkinson Hyperlegible, designed for low-vision readers.
const body = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "RehabVerse | Move • Play • Progress",
  description: "Turn your existing home exercise plan into interactive quests, or explore general movement experiences with Nova.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="sr-only z-50 rounded-xl bg-[#F2C14E] p-3 text-[#2A2410] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
