import CommunicationsInbox from "@/components/communications/CommunicationsInbox";

export default function CommunicationsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 shrink-0 shadow-sm">
        <span className="font-medium text-[#2F3941]">Communications</span>
      </header>
      <div className="flex-1 overflow-auto">
        <CommunicationsInbox />
      </div>
    </div>
  );
}
