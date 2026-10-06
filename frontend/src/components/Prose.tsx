/** Plain admin-entered text: blank lines split paragraphs, single newlines are kept. No HTML. */
export default function Prose({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className={`prose ${className}`.trim()}>
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </div>
  );
}
