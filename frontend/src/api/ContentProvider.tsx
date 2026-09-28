import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { defaultSelectableOptions } from "../data/defaults";
import { useSession } from "../auth/session";
import { useApi, useResource } from "./hooks";
import { useMe } from "./MeProvider";
import type { SiteContent } from "./types";

/** `PUT /content` payload. Reviews have their own routes (`/reviews`); the backend rejects them here. */
export type ContentPatch = Partial<Omit<SiteContent, "reviews">>;

interface ContentValue {
  /** Server content, or empty lists (with default form options) until `GET /content` resolves. */
  content: SiteContent;
  loaded: boolean;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  /** Admin only: `PUT /content` with the changed keys. */
  save: (patch: ContentPatch) => Promise<SiteContent>;
  /** Apply a change already persisted through another route (e.g. `/reviews`) to the cached content. */
  update: (change: (content: SiteContent) => SiteContent) => void;
}

const emptyContent: SiteContent = {
  courses: [],
  examPrepTracks: [],
  reviews: [],
  faq: [],
  selectableOptions: defaultSelectableOptions
};

const ContentContext = createContext<ContentValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const session = useSession();
  const { me, error: meError } = useMe();
  // GET /content includes pending reviews only for admins, so refetch whenever the viewer or their
  // role changes. While a signed-in viewer's role is still loading, hold (null) instead of fetching twice.
  const viewerKey = !session.isLoaded
    ? null
    : !session.isSignedIn
      ? "anon"
      : me
        ? `${me.id}|${me.role}`
        : meError
          ? `${session.userId ?? ""}|unknown`
          : null;
  const resource = useResource<SiteContent>("/content", viewerKey);
  const { setData } = resource;

  const save = useCallback(async (patch: ContentPatch) => {
    const updated = await api.put<SiteContent>("/content", patch);
    setData(() => updated);
    return updated;
  }, [api, setData]);

  const update = useCallback((change: (content: SiteContent) => SiteContent) => {
    setData((current) => (current ? change(current) : current));
  }, [setData]);

  const value = useMemo<ContentValue>(() => {
    const data = resource.data;
    const content: SiteContent = data
      ? { ...emptyContent, ...data, selectableOptions: { ...defaultSelectableOptions, ...data.selectableOptions } }
      : emptyContent;
    return {
      content,
      loaded: data !== null,
      loading: resource.loading,
      error: resource.error,
      refetch: resource.refetch,
      save,
      update
    };
  }, [resource.data, resource.loading, resource.error, resource.refetch, save, update]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentValue {
  const value = useContext(ContentContext);
  if (!value) throw new Error("useContent must be used inside <ContentProvider>.");
  return value;
}
