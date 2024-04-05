import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./component/Navbar";
import axios from "axios";
import AppContextProvider from "./context/appContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Easy Arabic",
  description: "Easy Arabic",
};
axios.defaults.baseURL = 'http://localhost:3000';
axios.defaults.withCredentials = true;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppContextProvider>
          <Navbar />
          <main>
            {children}
          </main>
        </AppContextProvider>
      </body>
    </html>
  );
}
