"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import Request from "@/components/owner/Request";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner", "admin"]}><Request id={id} /></Only>; }
