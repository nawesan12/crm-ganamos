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
  title: "Create account | CRM Ganamos",
  description: "Register for CRM Ganamos to start managing deals and relationships.",
};

export default function RegisterPage() {
  return (
    <Card className="w-full border-border/80">
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription>
          Start your 14-day free trial. No credit card required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5">
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                First name
              </label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                placeholder="Maria"
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                Last name
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
            <label htmlFor="company" className="text-sm font-medium text-foreground">
              Company name
            </label>
            <Input
              id="company"
              name="company"
              autoComplete="organization"
              placeholder="Ganamos Ventures"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Work email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              required
            />
          </div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <label className="flex items-start gap-2 text-left">
              <input type="checkbox" required className="mt-1 size-4 rounded border border-input" />
              <span>
                I agree to the{" "}
                <Link href="#" className="font-medium text-primary hover:text-primary/80">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="font-medium text-primary hover:text-primary/80">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>
          <Button type="submit" className="w-full">
            <UserPlus className="size-4" />
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <div>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Need help onboarding your team?{" "}
          <Link href="#" className="font-medium text-primary hover:text-primary/80">
            Talk to sales
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
