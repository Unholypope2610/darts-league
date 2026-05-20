import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono, Geist } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { QueryProvider } from "@/providers/QueryProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Darts League",
  description: "Darts league management and live scoring",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Darts League",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#10b981",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
        <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
          <ThemeProvider>
            <QueryProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
