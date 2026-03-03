const seoConfig = {
  metadataBase: new URL("https://github.com/GitCroque/thymely"),
  title: {
    template: "Thymely",
    default:
      "Thymely - Open Source Helpdesk & Ticket Management.",
  },
  description:
    "Thymely is an open source helpdesk and ticket management solution. Self-hosted and fully featured.",
  themeColor: "#F6E458",
  openGraph: {
    images: "/og-image.png",
    url: "https://github.com/GitCroque/thymely",
  },
  manifest: "/site.webmanifest",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
    { rel: "mask-icon", url: "/favicon.ico" },
    { rel: "image/x-icon", url: "/favicon.ico" },
  ],
  twitter: {
    site: "@potts_dev",
    creator: "@potts_dev",
  },
};

export default seoConfig;
