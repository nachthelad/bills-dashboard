"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { uploadBillFile } from "@/lib/storage-helpers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { FirebaseClientInitializationError } from "@/lib/firebase";
import { FirebaseError } from "firebase/app";
import {
  describeAllowedFileTypes,
  formatMaxUploadSize,
  validateUploadConstraints,
} from "@/lib/upload-constraints";
import { createApiClient } from "@/lib/api-client";
import { Progress } from "@/components/ui/progress";

interface UploadPanelProps {
  onUploadComplete: () => void;
}

export function UploadPanel({ onUploadComplete }: UploadPanelProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  const validateFile = useCallback((selectedFile?: File) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    const validation = validateUploadConstraints({
      size: selectedFile.size,
      type: selectedFile.type,
      name: selectedFile.name,
    });
    if (!validation.ok) {
      setFile(null);
      setError(validation.message);
      return;
    }
    setFile(selectedFile);
    setError(null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    validateFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0];
    validateFile(droppedFile);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleUpload = async () => {
    if (!file || !user || !apiClient) return;
    setLoading(true);
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

      // Create document record via server
      const docId = await createDocumentViaApi(storageUrl);
      setProgress(80);

      // Trigger parsing (call API route) - fire and forget
      void (async () => {
        try {
          await apiClient.triggerParse(docId);
        } catch (parseError) {
          console.warn("Parser request failed:", parseError);
        }
      })();

      setProgress(100);
      setFile(null);
      onUploadComplete();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar el archivo");
      setProgress(0);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <Card className="h-full flex flex-col border-dashed border-2 border-border">
      <CardHeader>
        <CardTitle>Cargar boleta</CardTitle>
        <CardDescription>
          Arrastrá una boleta (PDF, PNG o JPG) para procesarla automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex flex-col items-center justify-center flex-1 min-h-[200px]">
        {!file ? (
          <div
            className={`transition-colors w-full h-full flex flex-col items-center justify-center cursor-pointer ${
              isDragActive ? "bg-primary/10" : "hover:bg-muted/40"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="w-10 h-10 mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              Hacé clic para elegir un archivo o arrastralo hasta acá
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {describeAllowedFileTypes()} (máx. {formatMaxUploadSize()})
            </p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,.tif,.tiff,image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-input"
            />
          </div>
        ) : (
          <div className="border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {loading && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Cargando y procesando...
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? "Procesando..." : "Confirmar carga"}
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
