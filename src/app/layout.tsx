import type { Metadata } from "next";
import { Cairo, Playfair_Display } from "next/font/google";
import { ToastProvider } from "@/context/ToastContext";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "عبايات مفيد | Abaya Mofid",
  description: "متجر عبايات وحقائب فاخرة بتصاميم عصرية وأنيقة",

  themeColor: "#0c0c0c",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
};

import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider } from "@/context/ThemeContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${playfair.variable}`} data-scroll-behavior="smooth">
      <body className={cairo.className}>
        <ThemeProvider>
          <SettingsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
