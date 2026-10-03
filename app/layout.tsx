import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Tare",
  title: "Tare",
  description: "Track calories, protein and water.",
  appleWebApp: {
    capable: true,
    title: "Tare",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; ignore those. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
