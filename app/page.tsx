"use client";
import { useSession } from "@/components/session";
import { useCompanies } from "@/components/companies";
import { AdminHome } from "@/components/admin/Admin";
import { OfficeHome } from "@/components/office/Office";
import OwnerHome from "@/components/owner/Home";

function Owner() {
  const { list, current } = useCompanies();
  return list ? <OwnerHome companyId={current?.id} /> : null;
}

export default function Home() {
  const { role } = useSession();
  return role === "admin" ? <AdminHome /> : role === "office" ? <OfficeHome /> : <Owner />;
}
