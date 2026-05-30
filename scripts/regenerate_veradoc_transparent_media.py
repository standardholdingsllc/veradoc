import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "veradoc_media_kit"
SPEC_PATH = KIT / "veradoc-transparent-background-logo-spec-v2-clean-vector.json"

FULL_CROP = (181, 231, 650, 551)
WORDMARK_VIEWBOX = (221, 612, 570, 130)
ICON_CROP = (267, 169, 500, 687)
OLD_ICON_BBOX = (397, 295, 606, 590)
NEW_ICON_BBOX = (313, 215, 721, 810)


def tokenize_path(d: str) -> list[str]:
    return re.findall(r"[MLCZmlcz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d.replace(",", " "))


def cubic(p0, p1, p2, p3, segments=28):
    pts = []
    for i in range(1, segments + 1):
        t = i / segments
        mt = 1 - t
        pts.append(
            (
                mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
                mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
            )
        )
    return pts


def parse_path(d: str) -> list[list[tuple[float, float]]]:
    tokens = tokenize_path(d)
    i = 0
    cmd = ""
    current = (0.0, 0.0)
    start = (0.0, 0.0)
    subpaths: list[list[tuple[float, float]]] = []
    path: list[tuple[float, float]] = []

    def is_cmd(value: str) -> bool:
        return bool(re.fullmatch(r"[MLCZmlcz]", value))

    def num() -> float:
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        if is_cmd(tokens[i]):
            cmd = tokens[i]
            i += 1
        if cmd in ("M", "m"):
            x, y = num(), num()
            if cmd == "m":
                x += current[0]
                y += current[1]
            if path:
                subpaths.append(path)
            current = start = (x, y)
            path = [current]
            cmd = "L" if cmd == "M" else "l"
        elif cmd in ("L", "l"):
            x, y = num(), num()
            if cmd == "l":
                x += current[0]
                y += current[1]
            current = (x, y)
            path.append(current)
        elif cmd in ("C", "c"):
            x1, y1, x2, y2, x3, y3 = num(), num(), num(), num(), num(), num()
            if cmd == "c":
                x1 += current[0]
                y1 += current[1]
                x2 += current[0]
                y2 += current[1]
                x3 += current[0]
                y3 += current[1]
            path.extend(cubic(current, (x1, y1), (x2, y2), (x3, y3)))
            current = (x3, y3)
        elif cmd in ("Z", "z"):
            if path and path[-1] != start:
                path.append(start)
            if path:
                subpaths.append(path)
                path = []
            current = start
            cmd = ""
        else:
            raise RuntimeError(f"Unsupported SVG path command near token {i}: {cmd!r}")

    if path:
        subpaths.append(path)
    return subpaths


def mask_from_paths(
    paths: list[str],
    map_point,
    size: tuple[int, int],
    fill_rule: str = "nonzero",
) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for d in paths:
        if fill_rule == "evenodd":
            path_mask = Image.new("1", size, 0)
            for subpath in parse_path(d):
                one = Image.new("1", size, 0)
                ImageDraw.Draw(one).polygon([map_point(*p) for p in subpath], fill=1)
                path_mask = ImageChops.logical_xor(path_mask, one)
            mask = ImageChops.lighter(mask, path_mask.convert("L").point(lambda v: 255 if v else 0))
        else:
            for subpath in parse_path(d):
                draw.polygon([map_point(*p) for p in subpath], fill=255)
    return mask


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def gradient_image(
    size: tuple[int, int],
    start: tuple[float, float],
    end: tuple[float, float],
    stops: list[tuple[float, str, float]],
) -> Image.Image:
    w, h = size
    y, x = np.mgrid[0:h, 0:w]
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    denom = max(dx * dx + dy * dy, 1e-6)
    t = np.clip(((x - sx) * dx + (y - sy) * dy) / denom, 0, 1)
    rgba = np.zeros((h, w, 4), dtype=np.float32)

    for index, (offset, color, alpha) in enumerate(stops):
        if index == 0:
            continue
        prev_offset, prev_color, prev_alpha = stops[index - 1]
        span = max(offset - prev_offset, 1e-6)
        local = np.clip((t - prev_offset) / span, 0, 1)
        segment = (t >= prev_offset) & (t <= offset)
        c1 = np.array((*hex_rgb(prev_color), prev_alpha * 255), dtype=np.float32)
        c2 = np.array((*hex_rgb(color), alpha * 255), dtype=np.float32)
        rgba[segment] = c1 * (1 - local[segment, None]) + c2 * local[segment, None]

    rgba[t <= stops[0][0]] = np.array((*hex_rgb(stops[0][1]), stops[0][2] * 255), dtype=np.float32)
    rgba[t >= stops[-1][0]] = np.array((*hex_rgb(stops[-1][1]), stops[-1][2] * 255), dtype=np.float32)
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def resize_rgba(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    arr = np.asarray(img).astype(np.float32)
    alpha = arr[:, :, 3:4] / 255.0
    premultiplied = arr[:, :, :3] * alpha

    resized_channels = []
    for channel in range(3):
        source = Image.fromarray(premultiplied[:, :, channel], "F")
        resized_channels.append(np.asarray(source.resize(size, Image.Resampling.LANCZOS)))
    resized_alpha = np.asarray(Image.fromarray(arr[:, :, 3], "F").resize(size, Image.Resampling.LANCZOS))

    alpha_factor = np.clip(resized_alpha / 255.0, 0, 1)
    rgb = np.zeros((*size[::-1], 3), dtype=np.float32)
    for channel in range(3):
        np.divide(resized_channels[channel], alpha_factor, out=rgb[:, :, channel], where=alpha_factor > 1e-6)

    out = np.dstack((np.clip(rgb, 0, 255), np.clip(resized_alpha, 0, 255))).astype(np.uint8)
    return sanitize_edge_matte(Image.fromarray(out, "RGBA"))


def sanitize_edge_matte(img: Image.Image) -> Image.Image:
    arr = np.asarray(img).copy()
    alpha = arr[:, :, 3]
    edge = (alpha >= 1) & (alpha <= 250)
    if not edge.any():
        return img

    soft = np.array([245, 250, 252], dtype=np.float32)
    palette = np.array(
        [
            [0, 66, 126],
            [8, 76, 133],
            [96, 77, 128],
            [180, 73, 74],
            [241, 70, 11],
            [140, 208, 223],
            [119, 199, 217],
            [75, 80, 85],
        ],
        dtype=np.float32,
    )
    rgb = arr[:, :, :3].astype(np.float32)
    soft_dist = np.linalg.norm(rgb - soft, axis=2)
    palette_dist = np.linalg.norm(rgb[:, :, None, :] - palette[None, None, :, :], axis=3)
    nearest = palette_dist.argmin(axis=2)
    nearest_dist = np.take_along_axis(palette_dist, nearest[:, :, None], axis=2)[:, :, 0]
    suspect = edge & (soft_dist < nearest_dist)
    if suspect.any():
        arr[:, :, :3][suspect] = palette[nearest[suspect]].astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def extract_paths(svg: str, ids: list[str]) -> dict[str, str]:
    paths = {}
    for path_id in ids:
        match = re.search(rf'<path id="{re.escape(path_id)}" d="(.*?)"', svg, flags=re.S)
        if not match:
            raise RuntimeError(f"Could not find path {path_id}.")
        paths[path_id] = match.group(1)
    return paths


def extract_wordmark(full_svg: str) -> tuple[str, list[str]]:
    group = re.search(r'<g id="wordmark_VeraDoc_pe_as_traced_outlines".*?</g>', full_svg, flags=re.S)
    if not group:
        raise RuntimeError("Could not find wordmark group.")
    return group.group(0), re.findall(r'<path id="[^"]+" d="(.*?)"', group.group(0), flags=re.S)


def artwork_renderer(spec, wordmark_paths, icon_transform=(1.0, 0.0, 0.0)):
    icon_paths = extract_paths(
        spec["svg_master_template"],
        ["feather-body-with-transparent-internal-cuts", "left-detached-wave", "main-lower-wave"],
    )
    feather_stops = [(s["offset"], s["color"], s.get("opacity", 1.0)) for s in spec["gradients"]["featherGradient"]["stops"]]
    wave_stops = [(s["offset"], s["color"], s.get("opacity", 1.0)) for s in spec["gradients"]["waveGradient"]["stops"]]
    scale_icon, tx, ty = icon_transform

    def transform_icon(x, y):
        return x * scale_icon + tx, y * scale_icon + ty

    def render(
        output_size: tuple[int, int],
        viewbox: tuple[int, int, int, int],
        margin: float = 0.0,
        include_icon: bool = True,
        include_wordmark: bool = False,
    ) -> Image.Image:
        aa = 4 if max(output_size) <= 1024 else 2
        w, h = output_size
        hi_size = (w * aa, h * aa)
        canvas = Image.new("RGBA", hi_size, (255, 255, 255, 0))
        vx, vy, vw, vh = viewbox
        max_w = w * (1 - margin * 2)
        max_h = h * (1 - margin * 2)
        fit = min(max_w / vw, max_h / vh)
        ox = (w - vw * fit) / 2
        oy = (h - vh * fit) / 2

        def map_world(x, y):
            return (round((ox + (x - vx) * fit) * aa), round((oy + (y - vy) * fit) * aa))

        if include_icon:
            def map_icon(x, y):
                return map_world(*transform_icon(x, y))

            fg = spec["gradients"]["featherGradient"]
            wg = spec["gradients"]["waveGradient"]
            feather_start = map_icon(fg["x1"], fg["y1"])
            feather_end = map_icon(fg["x2"], fg["y2"])
            wave_start = map_icon(wg["x1"], wg["y1"])
            wave_end = map_icon(wg["x2"], wg["y2"])

            feather_mask = mask_from_paths([icon_paths["feather-body-with-transparent-internal-cuts"]], map_icon, hi_size)
            feather = gradient_image(hi_size, feather_start, feather_end, feather_stops)
            feather.putalpha(ImageChops.multiply(feather.getchannel("A"), feather_mask))
            canvas.alpha_composite(feather)

            wave_mask = mask_from_paths(
                [icon_paths["left-detached-wave"], icon_paths["main-lower-wave"]],
                map_icon,
                hi_size,
            )
            wave = gradient_image(hi_size, wave_start, wave_end, wave_stops)
            wave.putalpha(ImageChops.multiply(wave.getchannel("A"), wave_mask))
            canvas.alpha_composite(wave)

        if include_wordmark:
            wordmark_mask = mask_from_paths(wordmark_paths, map_world, hi_size, "evenodd")
            wordmark = Image.new("RGBA", hi_size, (*hex_rgb("#4B5055"), 255))
            wordmark.putalpha(wordmark_mask)
            canvas.alpha_composite(wordmark)

        return resize_rgba(canvas, output_size) if aa != 1 else canvas

    return render


def save_png(renderer, path: Path, output_size, viewbox, margin=0.0, include_icon=True, include_wordmark=False):
    renderer(output_size, viewbox, margin, include_icon, include_wordmark).save(path)


def scaled_gradient_defs(scale: float, tx: float, ty: float) -> str:
    transform = f"matrix({scale:.10f} 0 0 {scale:.10f} {tx:.10f} {ty:.10f})"
    return f"""<defs>
  <linearGradient id="featherGradient" x1="430" y1="752" x2="716" y2="215" gradientUnits="userSpaceOnUse" gradientTransform="{transform}">
    <stop offset="0%" stop-color="#00427E"/>
    <stop offset="34%" stop-color="#084C85"/>
    <stop offset="57%" stop-color="#604D80"/>
    <stop offset="78%" stop-color="#B4494A"/>
    <stop offset="100%" stop-color="#F1460B"/>
  </linearGradient>
  <linearGradient id="waveGradient" x1="313" y1="781" x2="602" y2="741" gradientUnits="userSpaceOnUse" gradientTransform="{transform}">
    <stop offset="0%" stop-color="#8CD0DF" stop-opacity="0.88"/>
    <stop offset="55%" stop-color="#8CD0DF" stop-opacity="0.98"/>
    <stop offset="100%" stop-color="#77C7D9" stop-opacity="0.84"/>
  </linearGradient>
</defs>"""


def main() -> None:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    icon_svg = spec["svg_master_template"]
    if "<rect" in icon_svg:
        raise RuntimeError("The clean-vector SVG template unexpectedly contains a background rectangle.")

    wordmark_group, wordmark_paths = extract_wordmark((KIT / "svg" / "full" / "veradoc-logo-full-transparent.svg").read_text(encoding="utf-8"))

    old_w = OLD_ICON_BBOX[2] - OLD_ICON_BBOX[0]
    old_h = OLD_ICON_BBOX[3] - OLD_ICON_BBOX[1]
    new_w = NEW_ICON_BBOX[2] - NEW_ICON_BBOX[0]
    new_h = NEW_ICON_BBOX[3] - NEW_ICON_BBOX[1]
    logo_scale = min(old_w / new_w, old_h / new_h)
    tx = ((OLD_ICON_BBOX[0] + OLD_ICON_BBOX[2]) / 2) - ((NEW_ICON_BBOX[0] + NEW_ICON_BBOX[2]) / 2) * logo_scale
    ty = OLD_ICON_BBOX[1] - NEW_ICON_BBOX[1] * logo_scale

    icon_paths_markup = "\n".join(
        re.findall(
            r'<path id="(?:feather-body-with-transparent-internal-cuts|left-detached-wave|main-lower-wave)".*?/>',
            icon_svg,
            flags=re.S,
        )
    )
    transformed_icon = f'<g id="corrected-transparent-icon" transform="translate({tx:.10f} {ty:.10f}) scale({logo_scale:.10f})">\n{icon_paths_markup}\n</g>'
    full_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
{scaled_gradient_defs(logo_scale, tx, ty)}
{transformed_icon}
{wordmark_group}
</svg>
"""
    wordmark_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{WORDMARK_VIEWBOX[0]} {WORDMARK_VIEWBOX[1]} {WORDMARK_VIEWBOX[2]} {WORDMARK_VIEWBOX[3]}" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
{wordmark_group}
</svg>
"""
    icon_cropped_svg = icon_svg.replace("viewBox=\"0 0 1024 1024\"", f"viewBox=\"{ICON_CROP[0]} {ICON_CROP[1]} {ICON_CROP[2]} {ICON_CROP[3]}\"")

    (KIT / "veradoc-transparent-background-logo-master-v2.svg").write_text(icon_svg, encoding="utf-8")
    (KIT / "svg" / "icon" / "veradoc-icon-transparent.svg").write_text(icon_cropped_svg, encoding="utf-8")
    (KIT / "svg" / "full" / "veradoc-logo-full-transparent.svg").write_text(full_svg, encoding="utf-8")
    (KIT / "svg" / "wordmark" / "veradoc-wordmark-transparent.svg").write_text(wordmark_svg, encoding="utf-8")

    icon_renderer = artwork_renderer(spec, wordmark_paths)
    full_renderer = artwork_renderer(spec, wordmark_paths, (logo_scale, tx, ty))

    save_png(icon_renderer, KIT / "source" / "veradoc-logo-reference-clean-transparent.png", (1024, 1024), (0, 0, 1024, 1024))
    save_png(icon_renderer, KIT / "png" / "icon" / "veradoc-icon-transparent-master.png", (ICON_CROP[2], ICON_CROP[3]), ICON_CROP)
    save_png(full_renderer, KIT / "png" / "full" / "veradoc-logo-full-transparent-master.png", (FULL_CROP[2], FULL_CROP[3]), FULL_CROP, include_wordmark=True)
    save_png(icon_renderer, KIT / "png" / "wordmark" / "veradoc-wordmark-transparent-master.png", (WORDMARK_VIEWBOX[2], WORDMARK_VIEWBOX[3]), WORDMARK_VIEWBOX, include_icon=False, include_wordmark=True)

    for size in (64, 128, 256, 512, 1024):
        save_png(icon_renderer, KIT / "png" / "icon" / f"veradoc-icon-transparent-{size}.png", (size, size), ICON_CROP, 0.12)
    for size in (256, 512, 1024, 2048):
        save_png(full_renderer, KIT / "png" / "full" / f"veradoc-logo-full-transparent-{size}.png", (size, size), FULL_CROP, 0.08, include_wordmark=True)
    for width, height in ((512, 160), (1024, 320), (2048, 640)):
        save_png(icon_renderer, KIT / "png" / "wordmark" / f"veradoc-wordmark-transparent-{width}x{height}.png", (width, height), WORDMARK_VIEWBOX, 0.08, include_icon=False, include_wordmark=True)

    for rel in [
        "png/icon/veradoc-icon-transparent-1024.png",
        "png/full/veradoc-logo-full-transparent-1024.png",
        "png/wordmark/veradoc-wordmark-transparent-1024x320.png",
        "source/veradoc-logo-reference-clean-transparent.png",
    ]:
        img = Image.open(KIT / rel).convert("RGBA")
        print(f"{rel}: size={img.size} alpha={img.getchannel('A').getextrema()} bbox={img.getchannel('A').getbbox()}")


if __name__ == "__main__":
    main()
