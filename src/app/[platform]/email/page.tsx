import EmailInbox from "@/components/communications/EmailInbox";

export default function EmailPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 shrink-0 shadow-sm">
        <span className="font-medium text-[#2F3941]">Email</span>
      </header>
      <div className="flex-1 overflow-hidden">
        <EmailInbox />
      </div>
    </div>
  );
}
