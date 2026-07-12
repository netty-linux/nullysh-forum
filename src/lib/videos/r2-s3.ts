/**
 * Presigned PUT no Cloudflare R2 (S3-compatible) via aws4fetch.
 * Compatível com Workers (sem fs / AWS SDK Node).
 *
 * Secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Opcional: R2_BUCKET_NAME (default nullysh-videos)
 */

import { AwsClient } from "aws4fetch";

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

function getR2Client(): AwsClient {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Credenciais R2 ausentes. Defina R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY."
    );
  }
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

/**
 * URL pré-assinada para PUT do browser → R2 (expira em `expiresIn` segundos).
 * Path-style: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
 */
export async function createR2PresignedPut(opts: {
  objectKey: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error("R2_ACCOUNT_ID ausente.");
  }

  const bucket = getR2BucketName();
  const expiresIn = opts.expiresIn ?? 600;
  const contentType = opts.contentType || "video/mp4";

  // Path-style URL (padrão R2)
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${opts.objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const url = new URL(base);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  const client = getR2Client();
  const signed = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
    }),
    {
      aws: {
        signQuery: true,
        // datetime + credential ficam na query
      },
    }
  );

  return signed.url;
}
