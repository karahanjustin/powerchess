"""Unify ChessReD2K + chesscog into one list: resized images (long side 1024), corners ordered a1,h1,h8,a8,
and 64 labels per image (index rank*8+file; 0 empty, 1..6 = PNBRQK white, 7..12 = pnbrqk black)."""
import json, os, sys, glob, numpy as np
from PIL import Image
from concurrent.futures import ProcessPoolExecutor

OUT = '/home/user/data/prep'
os.makedirs(OUT + '/img', exist_ok=True)
PIECES = 'PNBRQKpnbrqk'
CR_CAT = {0: 'P', 1: 'R', 2: 'N', 3: 'B', 4: 'Q', 5: 'K', 6: 'p', 7: 'r', 8: 'n', 9: 'b', 10: 'q', 11: 'k'}


def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def proj(H, pts):
    p = np.c_[pts, np.ones(len(pts))] @ H.T
    return p[:, :2] / p[:, 2:3]


BOARD = [(0, 0), (8, 0), (8, 8), (0, 8)]


def order_corners(corners, pieces):
    """corners: 4 image points, pieces: list of (sq_index, box[x,y,w,h]). Returns corners ordered a1,h1,h8,a8."""
    c = np.array(corners, float)
    ctr = c.mean(0)
    ang = np.arctan2(c[:, 1] - ctr[1], c[:, 0] - ctr[0])
    c = c[np.argsort(ang)]
    best, bestc = 1e18, None
    for rev in (False, True):
        cc = c[::-1] if rev else c
        for r in range(4):
            cand = np.roll(cc, r, axis=0)
            H = homography(BOARD, cand)
            err = 0
            for sq, (x, y, w, h) in pieces:
                f, rk = sq % 8, sq // 8
                p = proj(H, np.array([[f + 0.5, rk + 0.5]]))[0]
                base = np.array([x + w / 2, y + h - 0.2 * w])
                err += np.sum((p - base) ** 2)
            if err < best:
                best, bestc = err, cand
    return bestc, best / max(1, len(pieces))


def sqidx(name):
    return (int(name[1]) - 1) * 8 + (ord(name[0]) - 97)


def save(src_path, out_name, corners, labels, pieces, split, source):
    im = Image.open(src_path).convert('RGB')
    s = 1024 / max(im.size)
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.BILINEAR)
    im.save(f'{OUT}/img/{out_name}.jpg', quality=92)
    pcs = [(sq, [v * s for v in b]) for sq, b in pieces]
    cor, err = order_corners([[x * s, y * s] for x, y in corners], pcs) if len(pcs) >= 3 else (np.array(corners) * s, -1)
    return dict(img=f'{out_name}.jpg', corners=cor.tolist(), labels=labels, split=split, src=source, fit=float(err), size=im.size)


def chessred_jobs():
    a = json.load(open('/home/user/data/annotations.json'))
    imgs = {i['id']: i for i in a['images']}
    corners = {c['image_id']: c['corners'] for c in a['annotations']['corners']}
    pcs = {}
    for p in a['annotations']['pieces']:
        pcs.setdefault(p['image_id'], []).append(p)
    files = {os.path.basename(f): f for f in glob.glob('/home/user/data/cr2k/**/*.jpg', recursive=True)}
    jobs = []
    for split in ('train', 'val', 'test'):
        for iid in a['splits']['chessred2k'][split]['image_ids']:
            im = imgs[iid]
            if im['file_name'] not in files or iid not in corners:
                continue
            labels = [0] * 64
            pieces = []
            for p in pcs.get(iid, []):
                if p['category_id'] == 12:
                    continue
                sq = sqidx(p['chessboard_position'])
                labels[sq] = 1 + PIECES.index(CR_CAT[p['category_id']])
                if 'bbox' in p:
                    pieces.append((sq, p['bbox']))
            co = corners[iid]
            jobs.append((files[im['file_name']], 'cr_%05d' % iid, [co['bottom_left'], co['bottom_right'], co['top_right'], co['top_left']], labels, pieces, split, 'chessred'))
    return jobs


def chesscog_jobs():
    jobs = []
    for f in sorted(glob.glob('/home/user/data/cc/*/*/*.json')):
        d = json.load(open(f))
        part = f.split('/')[-2]
        n = int(os.path.basename(f)[:-5])
        split = 'train' if part == 'val' else ('val' if n % 5 == 0 else 'train')
        labels = [0] * 64
        pieces = []
        for p in d['pieces']:
            sq = sqidx(p['square'])
            labels[sq] = 1 + PIECES.index(p['piece'])
            pieces.append((sq, p['box']))
        jobs.append((f[:-5] + '.png', 'cc_%s_%04d' % (part, n), d['corners'], labels, pieces, split, 'chesscog'))
    return jobs


def run(job):
    try:
        return save(*job)
    except Exception as e:
        print('fail', job[0], e, file=sys.stderr)
        return None


if __name__ == '__main__':
    which = sys.argv[1]
    jobs = chessred_jobs() if which == 'chessred' else chesscog_jobs()
    print(len(jobs), 'jobs')
    with ProcessPoolExecutor(4) as ex:
        res = [r for r in ex.map(run, jobs, chunksize=8) if r]
    json.dump(res, open(f'{OUT}/{which}.json', 'w'))
    errs = sorted(r['fit'] for r in res)
    print(len(res), 'done; fit err median', errs[len(errs) // 2], 'max', errs[-1])
