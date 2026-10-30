"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import { Prices } from "@/components/admin/Admin";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["admin"]}><Prices officeId={id} /></Only>; }
