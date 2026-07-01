import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export type LocalJwtPayload = {
  sub: string;
  farmId: string | null;
};

export function signLocalJwt(userId: string, farmId: string | null): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var not configured");
  return jwt.sign({ sub: userId, farmId } satisfies LocalJwtPayload, secret, { expiresIn: "30d" });
}

export function verifyLocalJwt(token: string): LocalJwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var not configured");
  try {
    return jwt.verify(token, secret) as LocalJwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
