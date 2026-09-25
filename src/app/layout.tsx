import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "../components/BottomNav";

export const metadata: Metadata = {
  title: "لوحة المتابعة",
  description: "إدارة جدول الحصص والاشتراكات الشهرية للطلاب",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "لوحة المتابعة",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
