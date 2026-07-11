/**
 * Cliente S3-compatível do Cloudflare R2 (presigned PUT).
 * Requer secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Bucket: R2_BUCKET_NAME (default nullysh-videos)
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function hasR2S3Credentials(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim()
  );
}

export function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME?.trim() || "nullysh-videos";
}

export function createR2S3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Credenciais R2 ausentes. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY."
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/** Presigned PUT (browser → R2 direto), expira em 600s. */
export async function createR2PresignedPut(opts: {
  objectKey: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const client = createR2S3Client();
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: opts.objectKey,
    ContentType: opts.contentType || "video/mp4",
  });
  return getSignedUrl(client, command, {
    expiresIn: opts.expiresIn ?? 600,
  });
}
