import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hdbpricing.vercel.app"),
  title: "HDB Pricing | Explore Recent HDB Resale Prices in Singapore",
  description:
    "Explore recent HDB resale flat prices across Singapore on an interactive map. Browse past-year transaction data by town, block and flat type.",
  keywords: [
    "HDB resale prices",
    "HDB resale price map",
    "HDB resale transactions",
    "Singapore HDB resale prices",
    "resale flat prices Singapore",
    "HDB transaction history",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "HDB Pricing | Recent HDB Resale Prices, Mapped",
    description:
      "Explore recent HDB resale transactions across Singapore with an interactive map.",
    url: "https://hdbpricing.vercel.app",
    siteName: "HDB Pricing",
    locale: "en_SG",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "HDB Pricing — Recent HDB resale prices, mapped" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HDB Pricing | Recent HDB Resale Prices, Mapped",
    description:
      "Explore recent HDB resale transactions across Singapore with an interactive map.",
    images: ["/opengraph-image"],
  },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,600;0,14..32,700;1,14..32,300;1,14..32,400;1,14..32,600;1,14..32,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children} 
        <Analytics/>
      </body>
    </html>
  );
}
