// Session settings that survive a reload in the same tab.
export function readSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
export function writeSession(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch {}
}

// Old links (in notifications and bookmarks) used hash routes; map them to paths.
export function pathFor(link?: string | null): string {
  if (!link) return "/";
  if (!link.startsWith("#")) return link;
  const [name, arg] = link.slice(1).split("/");
  const map: Record<string, string> = {
    home: arg ? `/companies/${arg}` : "/", request: `/requests/${arg}`, job: `/office/jobs/${arg}`, renew: `/renew/${arg}`,
    alerts: "/alerts", guide: "/guide", plan: "/plan", "company-new": "/companies/new", "doc-new": `/companies/${arg}/documents/new`,
    performance: "/admin/performance", invites: "/admin/invites", offices: "/admin/offices", prices: `/admin/offices/${arg}/prices`, users: "/admin/users",
  };
  return map[name] || "/";
}
