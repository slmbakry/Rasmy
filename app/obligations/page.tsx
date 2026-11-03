"use client";
import Only from "@/components/Only";
import { Obligations } from "@/components/owner/Sections";
export default function Page() { return <Only roles={["owner"]}><Obligations /></Only>; }
