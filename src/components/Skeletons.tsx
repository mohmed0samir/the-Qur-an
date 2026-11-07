export function ListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="list-grid" aria-busy="true" aria-live="polite">
      <span className="sr-only">جارٍ التحميل…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i} aria-hidden="true">
          <span className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <span style={{ display: "grid", gap: 8 }}>
            <span className="skeleton" style={{ height: 18, width: `${50 + ((i * 13) % 35)}%` }} />
            <span className="skeleton" style={{ height: 11, width: "30%" }} />
          </span>
          <span className="skeleton" style={{ height: 14, width: 50 }} />
        </div>
      ))}
    </div>
  );
}

export function ReaderSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" style={{ padding: "1rem 0.5rem" }}>
      <span className="sr-only">جارٍ تحميل الآيات…</span>
      <div style={{ display: "grid", justifyItems: "center", gap: 12, margin: "1.5rem 0 2rem" }} aria-hidden="true">
        <span className="skeleton" style={{ height: 40, width: "55%", maxWidth: 320 }} />
        <span className="skeleton" style={{ height: 12, width: "35%", maxWidth: 200 }} />
      </div>
      <div style={{ display: "grid", gap: 26 }} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="skeleton" style={{ height: 22, width: `${i % 3 === 2 ? 70 : 100}%` }} />
        ))}
      </div>
    </div>
  );
}
