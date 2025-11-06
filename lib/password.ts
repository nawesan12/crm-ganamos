import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";

function runPython(script: string, args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", ["-c", script, ...args]);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            stderr.trim() || `Python finalizó con código ${code ?? "desconocido"}.`,
          ),
        );
      }
    });

    child.stdin.write(input.endsWith("\n") ? input : `${input}\n`);
    child.stdin.end();
  });
}

export async function hashPassword(password: string, cost = 10): Promise<string> {
  if (!password) {
    throw new Error("La contraseña no puede estar vacía.");
  }

  if (!Number.isInteger(cost) || cost < 4 || cost > 31) {
    throw new Error("El factor de costo de bcrypt debe estar entre 4 y 31.");
  }

  const script = `
import crypt
import sys
password = sys.stdin.readline().rstrip("\\n")
cost = int(sys.argv[1])
rounds = 1 << cost
salt = crypt.mksalt(crypt.METHOD_BLOWFISH, rounds=rounds)
result = crypt.crypt(password, salt)
if not isinstance(result, str):
    result = result.decode("utf-8")
sys.stdout.write(result)
`;

  return runPython(script, [String(cost)], password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash || !hash.startsWith("$2")) {
    return false;
  }

  const script = `
import crypt
import sys
password = sys.stdin.readline().rstrip("\\n")
stored = sys.argv[1]
calculated = crypt.crypt(password, stored)
if not isinstance(calculated, str):
    calculated = calculated.decode("utf-8")
sys.stdout.write(calculated)
`;

  try {
    const computed = await runPython(script, [hash], password);
    const storedBuffer = Buffer.from(hash.trim());
    const computedBuffer = Buffer.from(computed.trim());

    return (
      storedBuffer.length === computedBuffer.length &&
      timingSafeEqual(storedBuffer, computedBuffer)
    );
  } catch {
    return false;
  }
}
