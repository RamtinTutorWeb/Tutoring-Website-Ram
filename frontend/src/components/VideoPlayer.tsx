import { videoSource } from "../lib/media";

/** YouTube/Vimeo embed, a native player for video files, or a plain link for anything else. */
export default function VideoPlayer({ url, title }: { url: string; title: string }) {
  const source = videoSource(url);
  if (!source) return null;
  if (source.type === "embed") {
    return (
      <div className="video-frame">
        <iframe
          src={source.src}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }
  if (source.type === "file") {
    return (
      <div className="video-frame">
        <video controls preload="metadata" src={source.src} title={title} />
      </div>
    );
  }
  return <a className="button-link" href={source.src} target="_blank" rel="noreferrer">Watch video ↗</a>;
}
