"use client";
import Only from "@/components/Only";
import AdminRequirements from "@/components/admin/AdminRequirements";
export default function Page() { return <Only roles={["admin"]}><AdminRequirements /></Only>; }
