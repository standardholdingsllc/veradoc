import base64
import json
import re
import shutil
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SPEC_PATH = Path(r"C:\Users\jonah\Downloads\veradoc_logo_exact_reproduction_spec.json")
OUT = Path(r"C:\VeraDoc\veradoc_media_kit")

BRAND = {
    "navy": "#00427E",
    "blue": "#084C85",
    "purple": "#604D80",
    "red": "#B4494A",
    "orange": "#F1460B",
    "cyan": "#8CD0DF",
    "charcoal": "#4B5055",
    "ink": "#0F172A",
    "soft": "#F5FAFC",
}

VISIBLE_BBOX = (245, 295, 767, 718)
ICON_BBOX = (397, 295, 606, 590)
WORDMARK_BBOX = (245, 636, 767, 718)


def mkdirs():
    if OUT.exists():
        shutil.rmtree(OUT)
    for name in [
        "source",
        "svg/full",
        "svg/icon",
        "svg/wordmark",
        "png/full",
        "png/icon",
        "png/wordmark",
        "png/social",
        "png/favicons",
        "docs",
    ]:
        (OUT / name).mkdir(parents=True, exist_ok=True)


def hex_to_rgb(value):
    value = value.strip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def load_logo(spec):
    data = base64.b64decode(spec["lossless_reference_png_base64"])
    return Image.open(BytesIO(data)).convert("RGBA")


def transparent_from_white(img):
    src = img.convert("RGBA")
    out = Image.new("RGBA", src.size)
    in_px = src.load()
    out_px = out.load()
    w, h = src.size
    word_color = hex_to_rgb(BRAND["charcoal"])
    word_max_diff = max(255 - c for c in word_color)
    for y in range(h):
        for x in range(w):
            r, g, b, _ = in_px[x, y]
            diff = max(255 - r, 255 - g, 255 - b)
            if diff < 10:
                out_px[x, y] = (255, 255, 255, 0)
                continue

            if WORDMARK_BBOX[0] - 6 <= x <= WORDMARK_BBOX[2] + 6 and WORDMARK_BBOX[1] - 6 <= y <= WORDMARK_BBOX[3] + 6:
                alpha = max(0, min(255, int(diff / word_max_diff * 255 * 1.08)))
                if alpha < 28:
                    out_px[x, y] = (255, 255, 255, 0)
                else:
                    out_px[x, y] = (*word_color, alpha)
                continue

            alpha = max(0, min(255, int(diff * 1.9)))
            if alpha < 36:
                out_px[x, y] = (255, 255, 255, 0)
                continue
            a = alpha / 255
            rr = max(0, min(255, int((r - 255 * (1 - a)) / a)))
            gg = max(0, min(255, int((g - 255 * (1 - a)) / a)))
            bb = max(0, min(255, int((b - 255 * (1 - a)) / a)))
            out_px[x, y] = (rr, gg, bb, alpha)
    return out


def crop_with_padding(img, bbox, padding):
    left, top, right, bottom = bbox
    box = (
        max(0, left - padding),
        max(0, top - padding),
        min(img.width, right + padding),
        min(img.height, bottom + padding),
    )
    return img.crop(box)


