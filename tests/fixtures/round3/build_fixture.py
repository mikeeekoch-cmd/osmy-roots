#!/usr/bin/env python3
"""Generate the round-3 fictional twin packet.

Every person, place, date, photograph and memory here is invented. The generator reads
no private source. Its purpose is to exercise the same parser, manifest schema, pair
validation and book edition as the real packet, in public, with nothing to redact.

Run from the repository root:
    python3 tests/fixtures/round3/build_fixture.py
Requires Pillow, NumPy and SciPy. The enhanced derivatives use the same luminance-only
pipeline as the real packet, so alignment is exact by construction.
"""
import hashlib
import json
import os
import shutil
import zipfile
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.ndimage import gaussian_filter, median_filter, uniform_filter

ROOT = os.path.dirname(os.path.abspath(__file__))
PACKET = os.path.join(ROOT, 'packet')
UPLOAD = os.path.join(PACKET, '01-upload')
MEDIA = os.path.join(PACKET, '02-media', 'enhanced')
FIXED_TIME = datetime(2026, 9, 10, 20, 0, 0, tzinfo=timezone.utc)

PEOPLE = [
    ('Rowan Vale', 'b. 1994', 'Willowford', '4 May 1994', None),
    ('Martin Vale', '1962 - 2019', 'Willowford', '2 February 1962', '9 June 2019'),
    ('Clara Vale', 'b. 1965', 'Harbourfield', '1965', None),
    ('Jonah Vale', '1930 - 1998', 'Alder Vale', 'around 1930', 'around 1998'),
    ('Ellis Vale', '1899 - 1971', 'Alder Vale', 'around 1899', 'around 1971'),
    ('Marta Vale', '1902 - 1984', None, 'around 1902', 'around 1984'),
]

# (filename, era, caption sentence, people named, left-to-right line)
PHOTOS = [
    ('Ellis Vale.jpg', 'old', 'Ellis Vale. The print carries his name and no date.', ['Ellis Vale'], ['Ellis Vale']),
    ('Marta Vale.jpg', 'old', 'Marta Vale. An old portrait labelled with her name.', ['Marta Vale'], ['Marta Vale']),
    ('Ellis and Marta.jpg', 'old', 'Ellis Vale and Marta Vale. The names came with the photograph; their order was not written down.', ['Ellis Vale', 'Marta Vale'], None),
    ('The move to Harbourfield.jpg', 'old', 'The family who left Alder Vale for Harbourfield: Ellis, Marta and Jonah. The old caption names Jonah on the left and gives no full order.', ['Ellis Vale', 'Marta Vale', 'Jonah Vale'], None),
    ('Jonah Vale.jpg', 'modern', 'Jonah Vale on his own. The name came with the photograph.', ['Jonah Vale'], ['Jonah Vale']),
    ('Martin Vale.jpg', 'modern', 'Martin Vale on his own.', ['Martin Vale'], ['Martin Vale']),
    ('Clara Vale.jpg', 'modern', 'Clara Vale on her own.', ['Clara Vale'], ['Clara Vale']),
    ('Rowan and Martin.jpg', 'modern', 'Rowan and Martin Vale at the harbour. No date or left-to-right order was supplied.', ['Rowan Vale', 'Martin Vale'], None),
]

