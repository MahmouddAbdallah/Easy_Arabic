import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { themeBootstrapScript } from "@/lib/theme";
import { cn } from 'cn'
import { authorization } from "@/lib/verifyAuth";
import { AppProvider } from "@/components/AppContext";
import { Toaster } from "react-hot-toast";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Easy Arabic",
  description: `Easy Arabic`,
  icons: {
    icon: "./favicon.png"
  }
};
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await authorization();

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AppProvider userData={user}>
          <main>
            {children}
          </main>
          <Toaster
            position={'bottom-right'}
            reverseOrder={false}
            gutter={12}
            toastOptions={{
              style: {
                background: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}
