"""Colour look-up table for the shader pass: writes assets/lut.png (the look) and tools/lut_neutral.png (no change).

Layout: 256x16, sixteen 16x16 tiles side by side. Inside a tile x = red, y = green (top = 0); the tile index = blue.
This is the common "strip" layout, so a look can also be made by hand: take a screenshot of the game with colour
grading OFF, grade it in any image or compositing tool, apply exactly the same adjustments to tools/lut_neutral.png
and save the result as assets/lut.png (256x16, no resizing, no colour management).

    python3 tools/lut.py
"""
import os
import numpy as np
from PIL import Image

N = 16
HERE = os.path.dirname(os.path.abspath(__file__))

def strip(fn):
    out = np.zeros((N, N * N, 3))
    v = np.arange(N) / (N - 1)
    for b in range(N):
        g, r = np.meshgrid(v, v, indexing='ij')
        rgb = np.stack([r, g, np.full_like(r, v[b])], -1)
        out[:, b * N:(b + 1) * N] = fn(rgb)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')

def look(c):
    luma = (c * [0.2126, 0.7152, 0.0722]).sum(-1, keepdims=True)
    # split toning: shadows lean to deep blue-teal, highlights to a slightly warm white
    sh = (1 - np.clip(luma / 0.45, 0, 1)) ** 1.5
    hi = np.clip((luma - 0.55) / 0.45, 0, 1) ** 1.5
    c = c + sh * np.array([-0.012, 0.004, 0.026]) + hi * np.array([0.02, 0.008, -0.016])
    # a little more colour in the mid tones only (accents: amber, pink, green), none added to near-white or near-black
    luma = (c * [0.2126, 0.7152, 0.0722]).sum(-1, keepdims=True)
    mid = 1 - np.abs(luma - 0.45) / 0.55
    c = luma + (c - luma) * (1 + 0.14 * np.clip(mid, 0, 1))
    return c

if __name__ == '__main__':
    strip(lambda c: c).save(os.path.join(HERE, 'lut_neutral.png'))
    strip(look).save(os.path.join(HERE, '..', 'assets', 'lut.png'))
    print('wrote assets/lut.png and tools/lut_neutral.png')
