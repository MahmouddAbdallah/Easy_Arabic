import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./component/Navbar";
import axios from "axios";
import AppContextProvider from "./context/appContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Easy Arabic",
  description: `Easy Arabic this website is like exel and will work for you. this website has been designed to be table aligned with other languages, Mahmoud Ragab is the Admin of this website and he is can help family to find the best teacher for learning 
  if you want to learn more language please tell admin to immerse you in this website. 
  `,
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
