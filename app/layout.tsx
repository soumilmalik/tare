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

// iOS home-screen apps that draw under the status bar report a viewport about
// one status bar shorter than the screen, leaving a black gap at the bottom.
// Size the app to the real screen height there, before the first paint.
const fullHeightScript = `(function(){function s(){var a=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;var h=a?Math.max(window.innerHeight,screen.height):window.innerHeight;document.documentElement.style.setProperty("--app-h",h+"px")}s();addEventListener("resize",s);addEventListener("orientationchange",s)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fullHeightScript }} />
      </head>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; ignore those. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
