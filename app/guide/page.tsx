"use client";
import Only from "@/components/Only";
import { Guide } from "@/components/owner/Guide";
export default function Page() { return <Only roles={["owner"]}><Guide /></Only>; }
