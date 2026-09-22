import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/components/providers/data-provider";

export const metadata: Metadata = {
  title: { default: "Dhanvi Silks · Saree Commerce & Inventory", template: "%s · Dhanvi Silks" },
  description: "Enter your saree once. It becomes inventory, a POS product, a website product and a WhatsApp product.",
};

export const viewport: Viewport = {
  themeColor: "#fbf9f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <TooltipProvider delayDuration={250}>
          <DataProvider>{children}</DataProvider>
        </TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
