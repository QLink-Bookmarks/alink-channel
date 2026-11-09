import { api } from "@/lib/api-client";

import type { ImagePurpose, ImageUploadInput, UploadImageResponse } from "./types";

async function uploadImage(file: ImageUploadInput, purpose: ImagePurpose) {
  const form = new FormData();
  // Native passes a `{ uri, name, type }` descriptor, which RN's FormData accepts
  // even though the DOM typings only allow string | Blob.
  form.append("image", file as unknown as Blob);
  // On native, omit Content-Type so RN's networking adds the multipart boundary
  // itself; a manual "multipart/form-data" without a boundary makes the upload fail.
  return api.post<UploadImageResponse, FormData>("/api/images", form, {
    params: { purpose },
    ...(process.env.EXPO_OS === "web"
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : {}),
  });
}

// Asks the server to find and store the favicon of `pageUrl` (the original page,
// not a favicon file). No file is sent.
async function storeFavicon(pageUrl: string) {
  return api.post<UploadImageResponse>("/api/images", undefined, {
    params: { purpose: "FAVICON", url: pageUrl },
  });
}

export { storeFavicon, uploadImage };
