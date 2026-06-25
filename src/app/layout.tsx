import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "@/components/sw-register";

export const metadata: Metadata = {
  title: "Command Board",
  description: "Your personal work command board.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Command Board" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0e1116",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
