"use client";
// Who is signed in, which role they act as, and the preview switch for admins.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { readSession, writeSession } from "@/lib/storage";

export type Role = "admin" | "owner" | "office";
export type Profile = { id: string; email: string; role: Role | null; office_id?: string | null; consent_at?: string | null };

type Session = {
  ready: boolean;
  profile: Profile | null;
  hasPassword: boolean;
  recovery: boolean;
  viewAs: Role;
  previewOffice: string | null;
  role: Role | null;
  isPreview: boolean;
  officeId: string | null;
  uid: string;
  setViewAs: (r: Role) => void;
  setPreviewOffice: (id: string | null) => void;
  setProfile: (p: Profile) => void;
  passwordSaved: () => void;
  toast: (msg: string, isError?: boolean) => void;
  bellVersion: number;
  refreshBell: () => void;
};

const Ctx = createContext<Session | null>(null);
export const useSession = () => useContext(Ctx)!;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [viewAs, setViewAsState] = useState<Role>("admin");
  const [previewOffice, setPreviewOfficeState] = useState<string | null>(null);
  const [bellVersion, setBellVersion] = useState(0);
  const [note, setNote] = useState<{ msg: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string, isError?: boolean) => {
    setNote({ msg, error: !!isError });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 3200);
  }, []);

  const load = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setProfileState(null); setHasPassword(true); setReady(true); return; }
    setHasPassword(!!session.user.user_metadata?.has_password);
    const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    const p: Profile = data || { id: session.user.id, email: session.user.email, role: null };
    const saved = readSession("rasmy-view-as") as Role;
    setViewAsState(p.role === "admin" && ["owner", "office"].includes(saved) ? saved : "admin");
    setPreviewOfficeState(readSession("rasmy-preview-office") || null);
    setProfileState(p);
    setReady(true);
  }, []);

  useEffect(() => {
    load();
    const { data: { subscription } } = sb.auth.onAuthStateChange((ev) => {
      if (ev === "TOKEN_REFRESHED" || ev === "INITIAL_SESSION") return;
      if (ev === "PASSWORD_RECOVERY") setRecovery(true);
      // Defer: awaiting Supabase calls inside this callback can deadlock.
      setTimeout(load, 0);
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const role: Role | null = profile?.role ? (profile.role === "admin" ? viewAs : profile.role) : null;
  const isPreview = profile?.role === "admin" && viewAs !== "admin";
  const officeId = (profile?.role === "admin" ? previewOffice : profile?.office_id) || null;

  const value: Session = {
    ready, profile, hasPassword, recovery, viewAs, previewOffice, role, isPreview, officeId, uid: profile?.id,
    setViewAs: (r) => { setViewAsState(r); writeSession("rasmy-view-as", r); },
    setPreviewOffice: (id) => { setPreviewOfficeState(id); writeSession("rasmy-preview-office", id || ""); },
    setProfile: setProfileState,
    passwordSaved: () => { setRecovery(false); setHasPassword(true); },
    toast, bellVersion, refreshBell: () => setBellVersion((v) => v + 1),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={"toast" + (note?.error ? " error" : "")} role="status" hidden={!note}>{note?.msg}</div>
    </Ctx.Provider>
  );
}

// Loads data for a screen and reloads when its inputs change.
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: unknown; reload: () => void } {
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});
  const [n, setN] = useState(0);
  const key = JSON.stringify(deps);
  const last = useRef(key);
  useEffect(() => {
    let live = true;
    // New inputs show the loader; a reload keeps the screen until fresh data arrives.
    if (last.current !== key) { last.current = key; setState({}); }
    fn().then((data) => live && setState({ data }), (error) => { console.error(error); if (live) setState({ error }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, n]);
  return { data: state.data, error: state.error, reload: () => setN((x) => x + 1) };
}
