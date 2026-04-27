import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TDHC Desk",
  description: "Sales CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="flex h-screen overflow-hidden bg-[#F3F4F6]">
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
