/**
 * Limites compartilhados (client + server).
 * Sem imports Node — seguro no browser e no Worker.
 */

/** Limite prático da Bot API (sendVideo / sendDocument). */
export const TELEGRAM_MAX_BYTES = 50 * 1024 * 1024;

/** Alvo de compactação com folga sob 50 MB. */
export const COMPRESS_TARGET_BYTES = 48 * 1024 * 1024;

/**
 * Original máximo aceito no formulário admin.
 * Compactação roda no browser (ffmpeg.wasm) antes do upload.
 */
export const MAX_ORIGINAL_BYTES = 500 * 1024 * 1024;

/** Alias legado (server). */
export const MAX_UPLOAD_BYTES = MAX_ORIGINAL_BYTES;

/**
 * Download getFile da Bot API costuma falhar acima disso.
 * Sem R2/FS de playback, o ffmpeg.wasm mira este teto para o player funcionar só com Telegram.
 */
export const TELEGRAM_GETFILE_MAX_BYTES = 18 * 1024 * 1024;
