import numpy as np, math, random
from PIL import Image, ImageFilter, ImageEnhance

BOARD = [(0, 0), (8, 0), (8, 8), (0, 8)]


def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def proj(H, pts):
    pts = np.asarray(pts, float)
    p = np.c_[pts, np.ones(len(pts))] @ H.T
    return p[:, :2] / p[:, 2:3]


# --- square crops: must match scan/vision.js cropBoxes() exactly ---
CW, CH = 64, 128


def crop_boxes(corners):
    """corners a1,h1,h8,a8 in image px -> 64 boxes (x0,y0,x1,y1), index rank*8+file."""
    H = homography(BOARD, corners)
    boxes = []
    for sq in range(64):
        f, r = sq % 8, sq // 8
        q = proj(H, [(f, r), (f + 1, r), (f + 1, r + 1), (f, r + 1), (f + 0.5, r + 0.5)])
        cx = q[4, 0]
        w = q[:4, 0].max() - q[:4, 0].min()
        top, bot = q[:4, 1].min(), q[:4, 1].max()
        hq = bot - top
        x0, x1 = cx - 0.62 * w, cx + 0.62 * w
        y1 = bot + 0.08 * hq
        y0 = top - 1.45 * w
        boxes.append((x0, y0, x1, y1))
    return boxes


def jitter_corners(corners, amt):
    c = np.array(corners, float)
    size = np.linalg.norm(c[2] - c[0])
    return (c + np.random.randn(4, 2) * amt * size).tolist()


def color_aug(im):
    if random.random() < 0.8:
        im = ImageEnhance.Brightness(im).enhance(random.uniform(0.6, 1.4))
        im = ImageEnhance.Contrast(im).enhance(random.uniform(0.6, 1.4))
        im = ImageEnhance.Color(im).enhance(random.uniform(0.3, 1.6))
    if random.random() < 0.3:
        a = np.asarray(im).astype(np.float32)
        a = a * np.random.uniform(0.8, 1.2, 3)[None, None, :]
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if random.random() < 0.1:
        im = im.convert('L').convert('RGB')
    if random.random() < 0.3:
        im = im.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 1.5)))
    return im


MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def to_tensor(im):
    a = (np.asarray(im, np.float32) / 255. - MEAN) / STD
    return a.transpose(2, 0, 1)
