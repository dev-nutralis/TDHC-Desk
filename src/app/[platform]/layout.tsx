import Sidebar from "@/components/layout/Sidebar";
import { SipPhoneProvider } from "@/context/SipPhoneProvider";
import { ActiveCallBar } from "@/components/calls/ActiveCallBar";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SipPhoneProvider>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
        <ActiveCallBar />
      </SipPhoneProvider>
    </div>
  );
}
