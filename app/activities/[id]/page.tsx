"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import { ActivityView } from "@/components/owner/Activities";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><ActivityView id={id} /></Only>; }
