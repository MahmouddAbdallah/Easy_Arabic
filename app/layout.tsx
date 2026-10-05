import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { themeBootstrapScript } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { authorization } from "@/lib/verifyAuth";
import { AppProvider } from "@/components/AppContext";
import { Toaster } from "react-hot-toast";
import CallProvider from "@/components/chat/CallProvider";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Easy Arabic",
  description: `Easy Arabic this website is like exel and will work for you. this website has been designed to be table aligned with other languages, Mahmoud Ragab is the Admin of this website and he is can help family to find the best teacher for learning 
  if you want to learn more language please tell admin to immerse you in this website. 
  `,
  icons: {
    icon: "./favicon.svg"
  }
};

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
          <CallProvider>
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
          </CallProvider>
        </AppProvider>
      </body>
    </html>
  );
}
