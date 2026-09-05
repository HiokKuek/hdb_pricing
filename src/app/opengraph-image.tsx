import { ImageResponse } from "next/og";

export const alt = "HDB Pricing — Recent HDB resale prices, mapped";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ background: "#f7f8f6", color: "#1d2b26", display: "flex", height: "100%", position: "relative", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "76px", width: "68%" }}>
          <div style={{ color: "#087f5b", display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>HDB Pricing</div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, letterSpacing: -3, lineHeight: 1.04, marginTop: 24 }}>Recent HDB resale prices, mapped</div>
          <div style={{ color: "#4b5d55", display: "flex", fontSize: 28, lineHeight: 1.35, marginTop: 28 }}>Explore recent public resale transactions across Singapore.</div>
        </div>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "center", position: "relative", width: "32%" }}>
          <div style={{ background: "#d9eee4", borderRadius: "44% 56% 47% 53% / 43% 44% 56% 57%", height: 390, transform: "rotate(-12deg)", width: 330 }} />
          <div style={{ border: "16px solid #087f5b", borderRadius: 999, height: 74, left: 105, position: "absolute", top: 190, width: 74 }} />
          <div style={{ border: "16px solid #e8590c", borderRadius: 999, height: 52, position: "absolute", right: 86, top: 313, width: 52 }} />
          <div style={{ background: "#0b6e4f", borderRadius: 999, bottom: 150, height: 42, left: 124, position: "absolute", width: 42 }} />
        </div>
      </div>
    ),
    size,
  );
}
