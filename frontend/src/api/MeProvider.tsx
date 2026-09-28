import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useSession } from "../auth/session";
import { useApi, useResource } from "./hooks";
import type { Profile } from "./types";

interface MeValue {
  me: Profile | null;
  /** True while the session or `GET /me` is still resolving. */
  loading: boolean;
  error: string;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  update: (patch: { fullName?: string; phone?: string }) => Promise<Profile>;
}

const MeContext = createContext<MeValue | null>(null);

/** Loads the signed-in user's profile (and role) once and shares it app-wide. */
export function MeProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const api = useApi();
  const resource = useResource<Profile>(session.isSignedIn ? "/me" : null);
  const { setData } = resource;

  const update = useCallback(async (patch: { fullName?: string; phone?: string }) => {
    const updated = await api.patch<Profile>("/me", patch);
    setData(() => updated);
    return updated;
  }, [api, setData]);

  const value = useMemo<MeValue>(() => ({
    me: session.isSignedIn ? resource.data : null,
    loading: !session.isLoaded || (session.isSignedIn && (resource.loading || (!resource.data && !resource.error))),
    error: resource.error,
    isAdmin: session.isSignedIn && resource.data?.role === "admin",
    refetch: resource.refetch,
    update
  }), [session.isLoaded, session.isSignedIn, resource.data, resource.loading, resource.error, resource.refetch, update]);

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeValue {
  const value = useContext(MeContext);
  if (!value) throw new Error("useMe must be used inside <MeProvider>.");
  return value;
}