CHAPTER_TEXT = {
    'ch-dedication': "This book is for Martin Vale, who asked for it first.\n\nHe asked when I was seventeen, and again at twenty. I said yes both times and did nothing about it. This is late, and it is here.",
    'ch-alder-vale': "The Vale family comes from Alder Vale, a settlement on the western bank of the Willow river. The parish there kept registers from the 1790s, and the name Vale appears in them from the beginning.\n\nBy the 1890s Alder Vale had a mill, a school and about sixty households. The 2010 count recorded ninety-one residents.\n\nThe surname and the place name are the same word. The settlement was named for the family, and the family carries the name of its ground.",
    'ch-ellis': "Ellis Vale was born about 1899 in Alder Vale. He worked as a harness-maker, and the trade is what the family remembers first.\n\nHe married Marta Vale, born about 1902. Their son Jonah was born about 1930.\n\nEllis died about 1971. Both of his years are approximate and come from family notes rather than a certificate.",
    'ch-jonah': "Jonah Vale was born about 1930 in Alder Vale and moved with his parents to Harbourfield as a boy.\n\nHe worked at the harbour for forty years. His son Martin was born in 1962.\n\nJonah died in 1998.",
    'ch-martin': "Martin Vale was born on 2 February 1962 in Willowford. He trained as a joiner and worked in Harbourfield.\n\nWith Clara Vale, born 1965 in Harbourfield, he brought up one son, Rowan.\n\nMartin died on 9 June 2019.",
    'ch-rowan': "Rowan Vale was born on 4 May 1994 in Willowford. Rowan collected the notes, photographs and messages that this book is made from.",
    'ch-move': "The move from Alder Vale to Harbourfield happened around 1946. Clara remembered the year from a story, not from a document, and it is printed as a story.\n\nThe photograph labelled as the family who left Alder Vale shows Ellis, Marta and Jonah. The old caption names Jonah on the left. It does not give a full order, so the rest is left open.",
    'ch-harness': "Of everything recorded about Ellis Vale, the part the family tells most often is the harness.\n\nHe worked with leather all his life. People came from the whole valley for his work. His funeral is remembered in the same terms.",
    'ch-open': "These are the questions this edition has not answered.\n\nMarta Vale's birth year. One note says 1902 and another says 1904. There is no certificate, so both are kept and neither is marked correct.\n\nThe order of people in the two group photographs. Names came with them; positions did not.\n\nEllis Vale's own years. About 1899 to 1971, both approximate.",
    'ch-sources': "This book stands on family sources first: Clara Vale's notes, the photographs kept in the family, and three saved message threads.\n\nWhere a statement rests on an uploaded file, the source register at the back gives that file and the passage gives its number. Where nobody could remember and no document was found, the entry says so.",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def draw_photo(path, seed, era, label):
    """A deterministic invented image. Old ones get grain, a warm cast and a print border."""
    rng = np.random.default_rng(seed)
    w, h = 720, 900
    base = rng.integers(90, 150, size=(h, w), dtype=np.uint8).astype(np.float32)
    base = gaussian_filter(base, 24)
    yy, xx = np.mgrid[0:h, 0:w]
    # A simple invented figure: an oval head and shoulders, never a real face.
    head = ((xx - w / 2) ** 2 / (110 ** 2) + (yy - h * 0.34) ** 2 / (150 ** 2)) < 1
    body = ((xx - w / 2) ** 2 / (260 ** 2) + (yy - h * 1.05) ** 2 / (520 ** 2)) < 1
    base[body] = base[body] * 0.35 + 40
    base[head] = base[head] * 0.55 + 120
    if era == 'old':
        base = base * 0.82 + 26
        base += rng.normal(0, 7, size=base.shape)
    img = np.clip(base, 0, 255).astype(np.uint8)
    rgb = np.stack([img, img, img], axis=-1).astype(np.float32)
    if era == 'old':
        rgb[..., 0] *= 1.10
        rgb[..., 2] *= 0.86
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    if era == 'old':
        border = Image.new('RGB', (w + 60, h + 60), (232, 226, 210))
        border.paste(out, (30, 30))
        out = border
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default()
    d.text((14, out.height - 18), f'FICTIONAL FIXTURE  {label}', fill=(60, 60, 60), font=font)
    out.save(path, 'JPEG', quality=88)


def enhance(src, dst):
    """The same luminance-only pass the real packet uses. Geometry cannot change."""
    im = Image.open(src).convert('YCbCr')
    a = np.asarray(im).astype(np.float32)
    y, cb, cr = a[..., 0], a[..., 1], a[..., 2]
    lo, hi = np.percentile(y, [0.8, 99.2])
    if hi - lo < 8:
        lo, hi = float(y.min()), float(max(y.max(), y.min() + 8))
    y = y * 0.45 + np.clip((y - lo) * (255.0 / (hi - lo)), 0, 255) * 0.55
    med = median_filter(y, size=3)
    var = uniform_filter(y * y, 5) - uniform_filter(y, 5) ** 2
    flat = np.clip(1.0 - var / 90.0, 0, 1)
    y = y * (1 - 0.4 * flat) + med * (0.4 * flat)
    y = np.clip(y + 0.16 * (y - gaussian_filter(y, 12.0)), 0, 255)
    hp = y - gaussian_filter(y, 1.1)
    hp = np.where(np.abs(hp) < 2.0, 0.0, hp)
    y = np.clip(y + 0.4 * hp, 0, 255)
    res = Image.fromarray(np.stack([y, cb, cr], axis=-1).astype(np.uint8), 'YCbCr').convert('RGB')
    assert res.size == im.size
    res.save(dst, 'JPEG', quality=95, subsampling=0, optimize=True)


def family_notes():
    lines = ['Family notes', '', 'What I have written down so far. Some dates are still missing.', '']
    detail = {
        'Rowan Vale': ('This is me. Willowford. I put these notes together.', 'His father was Martin Vale. His mother was Clara Vale.'),
        'Martin Vale': ('My dad, Martin. From Willowford, later Harbourfield.', 'His partner was Clara Vale. His father was Jonah Vale.'),
        'Clara Vale': ('My mum, Clara. She kept the photographs.', 'Her partner was Martin Vale.'),
        'Jonah Vale': ('Jonah worked at the harbour. He came from Alder Vale as a boy.', 'His father was Ellis Vale. His mother was Marta Vale.'),
        'Ellis Vale': ('Ellis came from Alder Vale and was a harness-maker. Both years below are approximate.', 'His partner was Marta Vale.'),
        'Marta Vale': ('Marta came from Alder Vale. One note gives 1902 and another gives 1904. This record contains an unresolved discrepancy.', 'Her partner was Ellis Vale.'),
    }
    for name, _, place, birth, death in PEOPLE:
        intro, rel = detail[name]
        lines += [f'## {name}', '', intro, '']
        if name == 'Marta Vale':
            lines += ['Born around 1902 or around 1904. Died around 1984.', '']
        else:
            born = f'Born on {birth}.' if birth and birth[0].isdigit() else f'Born {birth}.'
            lines.append(born if not death else f'{born} Died {"on " if death[0].isdigit() else ""}{death}.')
            lines.append('')
        lines += [rel, '']
    return '\n'.join(lines)


def photo_notes():
    lines = ['Photo notes', '', 'The names and occasions that came with the pictures.', '']
    for name, _era, caption, named, order in PHOTOS:
        lines += [f'## {name}', '', caption, '', f'People named in the caption: {"; ".join(named)}.']
        if order:
            lines.append(f'Left to right: {"; ".join(order)}.')
        lines.append('')
    return '\n'.join(lines)


def archive_findings():
    return """Archive findings, 1804 to 1902

Notes I typed up from the Willowford parish registers. Anything I am guessing at, I have said so.

## The 1804 register entry

A register of 1804 records "Thomas Vale, of Alder Vale, wheelwright, witness". This is the
earliest Vale entry I have found. Whether he belongs to our line is not proved.

People named in this record: Thomas Vale.

## The 1902 register entries

11 March 1902. At the marriage of Peter Marsh and Ann Holt the witnesses are recorded as
"Ellis Vale and Susan Vale, of Alder Vale". Susan Vale may be Ellis Vale's sister. The
record gives no relationship.

People named in these records: Ellis Vale; Susan Vale.

## What I still want to check

Whether Thomas Vale of 1804 is our ancestor. Who Susan Vale was. Where Marta Vale was born.
"""


def chronology_csv():
    rows = [
        ('~1804', 'approximate', 'Thomas Vale recorded as a witness at Alder Vale', 'Thomas Vale', 'Alder Vale', 'low', 'Earliest register entry. Link to our line unproven.'),
        ('~1899', 'approximate', 'Birth of Ellis Vale, later a harness-maker', 'Ellis Vale', 'Alder Vale', 'medium', 'Year from family notes, not a certificate.'),
        ('1902', 'year', 'Birth of Marta Vale', 'Marta Vale', 'Alder Vale', 'low', 'One note gives 1902 and another 1904. Both kept.'),
        ('~1930', 'approximate', 'Birth of Jonah Vale', 'Jonah Vale', 'Alder Vale', 'medium', ''),
        ('~1946', 'approximate', 'Ellis, Marta and Jonah move from Alder Vale to Harbourfield', 'Ellis Vale; Marta Vale; Jonah Vale', 'Harbourfield', 'low', 'Remembered by Clara Vale.'),
        ('1962', 'day', 'Birth of Martin Vale on 2 February', 'Martin Vale', 'Willowford', 'high', ''),
        ('1965', 'year', 'Birth of Clara Vale', 'Clara Vale', 'Harbourfield', 'medium', ''),
        ('~1971', 'approximate', 'Death of Ellis Vale', 'Ellis Vale', 'Harbourfield', 'medium', ''),
        ('~1984', 'approximate', 'Death of Marta Vale', 'Marta Vale', 'Harbourfield', 'medium', ''),
        ('1994', 'day', 'Birth of Rowan Vale on 4 May', 'Rowan Vale', 'Willowford', 'high', ''),
        ('1998', 'approximate', 'Death of Jonah Vale', 'Jonah Vale', 'Harbourfield', 'medium', ''),
        ('2019', 'day', 'Death of Martin Vale on 9 June', 'Martin Vale', 'Harbourfield', 'high', ''),
    ]
    out = ['year,precision,event,people,place,confidence,note']
    for r in rows:
        out.append(','.join(f'"{v}"' if ',' in v or ';' in v else v for v in r))
    return '\n'.join(out) + '\n'


def chat_zip(path, name, messages):
    body = [f'{speaker}: {text}' for speaker, text in messages]
    header = (
        'Reconstructed from saved family messages and recollections. '
        'Collector: Rowan Vale. No original timestamps are claimed.\n\n'
    )
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo('_chat.txt', date_time=(2026, 9, 10, 20, 0, 0))
        z.writestr(info, header + '\n'.join(body) + '\n')


def build_excerpt_pdf(path):
    """A small text-only PDF. Written by hand so the fixture needs no PDF library."""
    lines = ['Alder Vale to Harbourfield', 'Shortened English excerpt of the Vale family book', '']
    for key, text in CHAPTER_TEXT.items():
        lines.append(key.replace('ch-', '').replace('-', ' ').title())
        for para in text.split('\n\n'):
            for i in range(0, len(para), 92):
                lines.append(para[i:i + 92])
        lines.append('')
    esc = lambda s: s.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')
    pages = [lines[i:i + 60] for i in range(0, len(lines), 60)]
    objects = []
    kids = []
    for index, page_lines in enumerate(pages):
        stream = 'BT /F1 10 Tf 12 TL 56 780 Td\n' + '\n'.join(f'({esc(l)}) Tj T*' for l in page_lines) + '\nET'
        content_num = 4 + index * 2
        objects.append((content_num, f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream'))
        objects.append((content_num + 1, f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_num} 0 R >>'))
        kids.append(f'{content_num + 1} 0 R')
    objects.append((1, '<< /Type /Catalog /Pages 2 0 R >>'))
    objects.append((2, f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {len(pages)} >>'))
    objects.append((3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'))
    objects.sort()
    out = bytearray(b'%PDF-1.4\n')
    offsets = {}
    for num, body in objects:
        offsets[num] = len(out)
        out += f'{num} 0 obj\n{body}\nendobj\n'.encode('latin-1')
    xref = len(out)
    top = max(offsets) + 1
    out += f'xref\n0 {top}\n0000000000 65535 f \n'.encode()
    for num in range(1, top):
        out += f'{offsets.get(num, 0):010d} 00000 n \n'.encode()
    out += f'trailer\n<< /Size {top} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    with open(path, 'wb') as f:
        f.write(bytes(out))


def main():
    if os.path.isdir(PACKET):
        shutil.rmtree(PACKET)
    os.makedirs(UPLOAD)
    os.makedirs(MEDIA)

    for index, (name, era, *_rest) in enumerate(PHOTOS):
        draw_photo(os.path.join(UPLOAD, name), 1000 + index, era, name.replace('.jpg', ''))
    for name, era, *_ in PHOTOS:
        if era != 'old':
            continue
        enhance(os.path.join(UPLOAD, name), os.path.join(MEDIA, f'{os.path.splitext(name)[0]} (enhanced).jpg'))

    with open(os.path.join(UPLOAD, 'Family notes.txt'), 'w') as f:
        f.write(family_notes())
    with open(os.path.join(UPLOAD, 'Photo notes.txt'), 'w') as f:
        f.write(photo_notes())
    with open(os.path.join(UPLOAD, 'Archive findings.txt'), 'w') as f:
        f.write(archive_findings())
    with open(os.path.join(UPLOAD, 'Family chronology.csv'), 'w') as f:
        f.write(chronology_csv())
    build_excerpt_pdf(os.path.join(UPLOAD, 'Family book excerpt.pdf'))
    chat_zip(os.path.join(UPLOAD, 'Messages - Mum.zip'), 'mum', [
        ('Clara Vale', 'I found the picture of your grandfather at the bench. He made harness his whole life.'),
        ('Rowan Vale', 'Do you know the year they left Alder Vale?'),
        ('Clara Vale', 'Around 1946, from the story your dad told. I have never seen it written down.'),
    ])
    chat_zip(os.path.join(UPLOAD, 'Messages - Family.zip'), 'family', [
        ('Clara Vale', 'One of my notes gives 1902 for Marta and another gives 1904. I do not have the certificate, so I have kept both.'),
        ('Rowan Vale', 'Keeping both then.'),
    ])

    manifest_input = {
        'people': [name for name, *_ in PEOPLE],
        'photos': [name for name, *_ in PHOTOS],
        'chapters': CHAPTER_TEXT,
        'generatedAt': FIXED_TIME.isoformat().replace('+00:00', 'Z'),
    }
    with open(os.path.join(PACKET, 'FIXTURE_INPUT.json'), 'w') as f:
        json.dump(manifest_input, f, indent=1)

    files = sorted(os.listdir(UPLOAD))
    total = sum(os.path.getsize(os.path.join(UPLOAD, n)) for n in files)
    print(f'{len(files)} upload files, {total:,} bytes')
    print(f'{len(os.listdir(MEDIA))} enhanced derivatives')
    print('now run: node --import tsx tests/fixtures/round3/build_manifest.mjs')


if __name__ == '__main__':
    main()
