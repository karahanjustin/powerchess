"""Per-square piece classifier: 13 classes (0 empty, 1..6 PNBRQK, 7..12 pnbrqk) on 64x128 crops."""
import json, random, sys, time, math, numpy as np, torch, torch.nn as nn, torchvision
from PIL import Image
from common import *

torch.set_num_threads(4)
DATA = '/home/user/data/prep/'
recs = []
for f in ('chessred.json', 'chesscog.json'):
    try:
        recs += json.load(open(DATA + f))
    except FileNotFoundError:
        pass
train = [r for r in recs if r['split'] == 'train']
val = [r for r in recs if r['split'] != 'train']
print(len(train), 'train', len(val), 'val')


def rotate(im, corners, deg):
    w, h = im.size
    im2 = im.rotate(deg, resample=Image.BILINEAR, expand=True)
    W, H = im2.size
    t = math.radians(deg)
    c = np.array(corners) - [w / 2, h / 2]
    R = np.array([[math.cos(t), math.sin(t)], [-math.sin(t), math.cos(t)]])
    return im2, (c @ R.T + [W / 2, H / 2]).tolist()


def crops(r, aug):
    im = Image.open(DATA + 'img/' + r['img']).convert('RGB')
    corners = r['corners']
    if aug:
        if random.random() < 0.5:
            im, corners = rotate(im, corners, random.uniform(-12, 12))
        im = color_aug(im)
        corners = jitter_corners(corners, 0.006)
        # sometimes work at a lower resolution, like a smaller photo
        if random.random() < 0.3:
            s = random.uniform(0.45, 0.8)
            W, H = im.size
            im = im.resize((int(W * s), int(H * s)), Image.BILINEAR)
            corners = (np.array(corners) * s).tolist()
    xs, ys = [], []
    for sq, (x0, y0, x1, y1) in enumerate(crop_boxes(corners)):
        lab = r['labels'][sq]
        if aug and lab == 0 and random.random() < 0.55:
            continue
        if aug:
            s = random.uniform(0.92, 1.1)
            cx, w = (x0 + x1) / 2, (x1 - x0) * s
            x0, x1 = cx - w / 2 + random.uniform(-.04, .04) * w, cx + w / 2 + random.uniform(-.04, .04) * w
            y0 = y1 - (y1 - y0) * random.uniform(0.92, 1.1)
        c = im.transform((CW, CH), Image.EXTENT, (x0, y0, x1, y1), Image.BILINEAR)
        if aug and random.random() < 0.5:
            c = c.transpose(Image.FLIP_LEFT_RIGHT)
        xs.append(to_tensor(c))
        ys.append(lab)
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
    EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    net = model()
    dl = torch.utils.data.DataLoader(DS(train, True), batch_size=6, shuffle=True, num_workers=3, collate_fn=collate, persistent_workers=True)
    vdl = torch.utils.data.DataLoader(DS(val, False), batch_size=4, num_workers=3, collate_fn=collate)
    opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
    steps = EPOCHS * len(dl)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1.5e-3, total_steps=steps, pct_start=0.1)
    lossf = nn.CrossEntropyLoss(label_smoothing=0.05)
    best = 0
    for ep in range(EPOCHS):
        net.train()
        t = time.time(); tl = 0; n = 0
        for i, (x, y) in enumerate(dl):
            out = net(x)
            loss = lossf(out, y)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tl += loss.item(); n += 1
            if i % 50 == 0:
                print(f'ep {ep} it {i}/{len(dl)} loss {tl / n:.4f} {time.time() - t:.0f}s', flush=True)
        net.eval()
        correct = tot = 0; boards = bok = 0
        conf = np.zeros((13, 13), int)
        with torch.no_grad():
            for x, y in vdl:
                p = net(x).argmax(1)
                correct += (p == y).sum().item(); tot += len(y)
                for a, b in zip(y.tolist(), p.tolist()):
                    conf[a, b] += 1
                pb = (p == y).view(-1, 64).all(1)
                boards += len(pb); bok += pb.sum().item()
        acc = correct / tot
        print(f'== ep {ep} val sq acc {acc:.4f} boards {bok}/{boards} ({time.time() - t:.0f}s)', flush=True)
        if acc >= best:
            best = acc
            torch.save(net.state_dict(), '/home/user/data/cls.pt')
            np.save('/home/user/data/cls_conf.npy', conf)
