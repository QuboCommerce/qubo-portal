import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Qubo Portal", template: "%s · Qubo Portal" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
