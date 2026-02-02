"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InvoiceUploaderProps {
  onFileUpload: (file: File) => void;
  onTextSubmit: (text: string) => void;
  isLoading: boolean;
}

export default function InvoiceUploader({
  onFileUpload,
  onTextSubmit,
  isLoading,
}: InvoiceUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files?.[0]) {
        onFileUpload(e.dataTransfer.files[0]);
      }
    },
    [onFileUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        onFileUpload(e.target.files[0]);
      }
    },
    [onFileUpload]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={mode === "file" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("file")}
        >
          Upload File
        </Button>
        <Button
          variant={mode === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("text")}
        >
          Paste Text
        </Button>
      </div>

      {mode === "file" ? (
        <Card
          className={`relative flex min-h-[200px] cursor-pointer items-center justify-center border-2 border-dashed p-8 transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-center">
            {isLoading ? (
              <div className="space-y-2">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Parsing invoice...
                </p>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium">
                  Drop your invoice here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PDF, PNG, JPG, or WEBP
                </p>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <Textarea
            placeholder="Paste invoice text here... Include recipient, amount, wallet address, token, and chain."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={8}
          />
          <Button
            onClick={() => onTextSubmit(textInput)}
            disabled={!textInput.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? "Parsing..." : "Parse Invoice"}
          </Button>
        </div>
      )}
    </div>
  );
}
