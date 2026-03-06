import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata: Metadata = {
  title: "Thymely Docs",
  description:
    "Thymely is an open source helpdesk and ticket management solution.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Layout
          navbar={
            <Navbar
              logo={<span style={{ fontWeight: 700 }}>Thymely</span>}
              projectLink="https://github.com/GitCroque/thymely"
              chatLink="https://discord.gg/X9yFbcV2rF"
            />
          }
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/GitCroque/thymely"
          footer={<Footer>© {new Date().getFullYear()} Thymely</Footer>}
          banner={
            <a
              href="https://github.com/GitCroque/thymely/releases"
              target="_blank"
            >
              Thymely - Check out the latest release!
            </a>
          }
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
