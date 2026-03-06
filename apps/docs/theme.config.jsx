const config = {
  logo: "Thymely",
  project: { link: "https://github.com/GitCroque/thymely" },
  docsRepositoryBase: "https://github.com/GitCroque/thymely",
  sidebar: {
    defaultMenuCollapseLevel: 2,
    toggleButton: false,
  },
  chat: {
    link: "https://discord.gg/X9yFbcV2rF",
  },
  footer: {
    content: "",
  },
  banner: {
    key: "release",
    content: (
      <a href="https://github.com/GitCroque/thymely/releases" target="_blank">
        Thymely - Check out the latest release!
      </a>
    ),
  },
  head: (
    <>
      <meta httpEquiv="Content-Language" content="en" />
      <meta
        name="description"
        content="Thymely is an open source helpdesk and ticket management solution."
      />
      <meta name="og:title" content="Thymely Docs" />
      <meta
        name="og:description"
        content="Thymely is an open source helpdesk and ticket management solution."
      />
      <meta name="apple-mobile-web-app-title" content="Thymely" />
    </>
  ),
};

export default config;
