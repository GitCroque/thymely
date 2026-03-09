import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Globe,
  Inbox,
  Languages,
  Lock,
  Server,
  Shield,
  Webhook,
} from "lucide-react";

const navigation = [
  { name: "GitHub", href: "https://github.com/GitCroque/thymely" },
  { name: "Docs", href: "/docs" },
];

const features = [
  {
    name: "Ticket Management",
    description:
      "Create, assign, track, and close tickets. Time tracking, priorities, and file attachments included.",
    icon: Inbox,
  },
  {
    name: "Email Integration",
    description:
      "Connect mailboxes via IMAP/SMTP to automatically convert incoming emails into tickets.",
    icon: Bell,
  },
  {
    name: "OIDC & OAuth Authentication",
    description:
      "Single sign-on with your existing identity provider. Local auth with bcrypt also supported.",
    icon: Lock,
  },
  {
    name: "Webhooks & Notifications",
    description:
      "Connect to Slack, Discord, or any service via webhooks. Email notifications built-in.",
    icon: Webhook,
  },
  {
    name: "Roles & Permissions",
    description:
      "Granular RBAC system to control who can access what. Audit logging for compliance.",
    icon: Shield,
  },
  {
    name: "18 Languages",
    description:
      "Fully translated interface in 18 languages. Community-driven translations.",
    icon: Languages,
  },
  {
    name: "Self-Hosted",
    description:
      "Your data stays on your server. No external transfers, no vendor lock-in.",
    icon: Server,
  },
  {
    name: "Lightweight",
    description:
      "Runs on minimal hardware. A small VPS or even a Raspberry Pi is enough.",
    icon: Globe,
  },
];

const dockerCompose = `services:
  thymely:
    image: ghcr.io/gitcroque/thymely:latest
    ports:
      - "5003:5003"
    env_file: .env
    depends_on:
      - db
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    env_file: .env

volumes:
  pgdata:`;

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="mx-auto max-w-3xl px-6">
        <nav className="flex items-center justify-between py-8" aria-label="Global">
          <Link href="/" className="text-2xl font-bold">
            🍵
          </Link>
          <div className="flex items-center gap-x-8">
            {navigation.map((item) =>
              item.href.startsWith("http") ? (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 hover:text-green-600"
                >
                  {item.name}
                </a>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-semibold text-gray-900 hover:text-green-600"
                >
                  {item.name}
                </Link>
              ),
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-3xl px-6">
        <section className="pb-12 pt-4">
          <a
            href="https://github.com/GitCroque/thymely/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20"
          >
            v0.8.2
          </a>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Open-source helpdesk for small teams
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Thymely is a free, self-hosted ticket management system. A simple alternative
            to Zammad, osTicket, and FreeScout — deploy in minutes with Docker.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a
              href="https://github.com/GitCroque/thymely"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-green-600 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
            >
              Get started
            </a>
            <Link
              href="/docs"
              className="rounded-md bg-white px-5 py-2.5 text-center text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Documentation
            </Link>
          </div>

          <div className="relative mt-12 aspect-[16/10] w-full overflow-hidden rounded-lg shadow-lg">
            <Image
              src="/screenshots/dashboard.png"
              alt="Thymely dashboard showing open tickets"
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              priority
              className="object-cover"
            />
          </div>
        </section>

        {/* Features */}
        <section className="py-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Features</h2>
          <dl className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.name}>
                <dt className="flex items-center gap-x-3 text-base font-semibold text-gray-900">
                  <feature.icon
                    className="h-5 w-5 flex-none text-green-600"
                    aria-hidden="true"
                  />
                  {feature.name}
                </dt>
                <dd className="mt-2 text-sm text-gray-600">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Screenshots */}
        <section className="py-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            In action
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { src: "/screenshots/new-ticket.png", alt: "New ticket form" },
              { src: "/screenshots/issues.png", alt: "Issues list view" },
              { src: "/screenshots/admin.png", alt: "Admin settings panel" },
            ].map((img) => (
              <div
                key={img.src}
                className="relative aspect-[16/10] overflow-hidden rounded-lg shadow-md"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 384px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Docker quickstart */}
        <section className="py-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Quick start with Docker
          </h2>
          <p className="mt-4 text-base text-gray-600">
            Create a <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono">docker-compose.yml</code> and
            a <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono">.env</code> file, then
            run <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono">docker compose up -d</code>.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-gray-900 p-6 text-sm leading-relaxed text-gray-100">
            <code>{dockerCompose}</code>
          </pre>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-500">
              &copy; 2026 Thymely. Licensed under AGPL-3.0.
            </p>
            <div className="flex gap-6">
              <a
                href="https://github.com/GitCroque/thymely"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-green-600"
              >
                GitHub
              </a>
              <a
                href="https://mastodon.social/@jugue"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-green-600"
              >
                Mastodon
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
