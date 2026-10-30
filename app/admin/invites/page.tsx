"use client";
import Only from "@/components/Only";
import { Invites } from "@/components/admin/Admin";
export default function Page() { return <Only roles={["admin"]}><Invites /></Only>; }
