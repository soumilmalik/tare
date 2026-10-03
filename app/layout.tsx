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
    // Not "black-translucent": iOS then gives home-screen apps a viewport one
    // status bar short at the bottom. The app is black, so this looks the same.
    statusBarStyle: "black",
  },
  formatDetection: { telephone: false },
  // Older iOS versions only apply the status bar style with Apple's original tag.
  other: { "apple-mobile-web-app-capable": "yes" },
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
