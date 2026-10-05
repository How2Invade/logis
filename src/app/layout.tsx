import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "LOGIS — Product Incident Intelligence & Operational Recovery",
  description: "Understand the impact. Act precisely. Recover faster. LOGIS is an operational decision engine for product incident response and recovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: 'bg-surface border-border text-foreground',
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
