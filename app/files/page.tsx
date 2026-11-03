"use client";
import Only from "@/components/Only";
import { CurrentFiles } from "@/components/owner/Sections";
export default function Page() { return <Only roles={["owner"]}><CurrentFiles /></Only>; }
