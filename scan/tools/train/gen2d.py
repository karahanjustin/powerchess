"""Synthetic digital chess boards (screenshots and photos of screens).
board_image() -> RGB board (side px), labels[64] (index rank*8+file, white at the bottom unless flipped), flipped
scene() -> full image with the board somewhere in it + its 4 corners (a1,h1,h8,a8 order) and labels."""
import os, json, random, math, glob, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

R = '/home/user/data/sets_png'
SKIP = {'shapes', 'letter', 'anarcandy'}
ALL_SETS = sorted(s for s in os.listdir(R) if s not in SKIP)
VAL_SETS = ['tatiana', 'gioco']
PIECES = 'PNBRQKpnbrqk'
_cache = {}


def piece(setname, p, size):
    key = (setname, p, size)
    if key not in _cache:
        fn = ('w' if p.isupper() else 'b') + p.upper()
        im = Image.open(f'{R}/{setname}/{fn}.png').convert('RGBA').resize((size, size), Image.LANCZOS)
        if len(_cache) > 4000:
            _cache.clear()
        _cache[key] = im
    return _cache[key]


FENS = [p['pre'].split()[0] for p in json.load(open('/home/user/powerchess/puzzles/puzzles.json'))]
FONTS = [f for f in glob.glob('/usr/share/fonts/truetype/dejavu/*.ttf') + glob.glob('/usr/share/fonts/truetype/liberation/*.ttf')]

THEMES = [  # light, dark
    ((240, 217, 181), (181, 136, 99)), ((238, 238, 210), (118, 150, 86)), ((235, 236, 208), (115, 149, 82)),
    ((222, 227, 230), (140, 162, 173)), ((234, 233, 210), (75, 115, 153)), ((200, 200, 200), (130, 130, 130)),
    ((240, 240, 240), (160, 160, 160)), ((230, 210, 250), (150, 110, 180)), ((255, 206, 158), (209, 139, 71)),
    ((237, 214, 176), (184, 135, 98)), ((250, 250, 250), (90, 90, 90)), ((214, 211, 196), (120, 113, 100)),
    ((227, 193, 111), (184, 139, 74)), ((236, 236, 236), (193, 140, 135)), ((210, 230, 240), (80, 130, 170)),
]


def fen_board(fen):
    b = [0] * 64
    for i, row in enumerate(fen.split('/')):
        f = 0
        for ch in row:
            if ch.isdigit():
                f += int(ch)
            else:
                b[(7 - i) * 8 + f] = 1 + PIECES.index(ch); f += 1
    return b


