"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import OwnerHome from "@/components/owner/Home";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><OwnerHome companyId={id} /></Only>; }
