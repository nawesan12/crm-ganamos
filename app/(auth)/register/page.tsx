import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Crear cuenta | CRM Ganamos",
  description:
    "Registrate en CRM Ganamos para empezar a gestionar oportunidades y relaciones.",
};

export default function RegisterPage() {
  return (
    <Card className="w-full border-border/80">
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Creá tu cuenta
        </CardTitle>
        <CardDescription>
          Empezá tu prueba gratis de 14 días. No necesitás tarjeta de crédito.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5">
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="firstName"
                className="text-sm font-medium text-foreground"
              >
                Nombre
              </label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                placeholder="María"
                required
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="lastName"
                className="text-sm font-medium text-foreground"
              >
                Apellido
              </label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                placeholder="Santos"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="company"
              className="text-sm font-medium text-foreground"
            >
              Nombre de la empresa
            </label>
            <Input
              id="company"
              name="company"
              autoComplete="organization"
              placeholder="Ganamos Ventures"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Correo de trabajo
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@empresa.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Contraseña
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Creá una contraseña segura"
              required
            />
          </div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <label className="flex items-start gap-2 text-left">
              <input
                type="checkbox"
                required
                className="mt-1 size-4 rounded border border-input"
              />
              <span>
                Acepto los{" "}
                <Link
                  href="#"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  Términos de Servicio
                </Link>{" "}
                y la{" "}
                <Link
                  href="#"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  Política de Privacidad
                </Link>
                .
              </span>
            </label>
          </div>
          <Button type="submit" className="w-full">
            <UserPlus className="size-4" />
            Crear cuenta
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <div>
          ¿Ya tenés una cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            Iniciar sesión
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/80">
          ¿Necesitás ayuda para incorporar a tu equipo?{" "}
          <Link
            href="#"
            className="font-medium text-primary hover:text-primary/80"
          >
            Hablá con ventas
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
