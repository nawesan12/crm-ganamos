import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";

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
  title: "Iniciar sesión | CRM Ganamos",
  description: "Accedé a tu espacio de trabajo en CRM Ganamos.",
};

export default function LoginPage() {
  return (
    <Card className="w-full border-border/80">
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Iniciar sesión
        </CardTitle>
        <CardDescription>
          ¡Bienvenido de nuevo! Ingresá tus credenciales para continuar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5">
          <div className="grid gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Correo electrónico
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@empresa.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <label htmlFor="password">Contraseña</label>
              <Link
                href="#"
                className="text-sm font-medium text-primary transition hover:text-primary/80"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            <LogIn className="size-4" />
            Ingresar
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <div>
          ¿No tenés una cuenta?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary/80"
          >
            Creá una
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Al continuar, aceptás nuestros Términos de Servicio y reconocés
          nuestra Política de Privacidad.
        </p>
      </CardFooter>
    </Card>
  );
}
