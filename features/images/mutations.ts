import { useMutation } from "@tanstack/react-query";

import { uploadImage } from "./api";
import type { UploadImageVariables } from "./types";

function useUploadImageMutation() {
  return useMutation({
    mutationFn: ({ file, purpose }: UploadImageVariables) => uploadImage(file, purpose),
  });
}

export { useUploadImageMutation };
