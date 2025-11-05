// app/(auth)/login/page.tsx
import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/LoginCard";

export const metadata: Metadata = {
  title: "Iniciar sesión | CRM Ganamos",
  description: "Accedé a tu espacio de trabajo en CRM Ganamos.",
};

export default function LoginPage() {
  return <LoginCard />;
}
