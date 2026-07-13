/**
 * Nullysh Pay — domínio do gateway (por usuário).
 * Marca Nullysh Pay · motor Asaas no servidor.
 */

export type NullyshPayProductType =
  | "digital"
  | "course"
  | "subscription"
  | "service"
  | "other";

export type NullyshPayProductStatus = "draft" | "active" | "archived";

export type NullyshPayOfferStatus = "draft" | "active" | "paused" | "ended";

export type NullyshPaySaleStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "canceled"
  | "failed";

export type NullyshPayProduct = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  type: NullyshPayProductType;
  /** Preço cheio BRL */
  price: number;
  /** Preço promocional opcional */
  promoPrice?: number | null;
  promoActive?: boolean;
  coverUrl?: string | null;
  /** Link de entrega (área de membros, drive, etc.) — só dono vê no painel */
  deliveryUrl?: string | null;
  status: NullyshPayProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type NullyshPayOffer = {
  id: string;
  ownerId: string;
  productId: string;
  name: string;
  /** Headline da oferta */
  headline: string;
  price: number;
  promoPrice?: number | null;
  promoActive?: boolean;
  /** URL pública do checkout (placeholder até Asaas) */
  checkoutSlug: string;
  status: NullyshPayOfferStatus;
  createdAt: string;
  updatedAt: string;
};

export type NullyshPaySale = {
  id: string;
  ownerId: string;
  productId: string;
  offerId?: string | null;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  status: NullyshPaySaleStatus;
  /** id Asaas futuro */
  externalId?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

export const NP_PRODUCT_TYPE_LABEL: Record<NullyshPayProductType, string> = {
  digital: "Infoproduto digital",
  course: "Curso",
  subscription: "Assinatura",
  service: "Serviço",
  other: "Outro",
};

export const NP_PRODUCT_STATUS_LABEL: Record<NullyshPayProductStatus, string> =
  {
    draft: "Rascunho",
    active: "Ativo",
    archived: "Arquivado",
  };

export const NP_OFFER_STATUS_LABEL: Record<NullyshPayOfferStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  ended: "Encerrada",
};

export const NP_SALE_STATUS_LABEL: Record<NullyshPaySaleStatus, string> = {
  pending: "Pendente",
  paid: "Paga",
  refunded: "Estornada",
  canceled: "Cancelada",
  failed: "Falhou",
};
