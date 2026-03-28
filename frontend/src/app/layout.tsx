import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Play The City",
  description: "Vivi la città da player, non da turista.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6C3CE1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="font-sans min-h-screen">
        <main className="max-w-md mx-auto min-h-screen relative">
          {children}
        </main>
      </body>
    </html>
  );
}
