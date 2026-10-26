// Quest photos are stored as files in the `photos` storage (see nuxt.config.ts),
// under a key saved in `TeamQuest.photoPath`. Keys are never reused, so a
// retaken photo gets a new URL and can be cached forever.
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const PHOTO_KEY_REGEX = /^[0-9a-f-]{36}-\d+\.(jpg|png|webp)$/;

const IMAGE_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type ImageExtension = keyof typeof IMAGE_TYPES;

// Trusts the file's first bytes rather than the type sent by the browser.
export function detectImageExtension(data: Buffer): ImageExtension | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "jpg";
  }

  if (data.subarray(0, 4).toString("hex") === "89504e47") {
    return "png";
  }

  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

export function isPhotoKey(value: unknown): value is string {
  return typeof value === "string" && PHOTO_KEY_REGEX.test(value);
}

export function getPhotoContentType(key: string) {
  const extension = key.split(".").pop() as ImageExtension;
  return IMAGE_TYPES[extension];
}

export async function savePhoto(
  teamQuestId: string,
  data: Buffer,
  extension: ImageExtension,
) {
  const key = `${teamQuestId}-${Date.now()}.${extension}`;
  await useStorage("photos").setItemRaw(key, data);
  return key;
}

export function readPhoto(key: string) {
  return useStorage("photos").getItemRaw<Buffer>(key);
}

export async function deletePhoto(key: string | null) {
  if (key) {
    await useStorage("photos").removeItem(key);
  }
}
