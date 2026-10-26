import type { Metadata } from "next";
import {
  Playfair_Display,
  Hanken_Grotesk,
  Fira_Code,
  Fraunces,
  Geist,
  Geist_Mono,
  Tiro_Devanagari_Hindi,
  Mukta,
} from "next/font/google";
import Navbar from "@/components/Navbar";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

// Warm, characterful serif for the light "story" theme (Nayantara's world).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

// Dashboard chrome — the "solution operations" surface. Geist for UI, Geist Mono
// for tabular numerals/IDs. Deliberately distinct from the story/marketing type.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const tiroDeva = Tiro_Devanagari_Hindi({
  variable: "--font-tiro-deva",
  subsets: ["devanagari", "latin"],
  weight: "400",
  display: "swap",
});

const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "REX — Revenue Execution Engine",
  description:
    "Bounded, auditable, autonomous — recovering failed payments across the entire network.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${hanken.variable} ${firaCode.variable} ${fraunces.variable} ${geist.variable} ${geistMono.variable} ${tiroDeva.variable} ${mukta.variable}`}
    >
      <body className="min-h-screen bg-void text-fg">
        <LocaleProvider>
          <Navbar />
          {children}
        </LocaleProvider>
        {/* Cinematic atmosphere overlays */}
        <div className="vignette" aria-hidden />
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
