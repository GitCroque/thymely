//@ts-nocheck
import "@radix-ui/themes/styles.css";
import "../styles/globals.css";

import { ThemeProvider } from "next-themes";

import dynamic from "next/dynamic";
import { Theme } from "@radix-ui/themes";
import { useRouter } from "next/router";
import { QueryClient, QueryClientProvider } from "react-query";

import { SessionProvider, useUser } from "../store/session";

import React from "react";

const AdminLayout = dynamic(() => import("../layouts/adminLayout"));
const PortalLayout = dynamic(() => import("../layouts/portalLayout"));
const Settings = dynamic(() => import("../layouts/settings"));
const ShadLayout = dynamic(() => import("../layouts/shad"));
const Toaster = dynamic(
  () => import("@/shadcn/ui/toaster").then((mod) => mod.Toaster),
  { ssr: false }
);

const queryClient = new QueryClient();

function Auth({ children }: any) {
  const { user } = useUser();

  if (user) {
    return children;
  }

  return (
    <div className="flex h-screen justify-center items-center text-green-600"></div>
  );
}

function MyApp({ Component, pageProps }: any) {
  const router = useRouter();

  if (router.pathname.startsWith("/auth")) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light">
        <Component {...pageProps} />
        <Toaster />
      </ThemeProvider>
    );
  }

  if (router.pathname.includes("/admin")) {
    return (
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Theme>
            <QueryClientProvider client={queryClient}>
              <Auth>
                <AdminLayout>
                  <Component {...pageProps} />
                  <Toaster />
                </AdminLayout>
              </Auth>
            </QueryClientProvider>
          </Theme>
        </ThemeProvider>
      </SessionProvider>
    );
  }

  if (router.pathname.includes("/settings")) {
    return (
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Theme>
            <QueryClientProvider client={queryClient}>
              <Auth>
                <ShadLayout>
                  <Settings>
                    <Component {...pageProps} />
                    <Toaster />
                  </Settings>
                </ShadLayout>
              </Auth>
            </QueryClientProvider>
          </Theme>
        </ThemeProvider>
      </SessionProvider>
    );
  }

  if (router.pathname.startsWith("/portal")) {
    return (
      <SessionProvider>
        <Theme>
          <QueryClientProvider client={queryClient}>
            <Auth>
              <PortalLayout>
                <Component {...pageProps} />
                <Toaster />
              </PortalLayout>
            </Auth>
          </QueryClientProvider>
        </Theme>
      </SessionProvider>
    );
  }

  if (router.pathname === "/onboarding") {
    return (
      <SessionProvider>
        <Component {...pageProps} />
        <Toaster />
      </SessionProvider>
    );
  }

  if (router.pathname === "/submit") {
    return (
      <>
        <Component {...pageProps} />
        <Toaster />
      </>
    );
  }

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light">
        <Theme>
          <QueryClientProvider client={queryClient}>
            <Auth>
              <ShadLayout>
                <Component {...pageProps} />
                <Toaster />
              </ShadLayout>
            </Auth>
          </QueryClientProvider>
        </Theme>
      </ThemeProvider>
    </SessionProvider>
  );
}

export default MyApp;
