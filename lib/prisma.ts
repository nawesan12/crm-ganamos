import { PrismaClient } from "@prisma/client";

// Este bloque de código previene que se creen múltiples instancias de PrismaClient
// en el entorno de desarrollo debido al Hot Reloading de Next.js.

// Declaramos una variable global para almacenar la instancia de Prisma.
declare global {
  var prisma: PrismaClient | undefined;
}

// Exportamos la instancia de Prisma.
// Si ya existe una instancia global, la reutilizamos.
// Si no existe, creamos una nueva.
// En producción, 'globalThis.prisma' siempre será undefined la primera vez,
// por lo que se creará una única instancia.
export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    // Opcional: puedes habilitar el logging de consultas para debugging.
    // log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Si estamos en desarrollo, asignamos la nueva instancia a la variable global.
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
