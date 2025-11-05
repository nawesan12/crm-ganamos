// app/(auth)/register/page.tsx
import { RegisterCard } from "@/components/auth/RegisterCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear cuenta | CRM Ganamos",
  description:
    "Registrate en CRM Ganamos para empezar a gestionar oportunidades y relaciones.",
};

export default function RegisterPage() {
  return <RegisterCard />;
}
