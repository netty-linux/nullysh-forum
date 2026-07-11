"""Fix UTF-8 text that was mangled via OEM code pages (cp437/cp850)."""
from pathlib import Path


def fix_line(line: str) -> str:
    for enc in ("cp437", "cp850", "cp1252"):
        try:
            return line.encode(enc).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    out: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        if not buf:
            return
        chunk = "".join(buf)
        buf.clear()
        for enc in ("cp437", "cp850", "cp1252"):
            try:
                out.append(chunk.encode(enc).decode("utf-8"))
                return
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
        out.append(chunk)

    for ch in line:
        if ord(ch) < 128:
            flush()
            out.append(ch)
        else:
            buf.append(ch)
    flush()
    return "".join(out)


def fix_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    fixed = "".join(fix_line(line) for line in text.splitlines(keepends=True))
    fixed = fixed.replace("\r\n", "\n").replace("\r", "\n")
    path.write_text(fixed, encoding="utf-8", newline="\n")
    box = sum(1 for c in fixed if 0x2500 <= ord(c) <= 0x257F)
    print(
        f"{path}: box={box} "
        f"ola={'Olá' in fixed} esta={'está' in fixed} "
        f"middot={'·' in fixed} emdash={'—' in fixed} ellipsis={'…' in fixed}"
    )


def main() -> None:
    targets = [
        Path("src/app/app/page.tsx"),
        Path("src/app/app/saved/page.tsx"),
        Path("src/components/post-card.tsx"),
    ]
    for t in targets:
        if t.exists():
            fix_file(t)

    remaining = []
    for f in list(Path("src").rglob("*.tsx")) + list(Path("src").rglob("*.ts")):
        text = f.read_text(encoding="utf-8", errors="replace")
        if any(0x2500 <= ord(c) <= 0x257F for c in text) or "├" in text or "┬" in text:
            remaining.append(str(f))
    print("remaining:", remaining)


if __name__ == "__main__":
    main()
