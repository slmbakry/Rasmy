"use client";
import { useParams } from "next/navigation";
import ShareView from "@/components/ShareView";
export default function Page() { const { token } = useParams<{ token: string }>(); return <ShareView token={token} />; }
