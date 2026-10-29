"""Иконка «Claude Видеоредактор»: тёмно-зелёная доска и меловой «плей».

py make_icon.py  — claude_video_editor/icon.ico (16…256 px) и icon.png (512 px)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024  # рисуем крупно и уменьшаем — края получаются гладкими
OUT = Path(__file__).parent / "claude_video_editor"


def chalk(img, draw_fn, color, seed):
    """Меловой штрих: рисуем маску, потом выедаем её зерном."""
    m = Image.new("L", (S, S))
    draw_fn(ImageDraw.Draw(m))
    rng = np.random.default_rng(seed)
    grain = np.clip(0.62 + 0.32 * rng.normal(0, 1, (S // 2, S // 2)), 0, 1)
    grain = np.asarray(Image.fromarray((grain * 255).astype(np.uint8)).resize((S, S), Image.BILINEAR), np.float32) / 255
    a = np.clip(np.asarray(m, np.float32) / 255 - (1 - grain) * 0.55, 0, 1) * 1.25
    layer = Image.new("RGBA", (S, S), color + (0,))
    layer.putalpha(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)))
    img.alpha_composite(layer)


def make():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # доска: скруглённый квадрат с мягким градиентом и тёплым светом сверху справа
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    base = np.stack([30 + 10 * (1 - yy), 66 + 18 * (1 - yy), 48 + 8 * (1 - yy)], -1)
    base += np.exp(-(((xx - 0.85) / 0.45) ** 2 + ((yy - 0.1) / 0.5) ** 2))[..., None] * np.array([40, 30, 8])
    board = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
    mask = Image.new("L", (S, S))
    ImageDraw.Draw(mask).rounded_rectangle((40, 40, S - 40, S - 40), radius=210, fill=255)
    board.putalpha(mask)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((52, 70, S - 28, S - 16), radius=210, fill=(0, 0, 0, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    img.alpha_composite(board)
    # деревянная рамка доски
    frame = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((40, 40, S - 40, S - 40), radius=210, outline=(158, 108, 60, 255), width=34)
    img.alpha_composite(frame)
    # меловой «плей»
    chalk(img, lambda d: d.polygon([(370, 290), (370, 734), (760, 512)], fill=255), (238, 240, 232), 1)  # по центру
    chalk(img, lambda d: d.line([(370, 290), (370, 734), (760, 512), (370, 290)], fill=255, width=26, joint="curve"),
          (250, 250, 245), 2)
    return img


if __name__ == "__main__":
    icon = make()
    icon.resize((512, 512), Image.LANCZOS).save(OUT / "icon.png")
    icon.resize((256, 256), Image.LANCZOS).save(OUT / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48),
                                                                           (64, 64), (128, 128), (256, 256)])
    print("готово:", OUT / "icon.ico")
