import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { createApiClient } from "@/lib/api-client";
import { uploadBillFile } from "@/lib/storage-helpers";
import {
  validateUploadConstraints,
  UploadValidationResult,
} from "@/lib/upload-constraints";
import { FirebaseClientInitializationError } from "@/lib/firebase";
import { FirebaseError } from "firebase/app";

export interface UseBillUploadResult {
  upload: (file: File) => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

export function useBillUpload(onComplete?: () => void): UseBillUploadResult {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  const reset = () => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  };

  const upload = async (file: File) => {
    if (!user || !apiClient) return;

    // 1. Validation
    const validation: UploadValidationResult = validateUploadConstraints({
      size: file.size,
      type: file.type,
      name: file.name,
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(10);

    try {
      let storageUrl: string | null = null;

      const uploadViaApi = async () => {
        return apiClient.uploadFile(file, file.name);
      };

      const createDocumentViaApi = async (storageUrlValue: string) => {
        return apiClient.createDocument({
          fileName: file.name,
          storageUrl: storageUrlValue,
        });
      };

      // 2. Upload to Storage
      try {
        storageUrl = await uploadBillFile(user.uid, file);
        setProgress(50);
      } catch (uploadError) {
        const shouldFallback =
          uploadError instanceof FirebaseClientInitializationError ||
          (uploadError instanceof FirebaseError &&
            uploadError.code === "storage/unauthorized");

        if (!shouldFallback) {
          throw uploadError;
        }

        console.warn(
          "Client storage upload unavailable, falling back to server-side upload.",
          uploadError
        );
        storageUrl = await uploadViaApi();
        setProgress(50);
      }

      if (!storageUrl) {
        throw new Error("No se pudo cargar el archivo");
      }

      // 3. Create Document Record
      const docId = await createDocumentViaApi(storageUrl);
      setProgress(80);

      // 4. Trigger Parsing (fire and forget)
      void (async () => {
        try {
          await apiClient.triggerParse(docId);
        } catch (parseError) {
          console.warn("Parser request failed:", parseError);
        }
      })();

      setProgress(100);
      if (onComplete) {
        onComplete();
      }

      // Auto reset after success
      setTimeout(() => {
        reset();
      }, 2000);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar el archivo");
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    upload,
    isUploading,
    progress,
    error,
    reset,
  };
}
