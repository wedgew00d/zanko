# builds zanko/assets/tile.png (one wall panel, cut seam-centre to seam-centre so it repeats) from the 4x4 panel sheet
import numpy as np
from PIL import Image
SRC='/mnt/user-data/uploads/f0494c23-image.png'; OUT='/home/claude/zanko/assets/tile.png'
im=Image.open(SRC).convert('RGB'); a=np.array(im).astype(float); H,W=a.shape[:2]; lum=a.mean(2)
def seams(profile,n):
    out=[]
    for k in range(1,4):
        c=int(n*k/4); w=profile[c-25:c+25]; out.append(c-25+int(np.argmin(w)))
    return out
sx,sy=seams(lum.mean(0),W),seams(lum.mean(1),H); print('seams x',sx,'y',sy,'size',im.size)
tile=im.crop((sx[0],sy[0],sx[1],sy[1])); print('panel',tile.size,'mean colour',np.array(tile).reshape(-1,3).mean(0).round(1))
t=np.array(tile.resize((128,128),Image.LANCZOS)).astype(float)
# how well it repeats: compare opposite edges
print('edge mismatch L/R',np.abs(t[:,0]-t[:,-1]).mean().round(2),'T/B',np.abs(t[0]-t[-1]).mean().round(2),'contrast (p99-p1)',np.percentile(t.mean(2),99)-np.percentile(t.mean(2),1))
Image.fromarray(t.astype(np.uint8)).save(OUT,optimize=True)
big=Image.new('RGB',(512,256)); 
for i in range(4):
    for j in range(2): big.paste(Image.open(OUT),(i*128,j*128))
big.save('/home/claude/gen15/out/tile_repeat.png')

# ---- gate door and spikes (magenta background): assets/gate.png, assets/spikes.png ----
from PIL import ImageFilter
from scipy import ndimage as ndi
def keyed(path):
    c=np.array(Image.open(path).convert('RGB')).astype(np.int32); bg=np.median(np.concatenate([c[:6].reshape(-1,3),c[-6:].reshape(-1,3)]),axis=0)
    bgm=np.sqrt(((c-bg)**2).sum(2))<95; a=np.where(bgm,0,255).astype(np.uint8); a=np.array(Image.fromarray(a).filter(ImageFilter.GaussianBlur(0.7))); a=np.where(bgm&(a<128),0,a)
    r,g,b=c[...,0],c[...,1],c[...,2]; band=ndi.binary_dilation(bgm,iterations=3)&~bgm; spill=band&(np.abs(r-b)<70)&(np.minimum(r,b)-g>35)
    c[...,0]=np.where(spill,g+4,r); c[...,2]=np.where(spill,g+10,b)
    return np.dstack([np.clip(c,0,255).astype(np.uint8),a])
rg=keyed('/mnt/user-data/uploads/dd9a31cb-image.png'); lab,n=ndi.label(rg[...,3]>128); sz=ndi.sum(np.ones_like(lab),lab,range(1,n+1)); order=np.argsort(-sz)[:2]
parts=[]
for k in order:
    ys,xs=np.nonzero(lab==k+1); parts.append((xs.min(),xs.max()+1,ys.min(),ys.max()+1))
parts.sort(key=lambda p:p[0]); (gx0,gx1,gy0,gy1),(sx0,sx1,sy0,sy1)=parts
print('gate',gx1-gx0,'x',gy1-gy0,'ratio 1:',round((gy1-gy0)/(gx1-gx0),2),'| spikes',sx1-sx0,'x',sy1-sy0)
Image.fromarray(rg[gy0:gy1,gx0:gx1],'RGBA').resize((128,512),Image.LANCZOS).save('/home/claude/zanko/assets/gate.png',optimize=True)
Image.fromarray(rg[sy0:sy1,sx0:sx1],'RGBA').resize((256,88),Image.LANCZOS).save('/home/claude/zanko/assets/spikes.png',optimize=True)   # 6 spikes = 2 tiles wide

# ---- distant skyline, two layers in one sheet (magenta sky): assets/bg_far.png, assets/bg_near.png ----
rg=keyed('/mnt/user-data/uploads/f6f1dc7a-image.png'); al=rg[...,3]>128; rows=al.any(1); H2=rg.shape[0]
gap=[y for y in range(int(H2*0.35),int(H2*0.65)) if not rows[y]]; cut=(gap[0]+gap[-1])//2 if gap else H2//2
for name,(y0,y1) in (('bg_far',(0,cut)),('bg_near',(cut,H2))):
    part=rg[y0:y1]; ys=np.nonzero((part[...,3]>128).any(1))[0]; part=part[ys.min():ys.max()+1]; cols=np.nonzero((part[...,3]>128).any(0))[0]
    print(name,'size',part.shape[1],'x',part.shape[0],'empty margin left',int(cols.min()),'right',int(part.shape[1]-1-cols.max()),'mean colour',part[part[...,3]>200][:,:3].mean(0).round(0))
    Image.fromarray(part,'RGBA').quantize(colors=64,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(f'/home/claude/zanko/assets/{name}.png',optimize=True)
