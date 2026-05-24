import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { PageLogoWatermark } from "@/components/brand/page-logo-watermark";
import { ThemedToaster } from "@/components/theme/themed-toaster";

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
      suppressHydrationWarning
      className={`${poppins.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem("cart2barrel-interface-color");if(c&&c!=="default")document.documentElement.setAttribute("data-interface-color",c);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${poppins.className} min-h-full flex flex-col bg-background text-foreground`}
      >
        <AppProviders>
          <PageLogoWatermark />
          <div className="relative z-[1] flex min-h-full flex-1 flex-col">
            {children}
          </div>
          <ThemedToaster />
        </AppProviders>
      </body>
    </html>
  );
}
