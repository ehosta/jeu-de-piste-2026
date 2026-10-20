import { S3Client } from "@aws-sdk/client-s3";

const { s3: config } = useRuntimeConfig();

const globalForS3 = globalThis as unknown as {
  s3?: S3Client;
};

export const s3 =
  globalForS3.s3 ??
  new S3Client({
    endpoint: config.endpoint,
    // Ignored by SeaweedFS, but required by the SDK
    region: "us-east-1",
    // SeaweedFS serves buckets as paths, not subdomains
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

export const s3Bucket = config.bucket;

if (process.env.NODE_ENV !== "production") globalForS3.s3 = s3;
