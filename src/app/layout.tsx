import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Source_Sans_3, Syne } from "next/font/google";
import "./globals.css";
import { getViewer } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HUSTL — hire other UW students",
  description:
    "A campus-only marketplace where UW students hire other UW students for photography, design, video, music and tutoring.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c9a227",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="en" className={`${sourceSans.variable} ${syne.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <AppShell viewer={viewer}>{children}</AppShell>
      </body>
    </html>
  );
}
