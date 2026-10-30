"use client";
import Only from "@/components/Only";
import { Offices } from "@/components/admin/Admin";
export default function Page() { return <Only roles={["admin"]}><Offices /></Only>; }
