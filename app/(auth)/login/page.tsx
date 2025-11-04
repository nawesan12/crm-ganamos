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
  title: "Sign in | CRM Ganamos",
  description: "Log in to access your CRM Ganamos workspace.",
};

export default function LoginPage() {
  return (
    <Card className="w-full border-border/80">
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Sign in
        </CardTitle>
        <CardDescription>
          Welcome back! Please enter your credentials to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <label htmlFor="password">Password</label>
              <Link
                href="#"
                className="text-sm font-medium text-primary transition hover:text-primary/80"
              >
                Forgot password?
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
            Sign in
          </Button>
        </form>
        <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
            <span className="h-px flex-1 bg-border" />
            or continue with
            <span className="h-px flex-1 bg-border" />
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="w-full">
              <svg
                className="size-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6 1.54 7.38 2.84l5.04-4.92C33.66 4.42 29.28 2.5 24 2.5 14.64 2.5 6.7 8.34 3.56 16.09l5.88 4.56C10.98 14.08 16.92 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.44 24.5c0-1.64-.16-3.22-.46-4.75H24v9.02h12.68c-.55 2.82-2.22 5.21-4.71 6.82l7.21 5.59C43.84 37.85 46.44 31.66 46.44 24.5z"
                />
                <path
                  fill="#FBBC05"
                  d="M11.44 28.65a14.5 14.5 0 0 1-.76-4.65c0-1.62.28-3.18.76-4.65l-5.88-4.56A21.448 21.448 0 0 0 2.5 24c0 3.43.82 6.66 2.26 9.5l6.68-4.85z"
                />
                <path
                  fill="#34A853"
                  d="M24 45.5c5.28 0 9.72-1.74 12.96-4.74l-7.21-5.59c-2 1.35-4.58 2.12-7.75 2.12-7.08 0-13.02-4.58-15.56-10.96l-6.68 4.85C6.7 39.66 14.64 45.5 24 45.5z"
                />
                <path fill="none" d="M2.5 2.5h43v43h-43z" />
              </svg>
              Google
            </Button>
            <Button type="button" variant="outline" className="w-full">
              <svg
                className="size-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.486 2 12.017 2 16.995 5.657 21.128 10.438 22v-7.033H7.898v-2.95h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.63.774-1.63 1.562v1.87h2.773l-.443 2.95h-2.33V22C18.343 21.128 22 16.994 22 12.017 22 6.486 17.523 2 12 2z" />
              </svg>
              Facebook
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <div>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:text-primary/80">
            Create one
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/80">
          By continuing, you agree to our Terms of Service and acknowledge our Privacy Policy.
        </p>
      </CardFooter>
    </Card>
  );
}
