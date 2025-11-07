import bcrypt from "bcrypt";

export async function hashPassword(
  password: string,
  cost = 12,
): Promise<string> {
  if (!password) {
    throw new Error("La contraseña no puede estar vacía.");
  }

  if (!Number.isInteger(cost) || cost < 4 || cost > 31) {
    throw new Error("El factor de costo de bcrypt debe estar entre 4 y 31.");
  }

  const salt = await bcrypt.genSalt(cost);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!hash || !hash.startsWith("$2")) {
    return false;
  }

  if (!password) return false;

  try {
    const match = await bcrypt.compare(password, hash);
    return match;
  } catch {
    return false;
  }
}
