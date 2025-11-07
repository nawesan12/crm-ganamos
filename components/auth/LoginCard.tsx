"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import { loginAction } from "@/actions/login";
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

export function LoginCard() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { isAuthenticated } = useAuthStore();
  const { user } = useAuthStore();

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
      const result = await loginAction(formData);

      if (!result.success) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      login(result.user);
      router.replace(getDashboardRouteForRole(result.user.role));
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al iniciar sesión. Intentá de nuevo.");
      setIsSubmitting(false);
    }
  };

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
        <form className="grid gap-5" onSubmit={handleSubmit}>
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
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              "Ingresando..."
            ) : (
              <>
                <LogIn className="size-4" />
                Ingresar
              </>
            )}
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
