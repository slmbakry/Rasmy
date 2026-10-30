"use client";
import Only from "@/components/Only";
import { Performance } from "@/components/admin/Admin";
export default function Page() { return <Only roles={["admin"]}><Performance /></Only>; }