def random_labels():
    r = random.random()
    if r < 0.6:
        b = fen_board(random.choice(FENS))
    elif r < 0.75:
        b = fen_board('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
        for sq in random.sample(range(64), random.randint(0, 20)):
            b[sq] = 0
    else:  # random scatter, every piece type everywhere
        b = [0] * 64
        n = random.randint(2, 40)
        for sq in random.sample(range(64), n):
            b[sq] = random.randint(1, 12)
    return b


def smooth_noise(n, scale):
    a = np.random.rand(max(2, n // scale), max(2, n // scale))
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC), np.float32) / 255.


def jitter_col(c, amt=18):
    return tuple(int(np.clip(v + random.uniform(-amt, amt), 0, 255)) for v in c)


def board_image(side, setname, labels=None, flipped=None):
    labels = labels or random_labels()
    flipped = random.random() < 0.3 if flipped is None else flipped
    light, dark = random.choice(THEMES)
    if random.random() < 0.3:  # a random theme
        h = random.random()
        import colorsys
        def hsv(h, s, v): return tuple(int(255 * x) for x in colorsys.hsv_to_rgb(h, s, v))
        light, dark = hsv(h, random.uniform(0, .3), random.uniform(.8, 1)), hsv(h + random.uniform(-.05, .05), random.uniform(.2, .7), random.uniform(.35, .7))
    light, dark = jitter_col(light), jitter_col(dark)
    sq = side / 8
    img = Image.new('RGB', (side, side))
    arr = np.zeros((side, side, 3), np.float32)
    yy, xx = np.mgrid[0:side, 0:side]
    par = ((xx // sq).astype(int) + (yy // sq).astype(int)) % 2  # 0 = light at screen top-left
    arr[par == 0] = light; arr[par == 1] = dark
    if random.random() < 0.25:  # wood-ish texture
        n = smooth_noise(side, random.randint(4, 30))[..., None]
        arr = arr * (0.85 + 0.3 * n)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img, 'RGBA')

    def cell(s):  # board square -> screen cell (col,row from top-left)
        f, r = s % 8, s // 8
        return (7 - f, r) if flipped else (f, 7 - r)

    def rect(s):
        c, r = cell(s)
        return [round(c * sq), round(r * sq), round((c + 1) * sq) - 1, round((r + 1) * sq) - 1]
    # highlights: last move, selection, check
    if random.random() < 0.6:
        col = random.choice([(255, 255, 0, 100), (205, 210, 106, 200), (246, 246, 105, 170), (155, 199, 0, 105), (100, 180, 255, 110), (255, 170, 0, 120)])
        for s in random.sample(range(64), 2):
            d.rectangle(rect(s), fill=col)
    if random.random() < 0.15:
        s = random.randrange(64)
        x0, y0, x1, y1 = rect(s)
        d.ellipse([x0, y0, x1, y1], fill=(255, 0, 0, 120))
    if random.random() < 0.2:
        for s in random.sample(range(64), random.randint(2, 4)):
            r = rect(s)
            d.rectangle(r, fill=random.choice([(235, 97, 80, 200), (172, 206, 89, 200), (82, 176, 220, 200), (255, 170, 0, 200)]))
    # coordinates
    if random.random() < 0.6:
        font = ImageFont.truetype(random.choice(FONTS), max(8, int(sq * random.uniform(.16, .26))))
        inside = random.random() < 0.8
        for i in range(8):
            fl = 'abcdefgh'[7 - i if flipped else i]; rk = str(i + 1 if flipped else 8 - i)
            c1 = dark if i % 2 == 0 else light
            d.text((i * sq + sq - sq * .2, side - sq * .28), fl, fill=c1 if inside else (0, 0, 0), font=font)
            c2 = light if i % 2 == 0 else dark
            d.text((sq * .05, i * sq + sq * .03), rk, fill=c2, font=font)
    # pieces
    ps = int(sq * random.uniform(0.82, 1.0))
    for s in range(64):
        if labels[s]:
            p = piece(setname, PIECES[labels[s] - 1], ps)
            x0, y0, _, _ = rect(s)
            ox = int((sq - ps) / 2 + random.uniform(-.02, .02) * sq); oy = int((sq - ps) / 2 + random.uniform(-.02, .02) * sq)
            img.paste(p, (x0 + ox, y0 + oy), p)
    # legal-move dots and arrows over the pieces
    if random.random() < 0.2:
        for s in random.sample(range(64), random.randint(2, 8)):
            x0, y0, x1, y1 = rect(s); cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, sq * .15
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 40))
    if random.random() < 0.3:
        for _ in range(random.randint(1, 3)):
            a, b = random.sample(range(64), 2)
            (ca, ra), (cb, rb) = cell(a), cell(b)
            col = random.choice([(21, 120, 27, 170), (136, 32, 32, 170), (230, 143, 0, 170), (0, 48, 136, 170), (130, 180, 60, 200)])
            p0 = ((ca + .5) * sq, (ra + .5) * sq); p1 = ((cb + .5) * sq, (rb + .5) * sq)
            d.line([p0, p1], fill=col, width=max(2, int(sq * .18)))
            ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0]); L = sq * .4
            d.polygon([p1, (p1[0] - L * math.cos(ang - .5), p1[1] - L * math.sin(ang - .5)), (p1[0] - L * math.cos(ang + .5), p1[1] - L * math.sin(ang + .5))], fill=col)
    return img, labels, flipped


