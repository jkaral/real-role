import { ImageResponse } from "next/og";

export const alt = "Real Role: is this job still hiring?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  ["Posting age", "Posted 3 days ago", 92],
  ["Careers page", "Listed on the employer's job board", 100],
  ["Description detail", "Pay range, team and duties listed", 80],
] as const;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 72,
        gap: 56,
        alignItems: "center",
        background: "linear-gradient(135deg, #f6f8f7 0%, #e3f1eb 60%, #fbf0d9 100%)",
        fontFamily: "sans-serif",
        color: "#0f1f1a",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#1d6b52",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Real Role
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 36, lineHeight: 1.05 }}>
          Is this job still hiring?
        </div>
        <div style={{ fontSize: 30, marginTop: 24, color: "#3c5249" }}>
          A Freshness Score for any job posting, with the signals behind it.
        </div>
      </div>
      <div
        style={{
          width: 420,
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 28,
          padding: 32,
          boxShadow: "0 20px 50px -20px rgba(15,31,26,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              border: "10px solid #1d7a4f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            91
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, color: "#5f716a" }}>Example (fictional)</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#1d7a4f" }}>High freshness</div>
          </div>
        </div>
        {ROWS.map(([label, detail, pct]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 16, color: "#3c5249" }}>{detail}</div>
            <div
              style={{
                display: "flex",
                height: 8,
                marginTop: 8,
                borderRadius: 4,
                background: "#e4ebe7",
              }}
            >
              <div style={{ width: `${pct}%`, background: "#1d6b52", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
