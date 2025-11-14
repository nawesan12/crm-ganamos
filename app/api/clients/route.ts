import { NextResponse } from "next/server";
import { Prisma, ClientStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface CreateClientResponse {
  success: boolean;
  client?: {
    id: number;
    username: string;
    phone: string | null;
  };
  error?: string;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json<CreateClientResponse>(
      {
        success: false,
        error: "No se pudo leer la solicitud.",
      },
      { status: 400 },
    );
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json<CreateClientResponse>(
      {
        success: false,
        error: "Formato inválido.",
      },
      { status: 400 },
    );
  }

  const { username: rawUsername, phone: rawPhone } = payload as Record<string, unknown>;

  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  const phone =
    typeof rawPhone === "string" && rawPhone.trim().length > 0
      ? rawPhone.trim()
      : null;

  if (!username || username.length < 3) {
    return NextResponse.json<CreateClientResponse>(
      {
        success: false,
        error: "Ingresá al menos 3 caracteres para el usuario.",
      },
      { status: 400 },
    );
  }

  if (phone && phone.length < 5) {
    return NextResponse.json<CreateClientResponse>(
      {
        success: false,
        error: "El teléfono debe tener al menos 5 caracteres.",
      },
      { status: 400 },
    );
  }

  try {
    const client = await prisma.client.create({
      data: {
        username,
        phone,
        status: ClientStatus.ACTIVE,
      },
    });

    return NextResponse.json<CreateClientResponse>({
      success: true,
      client: {
        id: client.id,
        username: client.username,
        phone: client.phone,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json<CreateClientResponse>(
        {
          success: false,
          error: "Ya existe un cliente con esos datos.",
        },
        { status: 409 },
      );
    }

    console.error("Error creating client from chat", error);
    return NextResponse.json<CreateClientResponse>(
      {
        success: false,
        error: "No se pudo crear el cliente.",
      },
      { status: 500 },
    );
  }
}
