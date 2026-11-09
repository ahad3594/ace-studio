export interface DocumentPreview {
  page: number;
  width?: number;
  height?: number;
  image: string;
}
export interface DocumentMeta {
  name: string;
  kind: "pdf" | "office" | "image";
  pages: number;
  bytes: number;
  width?: number;
  height?: number;
  locked?: boolean;
  previews: DocumentPreview[];
  fields: { name: string; type: string; value: string; page: number }[];
  hasText?: boolean;
}
export interface UploadedDocument {
  id: string;
  file: File;
  meta: DocumentMeta;
}
export interface DocumentCapabilities {
  engine: boolean;
  office: boolean;
  ocr: boolean;
  archive: boolean;
  ai: boolean;
  message?: string;
}
