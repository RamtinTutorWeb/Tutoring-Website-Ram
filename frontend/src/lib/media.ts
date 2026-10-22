/** How to show a video URL: an embeddable player (YouTube/Vimeo), a <video> file, or just a link. */
export type VideoSource =
  | { type: "embed"; src: string }
  | { type: "file"; src: string }
  | { type: "link"; src: string };

export function videoSource(raw: string): VideoSource | null {
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const youtubeId =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : host.endsWith("youtube.com")
        ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null
        : null;
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { type: "embed", src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0` };
  }
  const vimeoId = host.endsWith("vimeo.com") ? url.pathname.match(/\/(\d{5,12})(?:\/|$)/)?.[1] : null;
  if (vimeoId) return { type: "embed", src: `https://player.vimeo.com/video/${vimeoId}` };
  if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) return { type: "file", src: url.toString() };
  return { type: "link", src: url.toString() };
}
