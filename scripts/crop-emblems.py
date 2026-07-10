"""
Crop badge sprite → PNG transparente.
Estratégia: célula inteira (quase) → flood branco → separar ícone do label
por projeção horizontal (não corta a base do escudo no meio).
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\01 Bigode\.grok\sessions\D%3A%5CNullysh.DEV%5CNULLYSH-FORUM%5Cnullysh-forum"
    r"\019f4867-035c-7c12-9b19-4c615ebc00ab\assets"
    r"\image-72f62dd3-f35f-4e10-92aa-3c5315792dcb.jpg"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "brand" / "emblems"

IDS = [
    "revenue-500",
    "revenue-1k",
    "revenue-5k",
    "revenue-10k",
    "revenue-50k",
    "revenue-100k",
    "title-mestre",
    "title-grao-mestre",
    "title-desafiante",
    "title-lendario",
    "title-divino",
    "title-soberano",
    "role-moderador",
    "role-vip",
    "role-suporte",
    "role-mentor",
    "role-elite",
    "role-admin",
    "tenure-1m",
    "tenure-6m",
    "tenure-1y",
    "tenure-2y",
    "tenure-5y",
    "tenure-10y",
    "special-top-autor",
    "special-mais-ativo",
    "special-evento",
    "special-criador-ideias",
    "special-viral",
    "special-lendario",
    "rank-ferro",
    "rank-bronze",
    "rank-prata",
    "rank-ouro",
    "rank-platina",
    "rank-diamante",
]

COLS, ROWS = 6, 6
# célula quase completa — o label é removido depois, não por corte cego
CELL_INSET = 0.012
# margem extra ao redor do ícone detectado (px relativos ao cell)
ICON_PAD_RATIO = 0.04


def flood_transparent(rgba: Image.Image, bg_thr: int = 247) -> Image.Image:
    arr = np.array(rgba).copy()
    h, w = arr.shape[:2]
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    def is_bg(y: int, x: int) -> bool:
        return r[y, x] >= bg_thr and g[y, x] >= bg_thr and b[y, x] >= bg_thr

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))

    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or visited[y, x]:
            continue
        visited[y, x] = True
        if not is_bg(y, x):
            continue
        arr[y, x, 3] = 0
        q.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))

    pure = (r >= 252) & (g >= 252) & (b >= 252) & (arr[:, :, 3] > 0)
    arr[pure, 3] = 0
    return Image.fromarray(arr, "RGBA")


def split_icon_from_label(img: Image.Image) -> Image.Image:
    """
    Detecta o vale horizontal entre o bloco do ícone (topo) e o label (base).
    Mantém todo o ícone + pequena margem; descarta só o texto.
    """
    arr = np.array(img)
    h, w = arr.shape[:2]
    alpha = arr[:, :, 3] > 15
    if not alpha.any():
        return img

    # densidade por linha
    dens = alpha.sum(axis=1).astype(np.float64) / max(w, 1)

    # região útil com conteúdo
    ys = np.where(dens > 0.01)[0]
    if len(ys) < 8:
        return img
    y_top, y_bot = int(ys[0]), int(ys[-1])
    band = dens[y_top : y_bot + 1]
    if len(band) < 10:
        return img

    # suaviza
    k = max(3, len(band) // 40)
    kernel = np.ones(k) / k
    smooth = np.convolve(band, kernel, mode="same")

    # procura mínimo na metade inferior (onde fica o gap ícone→label)
    search_start = int(len(smooth) * 0.45)
    search_end = int(len(smooth) * 0.92)
    if search_end <= search_start + 2:
        return img

    segment = smooth[search_start:search_end]
    # vale = densidade baixa relativa ao pico do ícone
    icon_peak = float(smooth[:search_start].max()) if search_start > 0 else float(smooth.max())
    if icon_peak < 0.05:
        return img

    rel = segment / (icon_peak + 1e-6)
    # melhor corte: menor densidade relativa, mas com um pouco de ícone acima
    min_idx = int(np.argmin(rel))
    # confirma que é um vale (não o próprio fim do ícone)
    valley = float(rel[min_idx])
    # se o “vale” ainda é alto, não há label separado — mantém tudo
    if valley > 0.35:
        # fallback: corta os últimos ~18% se forem tipicamente label
        cut_local = int(len(smooth) * 0.82)
    else:
        cut_local = search_start + min_idx

    # sobe um pouco o corte se a linha ainda tiver massa (não cortar base do escudo)
    # desce se a linha for quase vazia
    abs_cut = y_top + cut_local
    # expande para baixo enquanto a linha tiver “massa de ícone” colorida
    # (não só texto fino)
    for y in range(abs_cut, min(h, abs_cut + int(h * 0.08))):
        row = arr[y]
        a = row[:, 3] > 15
        if a.sum() < w * 0.03:
            break
        rr, gg, bb = row[a, 0].astype(int), row[a, 1].astype(int), row[a, 2].astype(int)
        # cor saturada / não-cinza = parte do ícone
        sat = np.maximum(np.maximum(rr, gg), bb) - np.minimum(np.minimum(rr, gg), bb)
        if sat.mean() > 25 or (rr.mean() + gg.mean() + bb.mean()) / 3 > 100:
            abs_cut = y + 1
        else:
            # texto cinza escuro
            dark = (rr < 100) & (gg < 100) & (bb < 100)
            if dark.mean() > 0.5:
                break
            abs_cut = y + 1

    abs_cut = min(h, max(abs_cut, y_top + int((y_bot - y_top) * 0.55)))
    # margem extra embaixo do ícone (a “sobra” que faltava)
    abs_cut = min(h, abs_cut + max(4, int(h * 0.03)))

    return Image.fromarray(arr[:abs_cut], "RGBA")


def trim_alpha(img: Image.Image, pad: int = 14) -> Image.Image:
    arr = np.array(img)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 5)
    if len(xs) == 0:
        return img
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(img.width - 1, x1 + pad)
    y1 = min(img.height - 1, y1 + pad)
    return img.crop((x0, y0, x1 + 1, y1 + 1))


def fit_square(img: Image.Image, size: int = 96) -> Image.Image:
    max_side = max(img.width, img.height)
    # deixa 1–2px de respiro, sem esmagar
    scale = (size * 0.97) / max_side
    nw = max(1, int(round(img.width * scale)))
    nh = max(1, int(round(img.height * scale)))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - nw) // 2, (size - nh) // 2), img)
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    W, H = im.size
    cw, ch = W / COLS, H / ROWS

    for i, bid in enumerate(IDS):
        row, col = divmod(i, COLS)
        x0 = col * cw + cw * CELL_INSET
        y0 = row * ch + ch * CELL_INSET
        x1 = (col + 1) * cw - cw * CELL_INSET
        y1 = (row + 1) * ch - ch * CELL_INSET
        cell = im.crop((int(x0), int(y0), int(x1), int(y1)))
        cell = flood_transparent(cell, bg_thr=246)
        cell = split_icon_from_label(cell)
        cell = trim_alpha(cell, pad=14)
        out = fit_square(cell, 96)
        out.save(OUT / f"{bid}.png", "PNG", optimize=True)
        print(f"{bid}: {cell.size} -> {out.size}")

    print(f"done: {len(list(OUT.glob('*.png')))} in {OUT}")


if __name__ == "__main__":
    main()
