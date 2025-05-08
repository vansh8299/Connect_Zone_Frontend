// Example of how to integrate the SocketProvider in your app layout
// app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ApolloWrapper from "@/components/apollo-wrapper";
import { SocketProvider } from "@/utils/SocketContext";
import Header from "@/components/header";
import Footer from "@/components/footer";
// Import the debug component for development

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Connect_Zone",
  description: "Chat Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ApolloWrapper>
          <SocketProvider>
            <Header />
            {children}
            <Footer />
            
          </SocketProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}