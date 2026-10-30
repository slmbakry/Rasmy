"use client";
// A screen for some roles only; anyone else lands on their own home.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession, type Role } from "./session";
import { Loading } from "./ui";

export default function Only({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { role } = useSession();
  const router = useRouter();
  const allowed = roles.includes(role);
  useEffect(() => { if (!allowed) router.replace("/"); }, [allowed, router]);
  return allowed ? <>{children}</> : <Loading />;
}
