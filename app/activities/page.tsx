"use client";
import Only from "@/components/Only";
import { ActivityList } from "@/components/owner/Activities";
export default function Page() { return <Only roles={["owner"]}><ActivityList /></Only>; }
