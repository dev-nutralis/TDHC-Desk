import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SipPhoneProvider } from "@/context/SipPhoneProvider";
import { ActiveCallBar } from "@/components/calls/ActiveCallBar";

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
          <SipPhoneProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              {children}
            </div>
            <ActiveCallBar />
          </SipPhoneProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
