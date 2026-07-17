/**
 * Conteúdo editorial público (Trilhas / Eventos / Materiais) via D1.
 * Escrito pelo Nullysh Panel; lido pelo Forum.
 */

import { getNullpassDb } from "@/lib/nullpass/d1";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ kind: string }> };

const TABLES: Record<string, string> = {
  trails: "content_trails",
  events: "content_events",
  materials: "content_materials",
};

function mapTrail(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    title: String(r.title),
    description: String(r.description || ""),
    level: String(r.level || "iniciante"),
    vipOnly: Number(r.vip_only) === 1,
    interestTags: safeJson(r.interest_tags, [] as string[]),
    steps: safeJson(r.steps, [] as unknown[]),
    links: safeJson(r.links, [] as unknown[]),
    createdById: r.created_by_id ? String(r.created_by_id) : undefined,
    createdByName: r.created_by_name ? String(r.created_by_name) : undefined,
    createdAt: String(r.created_at || ""),
  };
}

function mapEvent(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    title: String(r.title),
    description: String(r.description || ""),
    type: String(r.type || "live"),
    startsAt: String(r.starts_at),
    durationMin: Number(r.duration_min) || 60,
    hostName: String(r.host_name || "Nullysh"),
    interestTags: safeJson(r.interest_tags, [] as string[]),
    vipOnly: Number(r.vip_only) === 1,
    capacity: Number(r.capacity) || 100,
    createdById: r.created_by_id ? String(r.created_by_id) : undefined,
    createdByName: r.created_by_name ? String(r.created_by_name) : undefined,
    createdAt: String(r.created_at || ""),
  };
}

function mapMaterial(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    title: String(r.title),
    description: String(r.description || ""),
    type: String(r.type || "pdf"),
    category: String(r.category || "Geral"),
    size: r.size_label ? String(r.size_label) : undefined,
    url: r.url ? String(r.url) : null,
    vipOnly: Number(r.vip_only) === 1,
    downloads: Number(r.downloads) || 0,
    createdAt: String(r.created_at || ""),
    createdById: r.created_by_id ? String(r.created_by_id) : undefined,
    createdByName: r.created_by_name ? String(r.created_by_name) : undefined,
  };
}

function safeJson<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(String(raw || "null")) as T;
  } catch {
    return fallback;
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const kind = (await ctx.params).kind;
  const table = TABLES[kind];
  if (!table) {
    return NextResponse.json({ ok: false, error: "kind inválido" }, { status: 400 });
  }

  const db = await getNullpassDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "D1 indisponível", items: [] },
      { status: 503 }
    );
  }

  try {
    const order =
      kind === "events"
        ? "ORDER BY starts_at ASC"
        : "ORDER BY updated_at DESC";
    const { results } = await db
      .prepare(`SELECT * FROM ${table} WHERE active = 1 ${order}`)
      .all<Record<string, unknown>>();

    const rows = results || [];
    const items =
      kind === "trails"
        ? rows.map(mapTrail)
        : kind === "events"
          ? rows.map(mapEvent)
          : rows.map(mapMaterial);

    return NextResponse.json({
      ok: true,
      source: "d1",
      items,
    });
  } catch (e) {
    // Tabela ainda não existe → lista vazia (fallback local no client)
    console.warn("[api/content]", kind, e);
    return NextResponse.json({
      ok: true,
      source: "empty",
      items: [],
    });
  }
}
