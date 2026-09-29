"""assets/source/icon-original.jpg からアプリアイコン・スプラッシュ・favicon を生成する。

    pip install pillow && python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/source/icon-original.jpg"
OUT = ROOT / "assets/images"

BLUE = (43, 129, 202)  # 元画像の背景色 #2B81CA
CENTER, RADIUS = 512, 458  # 元画像の白い文字盤(円)
SS = 4  # 円の縁をなめらかにするための拡大率
# アダプティブアイコンの文字盤の直径(キャンバス比)。見える範囲(72/108)の約8割にして、円形マスクでも青い縁を残す
ADAPTIVE_RATIO = 0.54


def circle_mask(size: int, radius: float) -> Image.Image:
    big = Image.new("L", (size * SS, size * SS), 0)
    c = size * SS / 2
    r = radius * SS
    ImageDraw.Draw(big).ellipse((c - r, c - r, c + r, c + r), fill=255)
    return big.resize((size, size), Image.LANCZOS)


def dial() -> Image.Image:
    """文字盤だけを切り出した透過画像(一辺 = 直径)。"""
    src = Image.open(SRC).convert("RGB")
    box = (CENTER - RADIUS, CENTER - RADIUS, CENTER + RADIUS, CENTER + RADIUS)
    face = src.crop(box).convert("RGBA")
    face.putalpha(circle_mask(face.width, RADIUS))
    return face


def on_canvas(img: Image.Image, size: int, ratio: float, bg=(0, 0, 0, 0)) -> Image.Image:
    """img を size の正方形の中央に、直径が size * ratio になるよう配置する。"""
    d = round(size * ratio)
    canvas = Image.new("RGBA", (size, size), bg)
    offset = (size - d) // 2
    canvas.alpha_composite(img.resize((d, d), Image.LANCZOS), (offset, offset))
    return canvas


def monochrome(face: Image.Image) -> Image.Image:
    """テーマアイコン用: 目盛りとダンベル(暗い部分)だけを残した白のシルエット。"""
    gray = face.convert("L")
    dark = gray.point(lambda v: 255 if v < 110 else (0 if v > 200 else int((200 - v) * 255 / 90)))
    alpha = ImageChops.multiply(dark, face.getchannel("A"))
    white = Image.new("RGBA", face.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def main() -> None:
    face = dial()
    blue = BLUE + (255,)

    # 通常のアイコン: 青の背景いっぱいに、元画像と同じ比率で文字盤
    on_canvas(face, 1024, 2 * RADIUS / 1024, blue).convert("RGB").save(OUT / "icon.png")
    # Android アダプティブアイコン: 端末のマスク(円・角丸など)で切られないよう、安全領域(直径 66/108)の内側に収める
    on_canvas(face, 1024, ADAPTIVE_RATIO).save(OUT / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), BLUE).save(OUT / "android-icon-background.png")
    on_canvas(monochrome(face), 1024, ADAPTIVE_RATIO).save(OUT / "android-icon-monochrome.png")
    # スプラッシュ(背景色は app.json で青にする)
    on_canvas(face, 1024, 1.0).save(OUT / "splash-icon.png")
    on_canvas(face, 48, 2 * RADIUS / 1024, blue).convert("RGB").save(OUT / "favicon.png")


if __name__ == "__main__":
    main()
