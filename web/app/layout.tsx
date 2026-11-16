import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Shell from "./components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home · HCM practice",
  description: "Practice environment with fictional people and data. Not connected to Oracle.",
  icons: {
    icon: [
      { url: "/img/favicon.svg", type: "image/svg+xml" },
      { url: "/img/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF9F8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
