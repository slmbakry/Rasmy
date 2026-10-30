"use client";
import { useParams } from "next/navigation";
import Only from "@/components/Only";
import { Job } from "@/components/office/Office";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Only roles={["office"]}><Job id={id} /></Only>; }
