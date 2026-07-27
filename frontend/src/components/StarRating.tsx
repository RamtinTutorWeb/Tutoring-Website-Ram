export default function StarRating({ rating }: { rating: number }) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span className="rating-stars" aria-label={`${safe} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span className={index < safe ? "star-on" : "star-off"} key={index}>★</span>
      ))}
    </span>
  );
}
