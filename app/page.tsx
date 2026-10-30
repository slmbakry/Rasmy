"use client";
import { useSession } from "@/components/session";
import { AdminHome } from "@/components/admin/Admin";
import { OfficeHome } from "@/components/office/Office";
import OwnerHome from "@/components/owner/Home";

export default function Home() {
  const { role } = useSession();
  return role === "admin" ? <AdminHome /> : role === "office" ? <OfficeHome /> : <OwnerHome />;
}
