import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import type { AuthRole, AuthUser, LoginResponse } from "@/types/auth";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json<LoginResponse>(
      {
        success: false,
        error: "No se pudo procesar la solicitud. Intentá de nuevo.",
      },
      { status: 400 },
    );
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return NextResponse.json<LoginResponse>(
      {
        success: false,
        error: "Formato de datos inválido.",
      },
      { status: 400 },
    );
  }

  const { username: rawUsername, password: rawPassword } = payload as Record<
    string,
    unknown
  >;
  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!username || !password) {
    return NextResponse.json<LoginResponse>(
      {
        success: false,
        error: "Ingresá usuario y contraseña.",
      },
      { status: 400 },
    );
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: "No encontramos un usuario activo con esas credenciales.",
        },
        { status: 401 },
      );
    }

    const isValidPassword = await verifyPassword(password, dbUser.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: "Usuario o contraseña incorrectos.",
        },
        { status: 401 },
      );
    }

    const user: AuthUser = {
      id: dbUser.id,
      name: dbUser.name,
      username: dbUser.username,
      role: dbUser.role as AuthRole,
    };

    return NextResponse.json<LoginResponse>({
      success: true,
      user,
    });
  } catch (error) {
    logger.error("Login error", error);
    return NextResponse.json<LoginResponse>(
      {
        success: false,
        error: "Ocurrió un error al iniciar sesión. Intentá de nuevo.",
      },
      { status: 500 },
    );
  }
}
