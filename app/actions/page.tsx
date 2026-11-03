"use client";
import Only from "@/components/Only";
import { Actions } from "@/components/owner/Sections";
export default function Page() { return <Only roles={["owner"]}><Actions /></Only>; }
