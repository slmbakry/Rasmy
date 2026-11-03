"use client";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import Only from "@/components/Only";
import { useCompanies } from "@/components/companies";
import OwnerHome from "@/components/owner/Home";

// Opening a company makes it the one every owner section shows.
function Picked({ id }: { id: string }) {
  const { list, pick, reload } = useCompanies();
  useEffect(() => { pick(id); if (list && !list.some((c) => c.id === id)) reload(); }, [id, list?.length]);
  return <OwnerHome companyId={id} />;
}

export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><Picked id={id} /></Only>; }
