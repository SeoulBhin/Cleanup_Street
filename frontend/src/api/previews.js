import { postJSON } from "./http";

// Create mosaic preview from an image URL (uploaded or remote)
export function createImagePreview(imageUrl) {
  return postJSON("/api/image-previews", { imageUrl });
}