def fit_on_canvas(asset, size, bg=None, margin=0.16):
    canvas = Image.new("RGBA", size, bg or (255, 255, 255, 0))
    max_w = int(size[0] * (1 - margin * 2))
    max_h = int(size[1] * (1 - margin * 2))
    scale = min(max_w / asset.width, max_h / asset.height)
    resized = asset.resize((max(1, int(asset.width * scale)), max(1, int(asset.height * scale))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return canvas


def save_resizes(asset, out_dir, stem, sizes, bg=None, margin=0.16):
    for size in sizes:
        if isinstance(size, int):
            dims = (size, size)
            suffix = f"{size}"
        else:
            dims = size
            suffix = f"{size[0]}x{size[1]}"
        fit_on_canvas(asset, dims, bg=bg, margin=margin).save(out_dir / f"{stem}-{suffix}.png")


def gradient_bg(size, colors):
    w, h = size
    img = Image.new("RGBA", size)
    draw = ImageDraw.Draw(img)
    c1 = hex_to_rgb(colors[0])
    c2 = hex_to_rgb(colors[1])
    for y in range(h):
        t = y / max(1, h - 1)
        draw.line([(0, y), (w, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)) + (255,))
    return img


def add_brand_shapes(bg, palette="light"):
    w, h = bg.size
    layer = Image.new("RGBA", bg.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    colors = [
        hex_to_rgb(BRAND["cyan"]) + ((62 if palette == "dark" else 86),),
        hex_to_rgb(BRAND["orange"]) + ((48 if palette == "dark" else 42),),
        hex_to_rgb(BRAND["purple"]) + ((38 if palette == "dark" else 30),),
    ]

    def bezier(p0, p1, p2, p3, steps=90):
        pts = []
        for i in range(steps + 1):
            t = i / steps
            x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t**2 * p2[0] + t**3 * p3[0]
            y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t**2 * p2[1] + t**3 * p3[1]
            pts.append((x, y))
        return pts

    if w / h > 1.35:
        curves = [
            ((w * 0.54, h * 1.10), (w * 0.66, h * 0.78), (w * 0.76, h * 0.34), (w * 1.10, h * -0.06), max(10, h // 16), colors[0]),
            ((w * 0.74, h * 1.16), (w * 0.80, h * 0.78), (w * 0.92, h * 0.42), (w * 1.12, h * 0.14), max(8, h // 24), colors[1]),
        ]
    else:
        curves = [
            ((w * 0.28, h * 1.10), (w * 0.52, h * 0.84), (w * 0.70, h * 0.30), (w * 1.08, h * -0.05), max(10, h // 16), colors[0]),
            ((w * 0.66, h * 1.14), (w * 0.72, h * 0.76), (w * 0.86, h * 0.36), (w * 1.10, h * 0.08), max(8, h // 24), colors[1]),
        ]
    for p0, p1, p2, p3, width, color in curves:
        draw.line(bezier(p0, p1, p2, p3), fill=color, width=width, joint="curve")

    if palette == "dark":
        draw.rectangle((0, 0, w, h), outline=(140, 208, 223, 30), width=max(1, min(w, h) // 240))
    else:
        draw.rectangle((0, h - max(4, h // 120), w, h), fill=hex_to_rgb(BRAND["cyan"]) + (95,))
    return Image.alpha_composite(bg, layer.filter(ImageFilter.GaussianBlur(max(0.4, min(w, h) / 900))))


def social_banner(size, full_logo, icon, variant, mark_kind="auto"):
    w, h = size
    if variant == "ink":
        bg = add_brand_shapes(gradient_bg(size, ("#071827", "#104B73")), "dark")
    elif variant == "warm":
        bg = add_brand_shapes(gradient_bg(size, ("#FFFFFF", "#FFF3EC")), "light")
    else:
        bg = add_brand_shapes(gradient_bg(size, ("#F8FCFD", "#EEF9FB")), "light")

    if mark_kind == "auto":
        mark_kind = "icon" if w / h <= 1.15 else "full"
    mark = icon if mark_kind == "icon" else full_logo
    max_w = int(w * (0.58 if mark_kind == "icon" else 0.46))
    max_h = int(h * (0.70 if mark_kind == "icon" else 0.72))
    scale = min(max_w / mark.width, max_h / mark.height)
    mark = mark.resize((int(mark.width * scale), int(mark.height * scale)), Image.Resampling.LANCZOS)
    x = int(w * (0.075 if w / h > 1.8 else 0.5)) - (0 if w / h > 1.8 else mark.width // 2)
    y = (h - mark.height) // 2

    if variant == "ink" and mark_kind == "full":
        pad_x = max(24, int(mark.width * 0.12))
        pad_y = max(18, int(mark.height * 0.14))
        panel = Image.new("RGBA", (mark.width + pad_x * 2, mark.height + pad_y * 2), (255, 255, 255, 0))
        panel_draw = ImageDraw.Draw(panel, "RGBA")
        panel_draw.rounded_rectangle((0, 0, panel.width - 1, panel.height - 1), radius=max(10, min(panel.size) // 18), fill=(255, 255, 255, 252))
        panel.alpha_composite(mark, (pad_x, pad_y))
        shadow = Image.new("RGBA", panel.size, (0, 0, 0, 0))
        alpha = panel.getchannel("A").filter(ImageFilter.GaussianBlur(max(8, h // 70)))
        shadow.putalpha(alpha.point(lambda v: int(v * 0.25)))
        panel_y = (h - panel.height) // 2
        bg.alpha_composite(shadow, (x + 8, panel_y + 12))
        bg.alpha_composite(panel, (x, panel_y))
        return bg

    shadow = Image.new("RGBA", mark.size, (0, 0, 0, 0))
    shadow.alpha_composite(mark)
    alpha = shadow.getchannel("A").filter(ImageFilter.GaussianBlur(max(4, h // 90)))
    shadow.putalpha(alpha.point(lambda v: int(v * (0.22 if variant == "ink" else 0.12))))
    bg.alpha_composite(shadow, (x + max(3, w // 220), y + max(4, h // 120)))
    bg.alpha_composite(mark, (x, y))
    return bg


def svg_variants(svg):
    transparent = re.sub(r'\n?<rect x="0" y="0" width="1024" height="1024" fill="#FFFFFF"/>\n?', "\n", svg)
    dark = svg.replace('fill="#FFFFFF"', 'fill="#0F172A"', 1).replace('fill="#4B5055"', 'fill="#F8FAFC"', 1)
    defs = re.search(r"<defs>.*?</defs>", svg, flags=re.S).group(0)
    feather = re.search(r'<path id="feather_symbol".*?/>', svg, flags=re.S).group(0)
    water1 = re.search(r'<path id="small_left_upper_water_stroke".*?/>', svg, flags=re.S).group(0)
    water2 = re.search(r'<path id="main_lower_water_stroke".*?/>', svg, flags=re.S).group(0)
    wordmark = re.search(r'<g id="wordmark_VeraDoc_pe_as_traced_outlines".*?</g>', svg, flags=re.S).group(0)
    icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="360 260 300 360" shape-rendering="geometricPrecision">\n' + f"{defs}\n{feather}\n{water1}\n{water2}\n</svg>\n"
    wordmark_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="220 610 580 130" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">\n' + f"{wordmark}\n</svg>\n"
    return transparent, dark, icon_svg, wordmark_svg


def write_docs(asset_manifest):
    readme = f"""# VeraDoc Media Kit

Restored media kit generated from the original `veradoc_logo_exact_reproduction_spec.json`.

The embedded lossless PNG is preserved as the pixel-faithful white-background source. Transparent PNGs are cleaned extractions from that original raster, so they preserve the original image instead of replacing it with a redesigned mark.

## Folders

- `source`: original reference PNG, cleaned transparent reference, SVG approximation, and source JSON copy.
- `svg`: editable approximation variants.
- `png/full`: primary logo exports.
- `png/icon`: icon/profile exports.
- `png/wordmark`: wordmark exports.
- `png/social`: social-media canvases.
- `png/favicons`: browser and app icon sizes.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    (OUT / "docs" / "asset_manifest.json").write_text(json.dumps(asset_manifest, indent=2), encoding="utf-8")


def main():
    mkdirs()
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    source = load_logo(spec)
    svg = spec["svg_approximation"]["svg"]
    transparent_svg, dark_svg, icon_svg, wordmark_svg = svg_variants(svg)

    transparent = transparent_from_white(source)
    full_crop = crop_with_padding(transparent, VISIBLE_BBOX, 64)
    icon_crop = crop_with_padding(transparent, ICON_BBOX, 46)
    wordmark_crop = crop_with_padding(transparent, WORDMARK_BBOX, 24)

    shutil.copy2(SPEC_PATH, OUT / "source" / "veradoc_logo_exact_reproduction_spec.json")
    source.save(OUT / "source" / "veradoc-logo-reference-1024-white-bg.png")
    transparent.save(OUT / "source" / "veradoc-logo-reference-clean-transparent.png")
    full_crop.save(OUT / "png" / "full" / "veradoc-logo-full-transparent-master.png")
    icon_crop.save(OUT / "png" / "icon" / "veradoc-icon-transparent-master.png")
    wordmark_crop.save(OUT / "png" / "wordmark" / "veradoc-wordmark-transparent-master.png")

    (OUT / "source" / "veradoc-logo-approximation-source.svg").write_text(svg, encoding="utf-8")
    (OUT / "svg" / "full" / "veradoc-logo-full-white-bg.svg").write_text(svg, encoding="utf-8")
    (OUT / "svg" / "full" / "veradoc-logo-full-transparent.svg").write_text(transparent_svg, encoding="utf-8")
    (OUT / "svg" / "full" / "veradoc-logo-full-dark-bg.svg").write_text(dark_svg, encoding="utf-8")
    (OUT / "svg" / "icon" / "veradoc-icon-transparent.svg").write_text(icon_svg, encoding="utf-8")
    (OUT / "svg" / "wordmark" / "veradoc-wordmark-transparent.svg").write_text(wordmark_svg, encoding="utf-8")

    save_resizes(full_crop, OUT / "png" / "full", "veradoc-logo-full-transparent", [256, 512, 1024, 2048], None, 0.08)
    save_resizes(full_crop, OUT / "png" / "full", "veradoc-logo-full-white-bg", [256, 512, 1024, 2048], (255, 255, 255, 255), 0.08)
    save_resizes(full_crop, OUT / "png" / "full", "veradoc-logo-full-soft-bg", [512, 1024, 2048], hex_to_rgb(BRAND["soft"]) + (255,), 0.08)
    save_resizes(icon_crop, OUT / "png" / "icon", "veradoc-icon-transparent", [64, 128, 256, 512, 1024], None, 0.12)
    save_resizes(icon_crop, OUT / "png" / "icon", "veradoc-icon-white-bg", [128, 256, 512, 1024], (255, 255, 255, 255), 0.12)
    save_resizes(icon_crop, OUT / "png" / "icon", "veradoc-icon-soft-bg", [256, 512, 1024], hex_to_rgb(BRAND["soft"]) + (255,), 0.12)
    save_resizes(wordmark_crop, OUT / "png" / "wordmark", "veradoc-wordmark-transparent", [(512, 160), (1024, 320), (2048, 640)], None, 0.08)
    save_resizes(wordmark_crop, OUT / "png" / "wordmark", "veradoc-wordmark-white-bg", [(512, 160), (1024, 320), (2048, 640)], (255, 255, 255, 255), 0.08)

    for size in [16, 32, 48, 64, 96, 128, 180, 192, 256, 512]:
        fit_on_canvas(icon_crop, (size, size), bg=(255, 255, 255, 255), margin=0.14).save(OUT / "png" / "favicons" / f"veradoc-favicon-{size}x{size}.png")
    fit_on_canvas(icon_crop, (256, 256), bg=(255, 255, 255, 255), margin=0.14).save(
        OUT / "png" / "favicons" / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    social_sizes = {
        "x-twitter-header": (1500, 500),
        "linkedin-company-cover": (1128, 191),
        "facebook-cover": (1640, 624),
        "youtube-channel-art": (2560, 1440),
        "open-graph": (1200, 630),
        "instagram-profile": (1080, 1080),
        "linkedin-profile": (400, 400),
    }
    for name, size in social_sizes.items():
        for variant in ["light", "warm", "ink"]:
            social_banner(size, full_crop, icon_crop, variant).save(OUT / "png" / "social" / f"veradoc-{name}-{variant}.png")
            social_banner(size, full_crop, icon_crop, variant, mark_kind="full").save(OUT / "png" / "social" / f"veradoc-{name}-full-{variant}.png")
            social_banner(size, full_crop, icon_crop, variant, mark_kind="icon").save(OUT / "png" / "social" / f"veradoc-{name}-icon-{variant}.png")

    (OUT / "veradoc-logo.json").write_text(
        json.dumps(
            {
                "brand": "VeraDoc.pe",
                "source_spec": "source/veradoc_logo_exact_reproduction_spec.json",
                "exact_reference": "source/veradoc-logo-reference-1024-white-bg.png",
                "primary_svg": "svg/full/veradoc-logo-full-transparent.svg",
                "primary_png": "png/full/veradoc-logo-full-transparent-1024.png",
                "icon_svg": "svg/icon/veradoc-icon-transparent.svg",
                "favicon": "png/favicons/favicon.ico",
                "palette": BRAND,
                "notes": [
                    "Restored to the original-logo media kit before the vector-redesign attempt.",
                    "Transparent PNGs are cleaned extractions from the original raster reference.",
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    manifest = sorted(str(p.relative_to(OUT)).replace("\\", "/") for p in OUT.rglob("*") if p.is_file())
    write_docs(manifest)
    print(f"Restored {len(manifest)} files in {OUT}")


if __name__ == "__main__":
    main()
