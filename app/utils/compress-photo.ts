// Phone photos weigh several MB: they are resized and re-encoded as JPEG before
// upload, which also turns formats browsers can't display (e.g. HEIC) into one
// they can. Drawing an <img> applies the EXIF orientation.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export async function compressPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
        "image/jpeg",
        JPEG_QUALITY,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
