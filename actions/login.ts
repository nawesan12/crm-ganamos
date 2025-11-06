"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export type AuthRole = "ADMIN" | "CASHIER" | "AGENT";

export type LoginUserPayload = {
  id: number;
  name: string;
  username: string;
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
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return {
      success: false,
      error: "Ingresá usuario y contraseña.",
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { username },
  });

  if (!dbUser) {
    return {
      success: false,
      error: "No encontramos un usuario con esas credenciales.",
    };
  }

  const isValidPassword = await verifyPassword(password, dbUser.passwordHash);

  if (!isValidPassword) {
    return {
      success: false,
      error: "Usuario o contraseña incorrectos.",
    };
  }

  const user: LoginUserPayload = {
    id: dbUser.id,
    name: dbUser.name,
    username: dbUser.username,
    role: dbUser.role as AuthRole,
  };

  return {
    success: true,
    user,
  };
}
