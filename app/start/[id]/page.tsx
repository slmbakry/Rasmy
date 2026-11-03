"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import { StartService } from "@/components/owner/Forms";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><StartService serviceId={id} /></Only>; }
