"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export type AuthRole = "ADMIN" | "CASHIER" | "AGENT";

export type RegisterUserPayload = {
  id: number;
  name: string;
  username: string;
  role: AuthRole;
};

export type RegisterResult =
  | {
      success: true;
      user: RegisterUserPayload;
    }
  | {
      success: false;
      error: string;
    };

export async function registerAction(
  formData: FormData,
): Promise<RegisterResult> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!firstName || !lastName || !username || !password) {
    return {
      success: false,
      error: "Completá todos los campos obligatorios.",
    };
  }

  if (password.length < 6) {
    return {
      success: false,
      error: "La contraseña debe tener al menos 6 caracteres.",
    };
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    return {
      success: false,
      error: "Ese nombre de usuario ya está en uso. Elegí otro.",
    };
  }

  try {
    const passwordHash = await hashPassword(password, 10);
    const dbUser = await prisma.user.create({
      data: {
        name: fullName,
        username,
        passwordHash,
      },
    });

    const user: RegisterUserPayload = {
      id: dbUser.id,
      name: dbUser.name,
      username: dbUser.username,
      role: dbUser.role as AuthRole,
    };

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error("Error creating user", error);

    const knownError = error as { code?: string };
    if (knownError?.code === "P2002") {
      return {
        success: false,
        error: "Ese nombre de usuario ya está en uso. Elegí otro.",
      };
    }

    return {
      success: false,
      error: "No se pudo crear la cuenta. Intentá de nuevo.",
    };
  }
}
