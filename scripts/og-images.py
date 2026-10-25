"""
Generate social preview images (1200x630) from the real screenshots, plus the site's
default OG card and favicon. Uses Pillow + the bundled Noto Serif SC for Chinese text.

    python scripts/og-images.py

Writes:
    public/og/default.png
    public/og/<slug>.png          (only for projects with a screenshot)
    public/favicon.svg
"""
from pathlib import Path
import json
import math

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PAPER = (244, 239, 227)
INK = (25, 23, 18)
INK_SOFT = (75, 69, 56)
MUTE = (123, 115, 98)
VERMILION = (200, 64, 42)
WHITE = (255, 253, 248)

SYSTEM_FONT = Path("C:/Windows/Fonts/NotoSansSC-VF.ttf")
SERIF_CANDIDATES = [Path("C:/Windows/Fonts/msyhbd.ttc"), Path("C:/Windows/Fonts/simhei.ttf"), SYSTEM_FONT]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = SERIF_CANDIDATES if bold else [Path("C:/Windows/Fonts/msyh.ttc"), SYSTEM_FONT]
    for p in candidates:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def draw_text_wrapped(draw, text, xy, max_width, fnt, fill, line_gap=8, max_lines=3):
    x, y = xy
    lines, line = [], ""
    for ch in text:
        trial = line + ch
        if draw.textlength(trial, font=fnt) > max_width and line:
            lines.append(line)
            line = ch
            if len(lines) == max_lines:
                break
        else:
            line = trial
    if line and len(lines) < max_lines:
        lines.append(line)
    if len(lines) == max_lines and sum(len(l) for l in lines) < len(text):
        lines[-1] = lines[-1][:-1] + "…"
    for i, l in enumerate(lines):
        draw.text((x, y + i * (fnt.size + line_gap)), l, font=fnt, fill=fill)
    return y + len(lines) * (fnt.size + line_gap)


def cover_crop(img: Image.Image, size) -> Image.Image:
    w, h = size
    scale = max(w / img.width, h / img.height)
    resized = img.resize((math.ceil(img.width * scale), math.ceil(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    return resized.crop((left, 0, left + w, h))


def make_og(slug: str, name: str, tagline: str, category: str, shot_path: Path | None, out: Path):
    W, H = 1200, 630
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)

    # paper texture: very light diagonal pinstripes
    for i in range(-H, W, 18):
        draw.line([(i, H), (i + H, 0)], fill=(236, 229, 213), width=1)

    draw.rectangle([24, 24, W - 24, H - 24], outline=(210, 200, 180), width=2)

    # text block on the left
    pad = 64
    draw.text((pad, pad + 6), "TODAY'S NEW TOY · 今天又有什么新玩具", font=font(20), fill=VERMILION)
    draw.line([(pad, pad + 40), (W - pad, pad + 40)], fill=(200, 190, 170), width=2)

    y = pad + 70
    name_font = font(56, bold=True)
    for line in wrapped(draw, name, 520, name_font, 2):
        draw.text((pad, y), line, font=name_font, fill=INK)
        y += 68
    y += 6
    y = draw_text_wrapped(draw, tagline, (pad, y), 500, font(26), INK_SOFT, line_gap=10, max_lines=3)

    draw.text((pad, H - pad - 34), f"{category} · 中文介绍 · 真实截图 · 公开数据", font=font(18), fill=MUTE)

    # screenshot on the right, dropped like a print
    if shot_path and shot_path.exists():
        shot = Image.open(shot_path).convert("RGB")
        iw, ih = 520, 325
        img = cover_crop(shot, (iw, ih))
        ix, iy = W - pad - iw, (H - ih) // 2 + 10
        shadow = Image.new("RGBA", (iw + 40, ih + 40), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rectangle([20, 24, iw + 18, ih + 20], fill=(25, 23, 18, 60))
        shadow = shadow.filter(ImageFilter.GaussianBlur(12))
        canvas.paste(shadow, (ix - 20, iy - 20), shadow)
        canvas.paste(img, (ix, iy))
        draw.rectangle([ix, iy, ix + iw, iy + ih], outline=(25, 23, 18), width=2)
    else:
        draw.rectangle([W - pad - 520, (H - 325) // 2, W - pad, (H - 325) // 2 + 325], fill=(236, 229, 213), outline=(180, 170, 150))
        draw.text((W - pad - 380, H // 2 - 10), "NO SCREENSHOT", font=font(20), fill=MUTE)

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, "PNG", optimize=True)


def wrapped(draw, text, max_width, fnt, max_lines):
    lines, line = [], ""
    for ch in text:
        trial = line + ch
        if draw.textlength(trial, font=fnt) > max_width and line:
            lines.append(line)
            line = ch
            if len(lines) == max_lines:
                break
        else:
            line = trial
    if line and len(lines) < max_lines:
        lines.append(line)
    return lines


def main():
    data = json.loads((ROOT / "public/data/projects.json").read_text(encoding="utf-8"))
    for p in data["projects"]:
        shot = ROOT / "public" / p["screenshots"][0]["src"].lstrip("/") if p["screenshots"] else None
        make_og(p["slug"], p["name"], p["tagline"], p["categoryName"], shot, ROOT / "public/og" / f"{p['slug']}.png")
    make_og("default", "今天又有什么新玩具", "每天发现新的开源项目与互联网玩具。中文介绍、真实截图、未知标未知。", "独立开发者杂志", None, ROOT / "public/og/default.png")
    print(f"生成 {len(data['projects'])} 张项目分享图 + 1 张默认图")

    (ROOT / "public/favicon.svg").write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#191712"/>
  <path d="M16 18h32v6H16zM16 30h20v6H16zM16 42h26v6H16z" fill="#f4efe3"/>
  <circle cx="48" cy="45" r="8" fill="#c8402a"/>
</svg>
""",
        encoding="utf-8",
    )
    print("写入 favicon.svg")


if __name__ == "__main__":
    main()
