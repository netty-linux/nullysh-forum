/**
 * Cliente mínimo da Bot API do Telegram.
 * Usado como storage de vídeos: o arquivo fica nos servidores do Telegram
 * e o fórum guarda só file_id + metadados.
 *
 * Limites oficiais (Bot API):
 * - upload sendVideo / sendDocument: até ~50 MB
 * - download via getFile: até ~20 MB pelo path padrão (arquivos maiores
 *   podem exigir Bot API local — documentado no README)
 */

const API = "https://api.telegram.org";

/**
 * Quando um group vira supergroup, o Telegram devolve migrate_to_chat_id.
 * Guardamos em memória (processo) e preferimos esse id.
 */
let migratedChatId: string | null = null;

export type TelegramConfig = {
  token: string;
  chatId: string;
};

export function getTelegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const envChat = process.env.TELEGRAM_STORAGE_CHAT_ID?.trim();
  const chatId = migratedChatId || envChat;
  if (!token || !chatId) return null;
  return { token, chatId };
}

export function isTelegramConfigured(): boolean {
  return getTelegramConfig() !== null;
}

type TgResponse<T> = {
  ok: boolean;
  description?: string;
  result?: T;
  parameters?: { migrate_to_chat_id?: number };
};

export type TgVideoResult = {
  messageId: number;
  fileId: string;
  fileUniqueId?: string;
  durationSec: number;
  width?: number;
  height?: number;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  thumbFileId?: string | null;
};

export type TgFile = {
  fileId: string;
  fileUniqueId?: string;
  fileSize?: number;
  filePath?: string;
};

class TelegramApiError extends Error {
  migrateToChatId?: string;
  constructor(message: string, migrateToChatId?: string) {
    super(message);
    this.name = "TelegramApiError";
    this.migrateToChatId = migrateToChatId;
  }
}

async function tgCall<T>(
  token: string,
  method: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, init);
  const data = (await res.json()) as TgResponse<T>;
  if (!data.ok || data.result === undefined) {
    const mig = data.parameters?.migrate_to_chat_id;
    if (mig != null) {
      migratedChatId = String(mig);
      throw new TelegramApiError(
        data.description || `Telegram ${method} falhou`,
        migratedChatId
      );
    }
    throw new Error(data.description || `Telegram ${method} falhou`);
  }
  return data.result;
}

function buildVideoForm(
  chatId: string,
  opts: {
    buffer: Buffer;
    filename: string;
    mimeType?: string;
    caption?: string;
    thumb?: { buffer: Buffer; filename: string } | null;
  }
): FormData {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("supports_streaming", "true");
  if (opts.caption) form.append("caption", opts.caption.slice(0, 1024));

  const videoBlob = new Blob([new Uint8Array(opts.buffer)], {
    type: opts.mimeType || "video/mp4",
  });
  form.append("video", videoBlob, opts.filename);

  if (opts.thumb) {
    const thumbBlob = new Blob([new Uint8Array(opts.thumb.buffer)], {
      type: "image/jpeg",
    });
    form.append("thumbnail", thumbBlob, opts.thumb.filename);
  }
  return form;
}

