import type { ApiEnvelope } from "@/features/links/types";

type UploadImageResponseData = {
  url: string;
};

type UploadImageResponse = ApiEnvelope<UploadImageResponseData>;

// Where an uploaded file is stored. The favicon target (`FAVICON`) takes a page URL
// instead of a file, so it goes through `storeFavicon` and is not part of this type.
type ImagePurpose = "PROFILE" | "POST" | "LINK_PREVIEW";

// Web picks a File/Blob; native (expo-image-picker) yields a `{ uri, name, type }`
// descriptor that React Native's FormData accepts for multipart upload.
type NativeImageFile = { uri: string; name: string; type: string };
type ImageUploadInput = File | Blob | NativeImageFile;

type UploadImageVariables = {
  file: ImageUploadInput;
  purpose: ImagePurpose;
};

export type {
  ImagePurpose,
  ImageUploadInput,
  NativeImageFile,
  UploadImageResponse,
  UploadImageResponseData,
  UploadImageVariables,
};
