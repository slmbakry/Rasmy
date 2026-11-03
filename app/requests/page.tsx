"use client";
import Only from "@/components/Only";
import { MyRequests } from "@/components/owner/Sections";
export default function Page() { return <Only roles={["owner"]}><MyRequests /></Only>; }
