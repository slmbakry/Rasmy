"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import Files from "@/components/owner/Files";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><Files companyId={id} /></Only>; }
