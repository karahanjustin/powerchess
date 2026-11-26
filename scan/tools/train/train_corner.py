"""Board corner detector: 320x320 input -> 80x80 maps: [corner heatmap, board mask]."""
import json, random, sys, time, math, numpy as np, torch, torch.nn as nn, torch.nn.functional as F, torchvision
from PIL import Image, ImageDraw
from common import *

torch.set_num_threads(int(__import__("os").environ.get("NT","4")))
DATA = '/home/user/data/prep/'
S, OS = 320, 80
recs = []
for f in ('chessred.json', 'chesscog.json', 'synth.json'):
    try:
        recs += json.load(open(DATA + f))
    except FileNotFoundError:
        pass
train = [r for r in recs if r['split'] == 'train']
val = [r for r in recs if r['split'] != 'train']
print(len(train), 'train', len(val), 'val')


def letterbox_matrix(w, h):
    s = S / max(w, h)
    return np.array([[s, 0, (S - w * s) / 2], [0, s, (S - h * s) / 2], [0, 0, 1]])


def sample(r, aug):
    im = Image.open(DATA + 'img/' + r['img']).convert('RGB')
    w, h = im.size
    M = letterbox_matrix(w, h)
    if aug:
        c = np.array(r['corners'])
        # random similarity transform around the board, board keeps inside the frame mostly
        ang = math.radians(random.uniform(-30, 30))
        sc = random.uniform(0.75, 1.35)
        A = np.array([[math.cos(ang) * sc, -math.sin(ang) * sc, 0], [math.sin(ang) * sc, math.cos(ang) * sc, 0], [0, 0, 1]])
        if random.random() < 0.5:
            A = A @ np.diag([-1, 1, 1])
        M = M.copy()
        # center on the board center, then shift randomly
        bc = (M @ np.r_[c.mean(0), 1])[:2]
        T1 = np.array([[1, 0, -bc[0]], [0, 1, -bc[1]], [0, 0, 1]])
        sh = np.random.uniform(-0.15, 0.15, 2) * S
        T2 = np.array([[1, 0, S / 2 + sh[0]], [0, 1, S / 2 + sh[1]], [0, 0, 1]])
        M = T2 @ A @ T1 @ M
        im = color_aug(im)
    Mi = np.linalg.inv(M)
    out = im.transform((S, S), Image.AFFINE, tuple(Mi[:2].ravel()), Image.BILINEAR, fillcolor=tuple(int(v) for v in np.random.randint(0, 255, 3)) if aug else (0, 0, 0))
    cor = (np.c_[np.array(r['corners']), np.ones(4)] @ M.T)[:, :2]
    # targets
    hm = np.zeros((OS, OS), np.float32)
    yy, xx = np.mgrid[0:OS, 0:OS]
    sig = 1.3
    for x, y in cor / (S / OS):
        hm = np.maximum(hm, np.exp(-((xx + .5 - x) ** 2 + (yy + .5 - y) ** 2) / (2 * sig * sig)))
    mk = Image.new('L', (OS, OS), 0)
    ImageDraw.Draw(mk).polygon([tuple(p) for p in cor / (S / OS)], fill=255)
    mask = np.asarray(mk, np.float32) / 255.
    return to_tensor(out), np.stack([hm, mask]), cor.astype(np.float32)


class DS(torch.utils.data.Dataset):
    def __init__(self, recs, aug):
        self.recs, self.aug = recs, aug

    def __len__(self):
        return len(self.recs)

    def __getitem__(self, i):
        x, t, c = sample(self.recs[i], self.aug)
        return torch.tensor(x), torch.tensor(t), torch.tensor(c)


class Net(nn.Module):
    def __init__(self, pretrained=True):
        super().__init__()
        f = torchvision.models.mobilenet_v3_large(weights='DEFAULT' if pretrained else None).features
        self.s4, self.s8, self.s16, self.s32 = f[:4], f[4:7], f[7:13], f[13:]
        C = 96
        self.l32 = nn.Conv2d(960, C, 1); self.l16 = nn.Conv2d(112, C, 1); self.l8 = nn.Conv2d(40, C, 1); self.l4 = nn.Conv2d(24, C, 1)
        def blk():
            return nn.Sequential(nn.Conv2d(C, C, 3, padding=1, bias=False), nn.BatchNorm2d(C), nn.ReLU(inplace=True))
        self.b16, self.b8, self.b4 = blk(), blk(), blk()
        self.head = nn.Sequential(nn.Conv2d(C, 64, 3, padding=1), nn.ReLU(inplace=True), nn.Conv2d(64, 2, 1))
        self.head[-1].bias.data[:] = -2.0

    def forward(self, x):
        x4 = self.s4(x); x8 = self.s8(x4); x16 = self.s16(x8); x32 = self.s32(x16)
        p = self.l32(x32)
        p = self.b16(F.interpolate(p, scale_factor=2.0, mode='nearest') + self.l16(x16))
        p = self.b8(F.interpolate(p, scale_factor=2.0, mode='nearest') + self.l8(x8))
        p = self.b4(F.interpolate(p, scale_factor=2.0, mode='nearest') + self.l4(x4))
        return self.head(p)


