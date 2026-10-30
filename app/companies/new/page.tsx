"use client";
import Only from "@/components/Only";
import { CompanyNew } from "@/components/owner/Forms";
export default function Page() { return <Only roles={["owner"]}><CompanyNew /></Only>; }
