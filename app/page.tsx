import Link from "next/link";
import { ArrowRight, BarChart3, Contact, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  {
    title: "Registros de clientes unificados",
    description: "Centraliza notas, correos electrónicos e historial de acuerdos para que tu equipo esté siempre alineado.",
    icon: Contact,
  },
  {
    title: "Flujos de trabajo automatizados",
    description: "Activa seguimientos y recordatorios en el momento en que cambian los hitos del pipeline.",
    icon: Sparkles,
  },
  {
    title: "Información en tiempo real",
    description: "Pronostica ingresos con confianza utilizando paneles visuales y puntuaciones de salud.",
    icon: BarChart3,
  },
];

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/40">
      <main className="flex flex-1 flex-col items-center px-6 pb-24 pt-24 sm:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            CRM de confianza para equipos de alto rendimiento
          </span>
          <h1 className="mt-8 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Genera impulso con cada conversación con el cliente.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            CRM Ganamos ofrece a los equipos de ventas y éxito un espacio de trabajo compartido para organizar acuerdos, automatizar seguimientos y ofrecer experiencias ganadoras.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="px-8">
              <Link href="/register">
                Iniciar prueba gratuita
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
        <div className="mt-20 grid w-full max-w-5xl gap-6 md:grid-cols-3">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="border-border/80 bg-background/80 backdrop-blur">
              <CardContent className="space-y-4 p-6">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <benefit.icon className="size-5" />
                </div>
                <div className="space-y-2 text-left">
                  <h2 className="text-lg font-semibold text-foreground">{benefit.title}</h2>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <footer className="border-t border-border/70 bg-background/80 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {currentYear} CRM Ganamos. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <Link href="/login" className="transition hover:text-foreground">
              Iniciar sesión
            </Link>
            <Link href="/register" className="transition hover:text-foreground">
              Registrarse
            </Link>
            <Link href="#" className="transition hover:text-foreground">
              Privacidad
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