def focal(logit, gt):
    p = torch.sigmoid(logit).clamp(1e-4, 1 - 1e-4)
    pos = gt.gt(0.97).float()
    neg = 1 - pos
    pl = -torch.log(p) * (1 - p) ** 2 * pos
    nl = -torch.log(1 - p) * p ** 2 * (1 - gt) ** 4 * neg
    return (pl.sum() + nl.sum()) / pos.sum().clamp(min=1)


def peaks(hm, k=4):
    """hm: (OS,OS) numpy sigmoid. top-k local maxima with sub-cell refinement -> input px coords."""
    from scipy.ndimage import maximum_filter
    mx = maximum_filter(hm, size=5)
    ys, xs = np.where((hm == mx) & (hm > 0.05))
    order = np.argsort(-hm[ys, xs])[:k]
    out = []
    for y, x in zip(ys[order], xs[order]):
        y0, y1, x0, x1 = max(0, y - 1), min(OS, y + 2), max(0, x - 1), min(OS, x + 2)
        w = hm[y0:y1, x0:x1]
        gy, gx = np.mgrid[y0:y1, x0:x1]
        out.append(((gx * w).sum() / w.sum() + .5, (gy * w).sum() / w.sum() + .5, hm[y, x]))
    return [(x * S / OS, y * S / OS, s) for x, y, s in out]


if __name__ == '__main__':
    EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    net = Net()
    real = sum(r['src'] != 'synth' for r in train); syn = len(train) - real
    wts = [0.5 / syn if r['src'] == 'synth' else 0.5 / real for r in train]
    sampler = torch.utils.data.WeightedRandomSampler(wts, num_samples=2 * real, replacement=True)
    dl = torch.utils.data.DataLoader(DS(train, True), batch_size=12, sampler=sampler, num_workers=3, drop_last=True, persistent_workers=True)
    vdl = torch.utils.data.DataLoader(DS(val, False), batch_size=16, num_workers=3)
    opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1.5e-3, total_steps=EPOCHS * len(dl), pct_start=0.08)
    best = 1e9
    for ep in range(EPOCHS):
        net.train(); t = time.time(); tl = n = 0
        for i, (x, tg, _) in enumerate(dl):
            out = net(x)
            loss = focal(out[:, 0], tg[:, 0]) + F.binary_cross_entropy_with_logits(out[:, 1], tg[:, 1]) * 2
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tl += loss.item(); n += 1
            if i % 40 == 0:
                print(f'ep {ep} it {i}/{len(dl)} loss {tl / n:.4f} {time.time() - t:.0f}s', flush=True)
        net.eval(); errs = []; fails = 0
        with torch.no_grad():
            for x, tg, cor in vdl:
                hm = torch.sigmoid(net(x)[:, 0]).numpy()
                for h, c in zip(hm, cor.numpy()):
                    pk = peaks(h)
                    if len(pk) < 4:
                        fails += 1; continue
                    pk = np.array([(a, b) for a, b, _ in pk])
                    d = np.sqrt(((c[:, None] - pk[None]) ** 2).sum(-1)).min(1)
                    errs.append(d.max())
        errs = np.array(errs)
        nsyn = sum(r['src'] == 'synth' for r in val)
        es = errs[-nsyn:] if nsyn else errs
        print(f'   synth val: median {np.median(es):.2f}px >8px {(es > 8).mean():.3f}', flush=True)
        score = np.median(errs) + 10 * fails / len(val) + 5 * (errs > 8).mean()
        print(f'== ep {ep} val maxcorner err median {np.median(errs):.2f}px p90 {np.percentile(errs, 90):.2f} >8px {(errs > 8).mean():.3f} fails {fails} ({time.time() - t:.0f}s)', flush=True)
        if score < best:
            best = score
            torch.save(net.state_dict(), '/home/user/data/corner.pt')
