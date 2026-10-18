import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getViewer } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "HUSTL — hire other UW students",
  description:
    "A campus-only marketplace where UW students hire other UW students for photography, design, video, music and tutoring.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5b2bd9",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <AppShell viewer={viewer}>{children}</AppShell>
      </body>
    </html>
  );
}
