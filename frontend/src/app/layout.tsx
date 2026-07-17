import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProviders } from "@/components/RootProviders";
import { AuthProvider } from "@/modules/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task SME",
  description: "Next.js + Express + PostgreSQL task management web app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/TaskSME.png",
    apple: "/TaskSME.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AuthProvider>
          <RootProviders>{children}</RootProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
