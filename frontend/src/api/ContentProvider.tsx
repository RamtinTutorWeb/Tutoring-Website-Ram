import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { defaultSelectableOptions } from "../data/defaults";
import { useApi, useResource } from "./hooks";
import type { SiteContent } from "./types";

interface ContentValue {
  /** Server content, or empty lists (with default form options) until `GET /content` resolves. */
  content: SiteContent;
  loaded: boolean;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  /** Admin only: `PUT /content` with the changed keys. */
  save: (patch: Partial<SiteContent>) => Promise<SiteContent>;
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
  const resource = useResource<SiteContent>("/content");
  const { setData } = resource;

  const save = useCallback(async (patch: Partial<SiteContent>) => {
    const updated = await api.put<SiteContent>("/content", patch);
    setData(() => updated);
    return updated;
  }, [api, setData]);

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
      save
    };
  }, [resource.data, resource.loading, resource.error, resource.refetch, save]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentValue {
  const value = useContext(ContentContext);
  if (!value) throw new Error("useContent must be used inside <ContentProvider>.");
  return value;
}
