import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const description = "Qubo is a self-hosted site builder and back office: a visual editor, catalogue, orders and inbox for every site you run, on your own server.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Qubo: your sites, your server", template: "%s · Qubo" },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Qubo", title: "Qubo: your sites, your server", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Qubo", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
