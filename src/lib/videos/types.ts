/** Metadados públicos do vídeo (sem file_id do Telegram). */
export type VideoPublic = {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  /** Placeholder numérico legado ou label "TG" */
  thumbnail: string;
  vipOnly: boolean;
  views: number;
  createdAt: string;
  hasStream?: boolean;
  mimeType?: string;
  sizeBytes?: number;
  hasThumb?: boolean;
};

/** Registro completo no catálogo server-side. */
export type StoredVideo = VideoPublic & {
  telegramFileId: string;
  telegramMessageId?: number;
  telegramChatId?: string;
  telegramThumbFileId?: string | null;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedById?: string;
  uploadedByName?: string;
};
