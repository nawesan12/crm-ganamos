import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Authentication | CRM Ganamos",
  description:
    "Access your CRM Ganamos account to keep deals, contacts, and activities organized.",
};

const highlights = [
  {
    title: "Clear deal pipelines",
    description: "Track opportunities without spreadsheets or sticky notes.",
  },
  {
    title: "Intelligent reminders",
    description: "Stay in touch with automated nudges for every relationship.",
  },
  {
    title: "Team-wide visibility",
    description: "Share progress updates and collaborate in real time.",
  },
];

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-12 text-primary-foreground lg:flex">
        <div className="relative z-10 flex items-center justify-between text-sm text-primary-foreground/70">
          <Link href="/" className="font-semibold tracking-tight text-primary-foreground">
            CRM Ganamos
          </Link>
          <span className="hidden rounded-full border border-primary-foreground/30 px-3 py-1 lg:inline-flex">
            Simple CRM for growing teams
          </span>
        </div>
        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
            Build lasting customer relationships.
          </h1>
          <p className="text-base text-primary-foreground/80">
            Join thousands of sales teams who centralize their data, automate follow-ups,
            and close more deals with CRM Ganamos.
          </p>
          <ul className="space-y-5 text-sm text-primary-foreground/80">
            {highlights.map((highlight) => (
              <li key={highlight.title} className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="font-medium text-primary-foreground">{highlight.title}</p>
                <p>{highlight.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-xs text-primary-foreground/70">
          © {currentYear} CRM Ganamos. All rights reserved.
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_60%)]" />
      </div>
      <div className="flex items-center justify-center px-6 py-12 sm:px-10 md:px-16">
        <div className="w-full max-w-md space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome to CRM Ganamos
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your details below to sign in or create a new account.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
