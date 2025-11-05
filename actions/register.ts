// app/(auth)/register/actions.ts
"use server";
import { prisma } from "@/lib/prisma";

// Mantener en sync con tu enum UserRole de Prisma
export type AuthRole = "ADMIN" | "CASHIER" | "AGENT";

export type RegisterUserPayload = {
  id: number;
  name: string;
  email: string;
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
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? ""); // por ahora no se usa

  if (!firstName || !lastName || !email || !password) {
    return {
      success: false,
      error: "Completá todos los campos obligatorios.",
    };
  }

  const fullName = `${firstName} ${lastName}`.trim();

  try {
    const dbUser = await prisma.user.create({
      data: {
        name: fullName,
        email,
        // role y isActive usan los defaults del schema (CASHIER, true)
        // Podrías guardar `company` en otra tabla si querés más adelante.
      },
    });

    const user: RegisterUserPayload = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
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
