import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Autenticación | CRM Ganamos",
  description:
    "Accedé a tu cuenta de CRM Ganamos para mantener tus oportunidades, contactos y actividades organizadas.",
};

const highlights = [
  {
    title: "Embudos de venta claros",
    description: "Seguí tus oportunidades sin planillas ni notas adhesivas.",
  },
  {
    title: "Recordatorios inteligentes",
    description:
      "Mantené el contacto con avisos automáticos para cada relación.",
  },
  {
    title: "Visibilidad en equipo",
    description: "Compartí avances y colaborá en tiempo real.",
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
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-700 via-purple-800 to-black p-12 text-primary-foreground lg:flex">
        <div className="relative z-10 flex items-center justify-between text-sm text-primary-foreground/70">
          <Link
            href="/"
            className="font-semibold tracking-tight text-primary-foreground"
          >
            CRM Ganamos
          </Link>
          <span className="hidden rounded-full border border-primary-foreground/30 px-3 py-1 lg:inline-flex">
            CRM simple para equipos en crecimiento
          </span>
        </div>
        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
            Construí relaciones duraderas con tus clientes.
          </h1>
          <p className="text-base text-primary-foreground/80">
            Sumate a miles de equipos comerciales que centralizan sus datos,
            automatizan seguimientos y cierran más ventas con CRM Ganamos.
          </p>
          <ul className="space-y-5 text-sm text-primary-foreground/80">
            {highlights.map((highlight) => (
              <li
                key={highlight.title}
                className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur"
              >
                <p className="font-medium text-primary-foreground">
                  {highlight.title}
                </p>
                <p>{highlight.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-xs text-primary-foreground/70">
          © {currentYear} CRM Ganamos. Todos los derechos reservados.
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_60%)]" />
      </div>
      <div className="flex items-center justify-center px-6 py-12 sm:px-10 md:px-16">
        <div className="w-full max-w-md space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Bienvenido a CRM Ganamos
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingresá tus datos para iniciar sesión o crear una nueva cuenta.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
