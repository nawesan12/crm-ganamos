"use server";

import { prisma } from "@/lib/prisma";

export type AuthRole = "ADMIN" | "CASHIER" | "AGENT";

export type LoginUserPayload = {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
};

export type LoginResult =
  | {
      success: true;
      user: LoginUserPayload;
    }
  | {
      success: false;
      error: string;
    };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      success: false,
      error: "Ingresá correo y contraseña.",
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!dbUser) {
    return {
      success: false,
      error: "No encontramos un usuario con ese correo.",
    };
  }

  // Acá podrías validar passwordHash en el futuro.
  const user: LoginUserPayload = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role as AuthRole,
  };

  return {
    success: true,
    user,
  };
}
