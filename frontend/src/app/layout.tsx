import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import StoreProvider from "@/lib/providers/store-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fuel Optimizer",
  description: "Next.js frontend with reusable architecture and Redux store setup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full overflow-x-hidden font-sans text-foreground antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
