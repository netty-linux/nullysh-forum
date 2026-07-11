/**
 * Pacote de figurinhas estilo WhatsApp (reações + memes leves).
 * Cada sticker é um “pack” com emoji grande ou asset local.
 */

export type StickerItem = {
  id: string;
  label: string;
  /** emoji ou shortcode visual */
  emoji: string;
  /** categoria no picker */
  category: "reações" | "memes" | "nullysh" | "animais";
};

export const STICKER_PACK: StickerItem[] = [
  // Reações
  { id: "st_like", label: "Curtir", emoji: "👍", category: "reações" },
  { id: "st_love", label: "Amor", emoji: "❤️", category: "reações" },
  { id: "st_fire", label: "Fogo", emoji: "🔥", category: "reações" },
  { id: "st_clap", label: "Palmas", emoji: "👏", category: "reações" },
  { id: "st_ok", label: "OK", emoji: "👌", category: "reações" },
  { id: "st_think", label: "Pensando", emoji: "🤔", category: "reações" },
  { id: "st_cry", label: "Choro", emoji: "😭", category: "reações" },
  { id: "st_lol", label: "Risada", emoji: "😂", category: "reações" },
  { id: "st_cool", label: "Cool", emoji: "😎", category: "reações" },
  { id: "st_party", label: "Festa", emoji: "🥳", category: "reações" },
  { id: "st_angry", label: "Raiva", emoji: "😤", category: "reações" },
  { id: "st_pray", label: "Fé", emoji: "🙏", category: "reações" },
  // Memes
  { id: "st_skull", label: "Morri", emoji: "💀", category: "memes" },
  { id: "st_cap", label: "Cap", emoji: "🧢", category: "memes" },
  { id: "st_brain", label: "Cérebro", emoji: "🧠", category: "memes" },
  { id: "st_eyes", label: "Olha", emoji: "👀", category: "memes" },
  { id: "st_100", label: "100", emoji: "💯", category: "memes" },
  { id: "st_goat", label: "GOAT", emoji: "🐐", category: "memes" },
  { id: "st_clown", label: "Palhaço", emoji: "🤡", category: "memes" },
  { id: "st_moai", label: "Moai", emoji: "🗿", category: "memes" },
  { id: "st_nail", label: "Esmalte", emoji: "💅", category: "memes" },
  { id: "st_salute", label: "Continência", emoji: "🫡", category: "memes" },
  // Nullysh
  { id: "st_rocket", label: "Foguete", emoji: "🚀", category: "nullysh" },
  { id: "st_fox", label: "Raposa", emoji: "🦊", category: "nullysh" },
  { id: "st_gem", label: "Diamante", emoji: "💎", category: "nullysh" },
  { id: "st_crown", label: "Coroa", emoji: "👑", category: "nullysh" },
  { id: "st_zap", label: "Raio", emoji: "⚡", category: "nullysh" },
  { id: "st_target", label: "Alvo", emoji: "🎯", category: "nullysh" },
  // Animais
  { id: "st_cat", label: "Gato", emoji: "🐱", category: "animais" },
  { id: "st_dog", label: "Cachorro", emoji: "🐶", category: "animais" },
  { id: "st_panda", label: "Panda", emoji: "🐼", category: "animais" },
  { id: "st_frog", label: "Sapo", emoji: "🐸", category: "animais" },
];

export const STICKER_CATEGORIES = [
  "reações",
  "memes",
  "nullysh",
  "animais",
] as const;

export function getSticker(id: string): StickerItem | undefined {
  return STICKER_PACK.find((s) => s.id === id);
}
