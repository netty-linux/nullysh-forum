/**
 * Molduras de avatar VIP — assets com fundo removido em /public/brand/frames
 * Estética Nullysh + espírito Nitro (Discord).
 */

export type AvatarFrameId =
  | "winter"
  | "spring"
  | "summer"
  | "autumn"
  | "newyear"
  | "nullysh";

export type AvatarFrameDef = {
  id: AvatarFrameId;
  name: string;
  season: string;
  description: string;
  /** PNG com alpha (fundo removido, 512×512) */
  src: string;
  /**
   * Escala da foto dentro da moldura (0–1).
   * Frames de anel usam ~0.68–0.78; padrões abertos um pouco maiores.
   */
  faceScale: number;
};

export const AVATAR_FRAMES: AvatarFrameDef[] = [
  {
    id: "winter",
    name: "Líquido",
    season: "Inverno",
    description: "Anel líquido prata — brilho frio.",
    src: "/brand/frames/winter.png",
    faceScale: 0.58,
  },
  {
    id: "spring",
    name: "Poeira estelar",
    season: "Primavera",
    description: "Nuvem de partículas em órbita.",
    src: "/brand/frames/spring.png",
    faceScale: 0.56,
  },
  {
    id: "summer",
    name: "Moléculas",
    season: "Verão",
    description: "Formas orgânicas em balanço.",
    src: "/brand/frames/summer.png",
    faceScale: 0.54,
  },
  {
    id: "autumn",
    name: "Órbitas",
    season: "Outono",
    description: "Traços pontilhados em movimento.",
    src: "/brand/frames/autumn.png",
    faceScale: 0.56,
  },
  {
    id: "newyear",
    name: "Esfera",
    season: "Ano Novo",
    description: "Wireframe geométrico clean.",
    src: "/brand/frames/newyear.png",
    faceScale: 0.6,
  },
  {
    id: "nullysh",
    name: "Núcleo N",
    season: "Nullysh",
    description: "Cruz modular assinatura da marca.",
    src: "/brand/frames/nullysh.png",
    faceScale: 0.52,
  },
];

export function getAvatarFrame(
  id: AvatarFrameId | null | undefined
): AvatarFrameDef | null {
  if (!id) return null;
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null;
}

export function isAvatarFrameId(v: unknown): v is AvatarFrameId {
  return typeof v === "string" && AVATAR_FRAMES.some((f) => f.id === v);
}
