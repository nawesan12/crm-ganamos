"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { registerAction } from "@/actions/register";
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
import { getDashboardRouteForRole } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { logger } from "@/lib/logger";

export function RegisterCard() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(getDashboardRouteForRole(user.role));
    }
  }, [isAuthenticated, router, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await registerAction(formData);

      if (!result.success) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      login(result.user);
      router.replace(getDashboardRouteForRole(result.user.role));
    } catch (err) {
      logger.error(err);
      setError("Ocurrió un error al crear la cuenta. Intentá de nuevo.");
      setIsSubmitting(false);
    }
  };

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
        <form className="grid gap-5" onSubmit={handleSubmit}>
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-foreground"
            >
              Nombre de usuario
            </label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="ganamos.cajero"
              required
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <label className="flex items-start gap-2 text-left">
              <input
                type="checkbox"
                required
                className="mt-1 size-4 rounded border border-input"
                disabled={isSubmitting}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              "Creando cuenta..."
            ) : (
              <>
                <UserPlus className="size-4" />
                Crear cuenta
              </>
            )}
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
