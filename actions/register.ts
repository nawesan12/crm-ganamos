// app/(auth)/register/actions.ts
"use server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

// Mantener en sync con tu enum UserRole de Prisma
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

  const fullName = `${firstName} ${lastName}`.trim();

  try {
    const passwordHash = await hashPassword(password, 10);
    const dbUser = await prisma.user.create({
      data: {
        name: fullName,
        username,
        passwordHash,
        // role y isActive usan los defaults del schema (CASHIER, true)
        // Podrías guardar `company` en otra tabla si querés más adelante.
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

    return {
      success: false,
      error: "No se pudo crear la cuenta. Intentá de nuevo.",
    };
  }
}
