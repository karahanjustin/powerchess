"""Piece classifier for digital boards: one 64x64 crop per square (the square plus 10% around it)."""
import json, random, sys, time, numpy as np, torch, torch.nn as nn, torchvision
from PIL import Image
from common import *

torch.set_num_threads(int(__import__('os').environ.get('NT', '4')))
DATA = '/home/user/data/prep/'
S2 = 64
recs = json.load(open(DATA + 'synth.json'))
train = [r for r in recs if r['split'] == 'train']
val = [r for r in recs if r['split'] != 'train']
print(len(train), 'train', len(val), 'val')


def boxes2d(corners):
    """must match scan/vision.js cropBoxes2d()"""
    H = homography(BOARD, corners)
    out = []
    for sq in range(64):
        f, r = sq % 8, sq // 8
        q = proj(H, [(f, r), (f + 1, r), (f + 1, r + 1), (f, r + 1)])
        x0, y0 = q.min(0); x1, y1 = q.max(0)
        mx, my = (x1 - x0) * 0.1, (y1 - y0) * 0.1
        out.append((x0 - mx, y0 - my, x1 + mx, y1 + my))
    return out


def crops(r, aug):
    im = Image.open(DATA + 'img/' + r['img']).convert('RGB')
    corners = r['corners']
    if aug:
        im = color_aug(im)
        corners = jitter_corners(corners, 0.007)
    xs, ys = [], []
    for sq, (x0, y0, x1, y1) in enumerate(boxes2d(corners)):
        lab = r['labels'][sq]
        if aug and lab == 0 and random.random() < 0.6:
            continue
        if aug:
            w, h = x1 - x0, y1 - y0
            d = [random.uniform(-.05, .05) for _ in range(4)]
            x0, y0, x1, y1 = x0 + d[0] * w, y0 + d[1] * h, x1 + d[2] * w, y1 + d[3] * h
        c = im.transform((S2, S2), Image.EXTENT, (x0, y0, x1, y1), Image.BILINEAR)
        xs.append(to_tensor(c)); ys.append(lab)
    return xs, ys


class DS(torch.utils.data.Dataset):
    def __init__(self, recs, aug):
        self.recs, self.aug = recs, aug

    def __len__(self):
        return len(self.recs)

    def __getitem__(self, i):
        xs, ys = crops(self.recs[i], self.aug)
        return torch.tensor(np.stack(xs)), torch.tensor(ys)


def collate(b):
    return torch.cat([x for x, _ in b]), torch.cat([y for _, y in b])


def model():
    m = torchvision.models.mobilenet_v3_small(weights='DEFAULT')
    m.classifier[3] = nn.Linear(m.classifier[3].in_features, 13)
    return m


if __name__ == '__main__':
    EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    net = model()
    dl = torch.utils.data.DataLoader(DS(train, True), batch_size=8, shuffle=True, num_workers=3, collate_fn=collate, persistent_workers=True)
    vdl = torch.utils.data.DataLoader(DS(val, False), batch_size=8, num_workers=2, collate_fn=collate)
    opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=EPOCHS * len(dl), pct_start=0.1)
    lossf = nn.CrossEntropyLoss(label_smoothing=0.05)
    best = 0
    for ep in range(EPOCHS):
        net.train(); t = time.time(); tl = n = 0
        for i, (x, y) in enumerate(dl):
            loss = lossf(net(x), y)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tl += loss.item(); n += 1
            if i % 100 == 0:
                print(f'ep {ep} it {i}/{len(dl)} loss {tl / n:.4f} {time.time() - t:.0f}s', flush=True)
        net.eval(); correct = tot = bok = boards = 0
        with torch.no_grad():
            for x, y in vdl:
                p = net(x).argmax(1)
                correct += (p == y).sum().item(); tot += len(y)
                pb = (p == y).view(-1, 64).all(1); boards += len(pb); bok += pb.sum().item()
        acc = correct / tot
        print(f'== ep {ep} val sq acc {acc:.4f} boards {bok}/{boards} ({time.time() - t:.0f}s)', flush=True)
        if acc >= best:
            best = acc
            torch.save(net.state_dict(), '/home/user/data/cls2d.pt')
