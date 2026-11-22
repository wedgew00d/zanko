"""Portraits for conversations: keys out the green background and writes assets/portrait/<name>.png (+ expressions).

    python3 tools/portrait.py <name> <base.png> [<face>=<file.png> ...]

The face called 'default' replaces <name>.png itself: the body stays the base's, the everyday face comes from that file.
(Used for the hero: the first drawing came out stern, so a calmer face was made afterwards and became the default.)

- Background: pure green (#00FF00), also in the gaps between arm and body. Keyed by colour everywhere, then the green
  cast on the outline is removed (green is pulled down to the larger of red and blue wherever it sticks out).
- All files of one character are cut with the base's crop box and scaled alike, so an expression lies exactly on the base.
- An expression file is the base redrawn with another face. Redraws shift a little, so only the area around the face is
  taken from it (the box where it differs from the base inside the head region) and pasted onto the base.
- Prints the face box for the small comm window (centre x, centre y, width; fractions of the image): put it in js/story.js.
The input paths are whatever the chat session had; the source images are not in the repository.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

OUT_H = 1100
HERE = os.path.dirname(os.path.abspath(__file__))

def key(path, size=None):
    im = Image.open(path).convert('RGB')
    if size and im.size != size: im = im.resize(size, Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)                                  # how much greener than anything else
    alpha = np.clip(1 - (d - 24) / 96, 0, 1)
    g2 = np.where(d > 0, np.maximum(r, b) + np.minimum(d, 0), g)   # despill: green never above max(red, blue)
    out = np.dstack([r, np.where(alpha < 1, np.minimum(g, np.maximum(r, b)), g2 * 0 + g), b, alpha * 255])
    out[..., 1] = np.where(d > 8, np.maximum(r, b), g)
    return out

def main():
    name, base_path = sys.argv[1], sys.argv[2]
    base = key(base_path); H, W = base.shape[:2]
    ys, xs = np.where(base[..., 3] > 8); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = 6; x0, y0, x1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad)
    k = OUT_H / (y1 - y0)
    def save(arr, suffix):
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').crop((x0, y0, x1, y1))
        im = im.resize((round((x1 - x0) * k), OUT_H), Image.LANCZOS)
        p = os.path.join(HERE, '..', 'assets', 'portrait', name + suffix + '.png'); im.save(p, optimize=True); return im, p
    im, p = save(base, ''); print('base', im.size, os.path.getsize(p) // 1024, 'KB')
    # face box: skin-coloured pixels in the upper 31 % of the cut-out
    a = np.asarray(im).astype(np.float32); top = a[: int(OUT_H * 0.31)]   # 0.31: below that a hand held at the chest would be taken for the face
    skin = (top[..., 3] > 200) & (top[..., 0] > 200) & (top[..., 1] > 150) & (top[..., 2] > 110) & (top[..., 0] > top[..., 2] + 30)
    sy, sx = np.where(skin); cx, cy, fw = (sx.min() + sx.max()) / 2 / im.width, (sy.min() + sy.max()) / 2 / im.height, (sx.max() - sx.min()) * 1.7 / im.width
    print('face box for story.js: [%.3f, %.3f, %.3f]' % (cx, cy, fw))
    head = (int(sx.min() / k + x0) - 40, int(sy.min() / k + y0) - 40, int(sx.max() / k + x0) + 40, int(sy.max() / k + y0) + 40)   # in source pixels
    for arg in sys.argv[3:]:
        face, path = arg.split('=', 1); ex = key(path, (W, H))
        hx0, hy0, hx1, hy1 = head; diff = np.abs(ex[hy0:hy1, hx0:hx1, :3] - base[hy0:hy1, hx0:hx1, :3]).max(-1) > 40
        if not diff.any(): save(base, '_' + face); print(face, 'same as the base: the base itself is saved under this name'); continue   # e.g. serious=<the base file>, when another face becomes the default
        dy, dx = np.where(diff); bx0, by0, bx1, by1 = hx0 + dx.min() - 10, hy0 + dy.min() - 10, hx0 + dx.max() + 10, hy0 + dy.max() + 10
        mask = Image.new('L', (W, H), 0); mask.paste(255, (bx0, by0, bx1, by1)); mask = np.asarray(mask.filter(ImageFilter.GaussianBlur(4))).astype(np.float32)[..., None] / 255
        im2, p2 = save(base * (1 - mask) + ex * mask, '' if face == 'default' else '_' + face); print(face, 'box', (bx0, by0, bx1, by1), os.path.getsize(p2) // 1024, 'KB')

if __name__ == '__main__': main()
