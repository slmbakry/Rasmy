"use client";
import Only from "@/components/Only";
import { Companies } from "@/components/admin/Admin";
export default function Page() { return <Only roles={["admin"]}><Companies /></Only>; }
