import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./ace.css";
export const metadata: Metadata = {
  title: "ACE Studio — Every file. One workspace.",
  description:
    "A private workspace for PDF tools, document conversion, image processing and conversational AI.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d13",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pixelforge-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:t==='system'&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch(e){}`,
          }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
