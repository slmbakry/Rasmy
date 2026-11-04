"use client";
import Only from "@/components/Only";
import RegistryGuide from "@/components/owner/Registry";
export default function Page() { return <Only roles={["owner", "office"]}><RegistryGuide /></Only>; }