/** Envia vídeo (mp4 preferível) para o chat de storage. */
export async function telegramSendVideo(opts: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  caption?: string;
  /** thumbnail JPEG opcional */
  thumb?: { buffer: Buffer; filename: string } | null;
}): Promise<TgVideoResult> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram não configurado");

  type Msg = {
    message_id: number;
    video?: {
      file_id: string;
      file_unique_id?: string;
      duration?: number;
      width?: number;
      height?: number;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
      thumbnail?: { file_id: string };
      thumb?: { file_id: string };
    };
    document?: {
      file_id: string;
      file_unique_id?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
      thumbnail?: { file_id: string };
    };
  };

  async function sendOnce(chatId: string) {
    return tgCall<Msg>(cfg!.token, "sendVideo", {
      method: "POST",
      body: buildVideoForm(chatId, opts),
    });
  }

  let msg: Msg;
  try {
    msg = await sendOnce(cfg.chatId);
  } catch (e) {
    // Group → supergroup: tenta de novo com o id migrado
    if (e instanceof TelegramApiError && e.migrateToChatId) {
      msg = await sendOnce(e.migrateToChatId);
    } else {
      throw e;
    }
  }

  const video = msg.video;
  if (video?.file_id) {
    return {
      messageId: msg.message_id,
      fileId: video.file_id,
      fileUniqueId: video.file_unique_id,
      durationSec: video.duration ?? 0,
      width: video.width,
      height: video.height,
      fileName: video.file_name || opts.filename,
      mimeType: video.mime_type || opts.mimeType || "video/mp4",
      fileSize: video.file_size,
      thumbFileId:
        video.thumbnail?.file_id || video.thumb?.file_id || null,
    };
  }

  // Fallback raro: Telegram devolveu document
  if (msg.document?.file_id) {
    return {
      messageId: msg.message_id,
      fileId: msg.document.file_id,
      fileUniqueId: msg.document.file_unique_id,
      durationSec: 0,
      fileName: msg.document.file_name || opts.filename,
      mimeType: msg.document.mime_type || opts.mimeType || "video/mp4",
      fileSize: msg.document.file_size,
      thumbFileId: msg.document.thumbnail?.file_id || null,
    };
  }

  throw new Error("Telegram não retornou file_id do vídeo");
}

/** Envia como document (útil se sendVideo rejeitar o formato). */
export async function telegramSendDocument(opts: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  caption?: string;
}): Promise<TgVideoResult> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram não configurado");

  type DocMsg = {
    message_id: number;
    document?: {
      file_id: string;
      file_unique_id?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
      thumbnail?: { file_id: string };
    };
  };

  function buildForm(chatId: string) {
    const form = new FormData();
    form.append("chat_id", chatId);
    if (opts.caption) form.append("caption", opts.caption.slice(0, 1024));
    const blob = new Blob([new Uint8Array(opts.buffer)], {
      type: opts.mimeType || "application/octet-stream",
    });
    form.append("document", blob, opts.filename);
    return form;
  }

  async function sendOnce(chatId: string) {
    return tgCall<DocMsg>(cfg!.token, "sendDocument", {
      method: "POST",
      body: buildForm(chatId),
    });
  }

  let msg: DocMsg;
  try {
    msg = await sendOnce(cfg.chatId);
  } catch (e) {
    if (e instanceof TelegramApiError && e.migrateToChatId) {
      msg = await sendOnce(e.migrateToChatId);
    } else {
      throw e;
    }
  }

  if (!msg.document?.file_id) {
    throw new Error("Telegram não retornou file_id do documento");
  }

  return {
    messageId: msg.message_id,
    fileId: msg.document.file_id,
    fileUniqueId: msg.document.file_unique_id,
    durationSec: 0,
    fileName: msg.document.file_name || opts.filename,
    mimeType: msg.document.mime_type || opts.mimeType,
    fileSize: msg.document.file_size,
    thumbFileId: msg.document.thumbnail?.file_id || null,
  };
}

export async function telegramGetFile(fileId: string): Promise<TgFile> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram não configurado");

  const file = await tgCall<{
    file_id: string;
    file_unique_id?: string;
    file_size?: number;
    file_path?: string;
  }>(cfg.token, "getFile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });

  return {
    fileId: file.file_id,
    fileUniqueId: file.file_unique_id,
    fileSize: file.file_size,
    filePath: file.file_path,
  };
}

/** URL absoluta do arquivo no CDN do Telegram (contém o token — só server-side). */
export function telegramFileUrl(filePath: string): string {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram não configurado");
  return `${API}/file/bot${cfg.token}/${filePath}`;
}

export async function telegramDeleteMessage(messageId: number): Promise<void> {
  const cfg = getTelegramConfig();
  if (!cfg) return;
  try {
    await tgCall(cfg.token, "deleteMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        message_id: messageId,
      }),
    });
  } catch {
    /* mensagem já apagada ou bot sem permissão — ignora */
  }
}

export async function telegramGetMe(): Promise<{
  id: number;
  username?: string;
  first_name?: string;
}> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram não configurado");
  return tgCall(cfg.token, "getMe");
}