def degrade(img, screen_photo):
    """screenshot: mild scaling / jpeg. photo of a screen: blur, moire, gradient, colour cast, noise."""
    W, H = img.size
    if screen_photo:
        a = np.asarray(img, np.float32)
        yy, xx = np.mgrid[0:H, 0:W]
        if random.random() < 0.7:  # moire
            f = random.uniform(0.15, 0.9); t = random.uniform(0, math.pi)
            m = np.sin((xx * math.cos(t) + yy * math.sin(t)) * f + random.uniform(0, 6)) * random.uniform(3, 14)
            a = a + m[..., None]
        g = (xx / W * random.uniform(-1, 1) + yy / H * random.uniform(-1, 1)) * random.uniform(10, 50)  # light gradient
        a = a + g[..., None]
        a = a * np.random.uniform(0.85, 1.15, 3)[None, None] * random.uniform(0.7, 1.2)
        if random.random() < 0.4:  # glare
            cx, cy, r = random.uniform(0, W), random.uniform(0, H), random.uniform(.1, .5) * W
            a = a + (np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)) * random.uniform(20, 90))[..., None]
        a = a + np.random.randn(H, W, 1) * random.uniform(1, 6)
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(random.uniform(0.4, 1.8)))
    if random.random() < 0.5:
        s = random.uniform(0.5, 1.0)
        img = img.resize((max(8, int(W * s)), max(8, int(H * s))), Image.BILINEAR).resize((W, H), Image.BILINEAR)
    if random.random() < 0.5:
        import io
        b = io.BytesIO(); img.save(b, 'JPEG', quality=random.randint(35, 90)); img = Image.open(io.BytesIO(b.getvalue())).convert('RGB')
    return img


def board_corners(x0, y0, side, flipped):
    """screen-space corners of an axis-aligned board -> a1,h1,h8,a8."""
    bl, br, tr, tl = (x0, y0 + side), (x0 + side, y0 + side), (x0 + side, y0), (x0, y0)
    return [tr, tl, bl, br] if flipped else [bl, br, tr, tl]


def ui_background(W, H):
    base = jitter_col(random.choice([(48, 46, 43), (22, 21, 18), (38, 36, 33), (255, 255, 255), (240, 240, 240), (30, 30, 40), (60, 60, 60)]), 15)
    bg = Image.new('RGB', (W, H), base)
    d = ImageDraw.Draw(bg)
    for _ in range(random.randint(3, 15)):  # panels, buttons, text lines
        x, y = random.uniform(0, W), random.uniform(0, H)
        w, h = random.uniform(.05, .6) * W, random.uniform(.01, .15) * H
        col = jitter_col(base, 40)
        if random.random() < .6:
            d.rounded_rectangle([x, y, x + w, y + h], radius=random.uniform(0, 12), fill=col)
        else:
            font = ImageFont.truetype(random.choice(FONTS), random.randint(10, 34))
            d.text((x, y), ''.join(random.choice('abcdefghijklmnop 0123456789+-.') for _ in range(random.randint(3, 25))), fill=jitter_col((200, 200, 200) if sum(base) < 380 else (40, 40, 40), 50), font=font)
    return bg


