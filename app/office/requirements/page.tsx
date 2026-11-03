"use client";
import Only from "@/components/Only";
import ProviderRequirements from "@/components/office/ProviderRequirements";
export default function Page() { return <Only roles={["office"]}><ProviderRequirements /></Only>; }
