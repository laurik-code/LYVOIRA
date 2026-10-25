
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html lang="sk" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
