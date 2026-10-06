/** YouTube / Vimeo links become an embedded player; anything else is played as a video file. */
export function embedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = parsed.searchParams.get("v") ?? parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com") return url;
  } catch {
    return null;
  }
  return null;
}

export default function VideoEmbed({ url, title }: { url: string; title: string }) {
  if (!url) return null;
  const embed = embedUrl(url);
  return (
    <div className="video-wrap">
      {embed ? (
        <iframe src={embed} title={title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
      ) : (
        <video controls preload="metadata" src={url}>Your browser does not support the video tag.</video>
      )}
    </div>
  );
}
