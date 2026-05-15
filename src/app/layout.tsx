import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { Toaster } from "sonner";

import { AppProviders } from "./providers";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Cart2Barrel",
  description: "Shop abroad — we consolidate and ship to Jamaica.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${poppins.variable} h-full antialiased`}
    >
      <body
        className={`${poppins.className} min-h-full flex flex-col bg-background text-foreground`}
      >
        <AppProviders>
          {children}
          <Toaster richColors closeButton theme="dark" />
        </AppProviders>
      </body>
    </html>
  );
}
