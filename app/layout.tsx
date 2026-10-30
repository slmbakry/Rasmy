import type { Metadata, Viewport } from "next";
import { SessionProvider } from "@/components/session";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ورقك",
  description: "كل ورق شركتك في مكان واحد، ومحدش هيفوّت ميعاد تاني",
  robots: { index: false, follow: false },
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='16' fill='%230f2a44'/><path d='M22 14h14l10 10v26H22zM36 14v10h10M28 36l5 5 9-10' stroke='%231f9d74' stroke-width='4' fill='none' stroke-linejoin='round' stroke-linecap='round'/></svg>" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f2a44" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Readex+Pro:wght@500;600;700&display=swap" />
      </head>
      <body>
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
}
