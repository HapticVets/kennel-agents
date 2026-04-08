import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kennel Agents",
  description: "Phase 1 admin dashboard for kennel health monitoring."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
