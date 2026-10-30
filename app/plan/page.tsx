"use client";
import Only from "@/components/Only";
import { Plan } from "@/components/owner/Guide";
export default function Page() { return <Only roles={["owner"]}><Plan /></Only>; }
