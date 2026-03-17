import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast/ToastProvider";
import { CartProvider } from "@/context/CartContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { AdminLayout } from "@/components/AdminLayout/AdminLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZapZap Delivery Admin",
  description: "Painel Administrativo",
  applicationName: "ZapZap Delivery",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ZapZap Delivery",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} style={{ margin: 0, padding: 0, backgroundColor: '#f3f4f6' }} suppressHydrationWarning>
        <ToastProvider>
          <NotificationProvider>
            <CartProvider>
              <AdminLayout>
                {children}
              </AdminLayout>
            </CartProvider>
          </NotificationProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
