"use client";
import Only from "@/components/Only";
import { Users } from "@/components/admin/Admin";
export default function Page() { return <Only roles={["admin"]}><Users /></Only>; }
