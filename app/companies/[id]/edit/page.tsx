"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import { CompanyEdit } from "@/components/owner/Forms";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><CompanyEdit companyId={id} /></Only>; }
