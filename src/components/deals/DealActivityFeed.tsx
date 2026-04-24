"use client";

import ContactActivityFeed from "@/components/contacts/ContactActivityFeed";

interface Props {
  dealId: string;
  contactId: string;
}

export default function DealActivityFeed({ contactId }: Props) {
  return <ContactActivityFeed contactId={contactId} />;
}
