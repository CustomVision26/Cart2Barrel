"use client";

import { CameraIcon, ImageIcon } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PRODUCT_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif";

type ImageFileInputProps = {
  id?: string;
  onFiles: (files: FileList | null) => void;
  accept?: string;
  className?: string;
  selectedFileName?: string | null;
};

export function ImageFileInput({
  id,
  onFiles,
  accept = PRODUCT_IMAGE_ACCEPT,
  className,
  selectedFileName,
}: ImageFileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="sr-only"
        aria-label="Take photo with camera"
        onChange={handleChange}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="mr-2 size-4" aria-hidden />
          Choose file
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
        >
          <CameraIcon className="mr-2 size-4" aria-hidden />
          Take photo
        </Button>
      </div>
      {selectedFileName ?
        <p className="text-xs text-muted-foreground">
          Selected:{" "}
          <span className="font-medium text-foreground">{selectedFileName}</span>
        </p>
      : null}
    </div>
  );
}
