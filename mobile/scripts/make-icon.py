#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
WEB = REPO / 'frontend' / 'public'
WEB.mkdir(parents=True, exist_ok=True)

SIZE = 1024
img = Image.new('RGB', (SIZE, SIZE), '#0f0f11')
draw = ImageDraw.Draw(img)
pad = 92
draw.rounded_rectangle((pad, pad, SIZE - pad, SIZE - pad), radius=220, fill='#161618', outline='#4d80f7', width=18)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 420)
except OSError:
    font = ImageFont.load_default()
text = 'T'
bbox = draw.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((SIZE - tw) / 2, (SIZE - th) / 2 - 40), text, fill='#4d80f7', font=font)
src = OUT / 'icon-source.png'
img.save(src, 'PNG')
img.resize((512, 512), Image.Resampling.LANCZOS).save(WEB / 'icon-512.png', 'PNG')
img.resize((192, 192), Image.Resampling.LANCZOS).save(WEB / 'icon-192.png', 'PNG')
img.resize((180, 180), Image.Resampling.LANCZOS).save(WEB / 'apple-touch-icon.png', 'PNG')

ios_icon = ROOT / 'ios' / 'App' / 'App' / 'Assets.xcassets' / 'AppIcon.appiconset' / 'AppIcon-512@2x.png'
if ios_icon.parent.exists():
    img.save(ios_icon, 'PNG')

# Android launcher densities (px): mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
densities = {
    'mdpi': (48, 108),
    'hdpi': (72, 162),
    'xhdpi': (96, 216),
    'xxhdpi': (144, 324),
    'xxxhdpi': (192, 432),
}
res = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
for name, (launcher, foreground) in densities.items():
    folder = res / f'mipmap-{name}'
    if not folder.exists():
        continue
    img.resize((launcher, launcher), Image.Resampling.LANCZOS).save(folder / 'ic_launcher.png', 'PNG')
    img.resize((launcher, launcher), Image.Resampling.LANCZOS).save(folder / 'ic_launcher_round.png', 'PNG')
    img.resize((foreground, foreground), Image.Resampling.LANCZOS).save(folder / 'ic_launcher_foreground.png', 'PNG')

print(src)
