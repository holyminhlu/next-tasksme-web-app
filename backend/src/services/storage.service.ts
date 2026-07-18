import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "../config/env.js";
import { ValidationError } from "../lib/errors.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

let s3Client: S3Client | null = null;

function getS3Client() {
  const env = getEnv();
  if (!s3Client) {
    if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
      throw new ValidationError("S3 credentials are not configured");
    }
    s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return s3Client;
}

export function assertAllowedAttachment(input: {
  mimeType: string;
  sizeBytes: number;
  originalFileName: string;
}) {
  const env = getEnv();
  if (input.sizeBytes <= 0 || input.sizeBytes > env.ATTACHMENT_MAX_BYTES) {
    throw new ValidationError(
      `File exceeds max size of ${env.ATTACHMENT_MAX_BYTES} bytes`,
      { field: "file" },
    );
  }
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new ValidationError("File type is not allowed", { field: "file" });
  }
  if (!input.originalFileName.trim()) {
    throw new ValidationError("File name is required", { field: "file" });
  }
}

export function checksumBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildStorageKey(workspaceId: string, taskId: string) {
  return `${workspaceId}/${taskId}/${randomUUID()}`;
}

async function ensureLocalDir(storageKey: string) {
  const env = getEnv();
  const fullPath = path.resolve(env.LOCAL_STORAGE_DIR, storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  return fullPath;
}

export async function putObject(input: {
  storageKey: string;
  body: Buffer;
  mimeType: string;
}) {
  const env = getEnv();
  if (env.STORAGE_DRIVER === "local" || env.isTest) {
    const fullPath = await ensureLocalDir(input.storageKey);
    await writeFile(fullPath, input.body);
    return;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.mimeType,
    }),
  );
}

export async function deleteObject(storageKey: string) {
  const env = getEnv();
  if (env.STORAGE_DRIVER === "local" || env.isTest) {
    const fullPath = path.resolve(env.LOCAL_STORAGE_DIR, storageKey);
    try {
      await unlink(fullPath);
    } catch {
      // ignore missing
    }
    return;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
    }),
  );
}

export async function createSignedDownloadUrl(
  storageKey: string,
  contentType = "application/octet-stream",
) {
  const env = getEnv();
  if (env.STORAGE_DRIVER === "local" || env.isTest) {
    const expiresAt = Math.floor(Date.now() / 1000) + env.ATTACHMENT_SIGNED_URL_TTL_SECONDS;
    const signature = signLocalKey(storageKey, expiresAt, contentType);
    return {
      url: `${env.APP_URL}/api/v1/internal/local-files?key=${encodeURIComponent(storageKey)}&expires=${expiresAt}&type=${encodeURIComponent(contentType)}&sig=${signature}`,
      expiresIn: env.ATTACHMENT_SIGNED_URL_TTL_SECONDS,
    };
  }

  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
    }),
    { expiresIn: env.ATTACHMENT_SIGNED_URL_TTL_SECONDS },
  );
  return {
    url,
    expiresIn: env.ATTACHMENT_SIGNED_URL_TTL_SECONDS,
  };
}

function signLocalKey(
  storageKey: string,
  expiresAt: number,
  contentType: string,
) {
  const env = getEnv();
  return createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`${storageKey}:${expiresAt}:${contentType}`)
    .digest("hex");
}

export function verifyLocalFileSignature(
  storageKey: string,
  expiresAt: number,
  contentType: string,
  signature: string,
) {
  if (expiresAt * 1000 < Date.now()) return false;
  const expected = signLocalKey(storageKey, expiresAt, contentType);
  return expected === signature;
}

export async function readLocalObject(storageKey: string) {
  const env = getEnv();
  const fullPath = path.resolve(env.LOCAL_STORAGE_DIR, storageKey);
  return readFile(fullPath);
}
