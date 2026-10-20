import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

export default defineNitroPlugin(async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: s3Bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: s3Bucket }));
  }
});