def scene(sets=None, size=1024):
    """a phone screenshot or a photo of a screen; image (long side <= size) + corners a1,h1,h8,a8 + labels."""
    setname = random.choice(sets or ALL_SETS)
    photo = random.random() < 0.5
    portrait = random.random() < 0.7
    W, H = (int(size * random.uniform(.42, .6)), size) if portrait else (size, int(size * random.uniform(.5, .8)))
    side = int(min(W, H) * random.uniform(0.55, 1.0))
    bimg, labels, flipped = board_image(side, setname)
    bg = ui_background(W, H)
    x0 = random.randint(0, W - side); y0 = random.randint(0, H - side)
    if random.random() < 0.3:  # a frame around the board
        m = random.randint(2, max(3, side // 25))
        ImageDraw.Draw(bg).rectangle([x0 - m, y0 - m, x0 + side + m, y0 + side + m], fill=jitter_col((60, 50, 40), 40))
    bg.paste(bimg, (x0, y0))
    corners = np.array(board_corners(x0, y0, side, flipped), float)
    img = bg
    if photo:
        # the screen seen by a camera: perspective, a dark surround, rotated a little
        Wc, Hc = int(W * random.uniform(1.0, 1.5)), int(H * random.uniform(1.0, 1.4))
        sc = random.uniform(0.6, 0.95) * min(Wc / W, Hc / H)
        cx, cy = Wc / 2 + random.uniform(-.1, .1) * Wc, Hc / 2 + random.uniform(-.1, .1) * Hc
        src = np.array([(0, 0), (W, 0), (W, H), (0, H)], float)
        dst = np.array([(cx + (x - W / 2) * sc, cy + (y - H / 2) * sc) for x, y in src])
        dst += np.random.uniform(-0.07, 0.07, (4, 2)) * [W * sc, H * sc]
        ang = math.radians(random.uniform(-12, 12))
        Rm = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])
        dst = (dst - [cx, cy]) @ Rm.T + [cx, cy]
        from common import homography, proj
        Hm = homography(src, dst)
        Hi = np.linalg.inv(Hm); Hi = Hi / Hi[2, 2]
        surround = Image.new('RGB', (Wc, Hc), jitter_col((random.randint(0, 120),) * 3, 20))
        warped = img.transform((Wc, Hc), Image.PERSPECTIVE, tuple(Hi.ravel()[:8]), Image.BILINEAR)
        mask = Image.new('L', (W, H), 255).transform((Wc, Hc), Image.PERSPECTIVE, tuple(Hi.ravel()[:8]), Image.BILINEAR)
        surround.paste(warped, (0, 0), mask)
        img = surround
        corners = proj(Hm, corners)
        if random.random() < 0.6:  # the camera framed the board closely
            bx0, by0 = corners.min(0); bx1, by1 = corners.max(0); bs = max(bx1 - bx0, by1 - by0)
            m = [random.uniform(.03, .4) * bs for _ in range(4)]
            box = (max(0, int(bx0 - m[0])), max(0, int(by0 - m[1])), min(Wc, int(bx1 + m[2])), min(Hc, int(by1 + m[3])))
            img = img.crop(box); corners = corners - [box[0], box[1]]
    img = degrade(img, photo)
    s = size / max(img.size)
    if s < 1:
        img = img.resize((int(img.size[0] * s), int(img.size[1] * s)), Image.BILINEAR); corners = corners * s
    return img, corners.tolist(), labels


def make(split, n, seed, out='/home/user/data/prep'):
    import sys
    random.seed(seed); np.random.seed(seed)
    sets = VAL_SETS if split == 'val' else [s for s in ALL_SETS if s not in VAL_SETS]
    recs = []
    for i in range(n):
        img, cor, lab = scene(sets)
        name = 'sy_%s_%05d_%d.jpg' % (split, i, seed)
        img.save(f'{out}/img/{name}', quality=90)
        recs.append(dict(img=name, corners=cor, labels=lab, split=split, src='synth', size=img.size))
    return recs


if __name__ == '__main__':
    import sys
    from concurrent.futures import ProcessPoolExecutor
    jobs = [('val', 50, 1000 + k) for k in range(4)] + [('train', 250, k) for k in range(24)]
    with ProcessPoolExecutor(3) as ex:
        res = sum(ex.map(make, *zip(*jobs)), [])
    json.dump(res, open('/home/user/data/prep/synth.json', 'w'))
    print(len(res))
