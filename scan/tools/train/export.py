"""Export both models to ONNX with the ImageNet normalisation inside (input: float 0..255 RGB, NCHW)."""
import sys, torch, torch.nn as nn, numpy as np
sys.path.insert(0, '/home/user/data')
from common import MEAN, STD

class Norm(nn.Module):
    def __init__(self, net):
        super().__init__(); self.net = net
        self.register_buffer('m', torch.tensor(MEAN * 255).view(1, 3, 1, 1))
        self.register_buffer('s', torch.tensor(STD * 255).view(1, 3, 1, 1))
    def forward(self, x):
        return self.net((x - self.m) / self.s)

def export(which, out):
    if which == 'pieces':
        import train_cls
        net = train_cls.model(); net.load_state_dict(torch.load('/home/user/data/cls.pt'))
        x = torch.rand(64, 3, 128, 64) * 255; dyn = {'x': {0: 'n'}, 'y': {0: 'n'}}
    elif which == 'pieces2d':
        import train_cls2d
        net = train_cls2d.model(); net.load_state_dict(torch.load('/home/user/data/cls2d.pt'))
        x = torch.rand(64, 3, 64, 64) * 255; dyn = {'x': {0: 'n'}, 'y': {0: 'n'}}
    else:
        import train_corner
        net = train_corner.Net(pretrained=False); net.load_state_dict(torch.load('/home/user/data/corner.pt'))
        x = torch.rand(1, 3, 320, 320) * 255; dyn = None
    m = Norm(net).eval()
    torch.onnx.export(m, x, out, input_names=['x'], output_names=['y'], dynamic_axes=dyn, opset_version=17, dynamo=False)
    import onnxruntime as ort
    s = ort.InferenceSession(out)
    with torch.no_grad():
        ref = m(x).numpy()
    got = s.run(None, {'x': x.numpy()})[0]
    print(which, 'max diff', np.abs(ref - got).max())

if __name__ == '__main__':
    export(sys.argv[1], sys.argv[2])
