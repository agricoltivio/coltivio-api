import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

function getStoragePath(): string {
  return process.env.STORAGE_PATH ?? "./storage";
}

function getStorageSecret(): string {
  const secret = process.env.STORAGE_SECRET;
  if (!secret) throw new Error("STORAGE_SECRET env var not configured");
  return secret;
}

function getBaseUrl(): string {
  return process.env.BASE_URL ?? "http://localhost:8000";
}

function signToken(bucket: string, key: string, exp: number): string {
  const secret = getStorageSecret();
  return crypto.createHmac("sha256", secret).update(`${bucket}/${key}/${exp}`).digest("hex");
}

export function createPresignedPutUrl(bucket: string, key: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  const token = signToken(bucket, key, exp);
  return `${getBaseUrl()}/v1/storage/${bucket}/${key}?token=${token}&exp=${exp}`;
}

export function createPresignedGetUrl(bucket: string, key: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
  const token = signToken(bucket, key, exp);
  return `${getBaseUrl()}/v1/storage/${bucket}/${key}?token=${token}&exp=${exp}`;
}

export function validateToken(bucket: string, key: string, token: string, exp: number): boolean {
  if (Date.now() / 1000 > exp) return false;
  const expected = signToken(bucket, key, exp);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function getFilePath(bucket: string, key: string): string {
  const storagePath = getStoragePath();
  // Sanitize to prevent path traversal
  const safeBucket = path.basename(bucket);
  const safeKey = key.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(storagePath, safeBucket, safeKey);
}

export async function writeFile(bucket: string, key: string, stream: Readable): Promise<void> {
  const filePath = getFilePath(bucket, key);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const writeStream = fs.createWriteStream(filePath);
  await pipeline(stream, writeStream);
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  const filePath = getFilePath(bucket, key);
  await fs.promises.unlink(filePath);
}

export function fileExists(bucket: string, key: string): Promise<boolean> {
  const filePath = getFilePath(bucket, key);
  return fs.promises
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
