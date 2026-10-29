"""Cut the Chinese fonts down to the characters the site actually writes.

A full Chinese font is 1.5 to 26 MB; the site's Chinese text uses well under a thousand
characters, so each subset is a small woff2 that loads only on the Chinese page.

Run it again after changing any Chinese text (npm run fonts:zh). `npm run build` warns
when the text uses a character the subsets don't have yet.

Needs fonttools and brotli (pip install fonttools brotli). The full fonts live in
media-src/fonts/ (not published); they are downloaded there on the first run.
Both fonts are under the SIL Open Font License 1.1.
"""
import pathlib
import re
import urllib.request

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
FULL = ROOT / 'media-src' / 'fonts'
OUT = SRC / 'fonts' / 'zh'

FONTS = [
    # Titles, buttons and the neon sign: rounded and playful, like Nunito.
    ('zcool-kuaile.woff2', 'ZCOOLKuaiLe-Regular.ttf',
     'https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'),
    # Everything else: a warm, bookish Kai tuned for screens (GB glyph forms, for Simplified Chinese).
    ('lxgw-wenkai.woff2', 'LXGWWenKaiGBScreen.ttf',
     'https://github.com/lxgw/LxgwWenKai-Screen/releases/download/v1.530/LXGWWenKaiGBScreen.ttf'),
]

# The ranges the @font-face rules claim (see src/styles/fonts.css): CJK punctuation,
# ideographs and full-width forms. Latin stays with Nunito.
CJK = re.compile('[　-〿㐀-䶿一-鿿＀-￯]')


def site_chars():
    chars = set()
    for path in list(SRC.rglob('*.ts')) + [ROOT / 'index.html']:
        chars.update(CJK.findall(path.read_text(encoding='utf-8')))
    return ''.join(sorted(chars))


def main():
    chars = site_chars()
    FULL.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for out_name, full_name, url in FONTS:
        full = FULL / full_name
        if not full.exists():
            print(f'downloading {full_name}')
            urllib.request.urlretrieve(url, full)
        options = subset.Options()
        options.flavor = 'woff2'
        options.hinting = False
        options.desubroutinize = True
        options.name_IDs = ['*']  # keep the license and copyright records
        font = subset.load_font(str(full), options)
        sub = subset.Subsetter(options)
        sub.populate(text=chars)
        sub.subset(font)
        subset.save_font(font, str(OUT / out_name), options)
        print(f'{out_name}: {(OUT / out_name).stat().st_size / 1024:.0f} KB')
    (OUT / 'chars.txt').write_text(chars, encoding='utf-8')
    print(f'{len(chars)} characters')


if __name__ == '__main__':
    main()
