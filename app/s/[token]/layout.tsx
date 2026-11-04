import type { Metadata } from "next";
// Share pages are for whoever has the link, never for search engines.
export const metadata: Metadata = { title: "مستندات مشاركة", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
