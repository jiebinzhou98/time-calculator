import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppNav } from "@/components/app-nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tower Tools",
  description: "Your personal workspace for The Tower research and Wall survival",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tower Tools",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
        <AppNav/>
        <div className="console-content">{children}</div>
      </body>
    </html>
  );
}