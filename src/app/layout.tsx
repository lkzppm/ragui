import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Nav } from "@/components/site/nav";
import LocaleProvider from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { THEME_SCRIPT } from "@/lib/use-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.name,
  description:
    "A sandbox for building a RAG about anything: documents are chunked, embedded and searched in the browser, and every step of the pipeline is on screen.",
};

// The on-screen keyboard shrinks the layout (Chrome on Android), keeping the question field in view.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` follows the visitor's choice after hydration (LocaleProvider), and
    // the `dark` class is set before the first paint by the script below.
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <LocaleProvider>
          <Nav />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
