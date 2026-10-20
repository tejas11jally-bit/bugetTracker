import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { getUserOrNull } from "@/lib/auth";
import ServiceWorker from "@/components/service-worker";

export const metadata: Metadata = {
  title: "Ledgerly",
  description: "Self-hosted budget tracker",
  appleWebApp: { capable: true, title: "Ledgerly", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

// Applies "system" theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=document.documentElement.dataset.theme;var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})()`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getUserOrNull().catch(() => null);
  const theme = user?.theme ?? "system";
  const accent = user?.accent ?? "#0f766e";
  return (
    <html lang="en-GB" data-theme={theme} className={theme === "dark" ? "dark" : ""} style={{ "--accent": accent } as CSSProperties} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
