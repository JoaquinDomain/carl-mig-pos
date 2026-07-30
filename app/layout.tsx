import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carls-Mig POS",
  description: "Espresso & Laundry Hub POS System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}