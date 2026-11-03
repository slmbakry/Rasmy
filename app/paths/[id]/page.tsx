"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import PathView from "@/components/owner/PathView";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["owner"]}><PathView id={id} /></Only>; }
