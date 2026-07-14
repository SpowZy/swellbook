import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Swellbook, stays with a story",
  description:
    "A working demo of a zero-commission discovery and booking platform for surf camps, retreats and small lodges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-canvas/90 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              swellbook<span className="text-coral">.</span>
            </Link>
            <nav className="flex items-center gap-1.5 text-sm font-medium sm:gap-2">
              <Link
                href="/"
                className="rounded-full px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-sand hover:text-ink sm:px-3"
              >
                Explore
              </Link>
              <Link
                href="/host"
                className="rounded-full bg-ink px-4 py-1.5 text-canvas transition-colors hover:bg-ocean-deep"
              >
                Become a host
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line bg-sand/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-ink-soft sm:px-6">
            <p>
              Swellbook is a working demo built by SpowZy as his founding-engineer
              application to bluepina. Every listing here is fictional, every booking is real inside
              the demo database.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
