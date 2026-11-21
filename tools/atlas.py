# builds zanko/assets/hero.png + zanko/js/hero_atlas.js from the generated sheets
import sys,json,numpy as np
from PIL import Image,ImageFilter,ImageDraw
from scipy import ndimage as ndi
U='/mnt/user-data/uploads/'; OUT='/home/claude/zanko/'
NATIVE_PER_UNIT=354/32.0; SC=0.9; PPU=NATIVE_PER_UNIT*SC; HW=6
def key(cell):
    bg=np.median(np.concatenate([cell[:6].reshape(-1,3),cell[-6:].reshape(-1,3)]),axis=0)
    d=np.sqrt(((cell-bg)**2).sum(2)); near=d<26
    lab,_=ndi.label(near); edge=set(lab[0])|set(lab[-1])|set(lab[:,0])|set(lab[:,-1]); edge.discard(0)
    bgmask=np.isin(lab,list(edge)); a=np.where(bgmask,0,255).astype(np.uint8)
    a=np.array(Image.fromarray(a).filter(ImageFilter.GaussianBlur(0.7))); a=np.where(bgmask&(a<128),0,a)
    rg=np.dstack([cell.astype(np.uint8),a])
    lab,n=ndi.label(a>40)
    if n>1:
        sz=ndi.sum(np.ones_like(lab),lab,range(1,n+1)); rg[...,3]=np.where(lab==1+int(np.argmax(sz)),rg[...,3],0)
    return rg
def cells(f):
    im=np.array(Image.open(U+f+'-image.png').convert('RGB')).astype(np.int32); h,w=im.shape[:2]
    return [key(im[r*h//2:(r+1)*h//2,c*w//4:(c+1)*w//4]) for r in range(2) for c in range(4)]
def feetmid(rg):
    al=rg[...,3]>128; bot=np.nonzero(al.any(1))[0].max(); x=np.nonzero(al[bot-7:bot+1].any(0))[0]; return (x.min()+x.max())/2
def stripe_x(rg,upper=True):
    r,g,b=[rg[...,i].astype(int) for i in range(3)]; m=(rg[...,3]>128)&(b>150)&(r>90)&(r<150)&(g>110)&(g<170)
    ys,xs=np.nonzero(m)
    if upper: cut=np.percentile(ys,45); xs=xs[ys<=cut]
    return xs.mean()
def hilt(rg):
    # the hilt is the only neutral dark grey in the picture; hands split it into pieces, so gather the pieces near the biggest one
    r,g,b=[rg[...,i].astype(int) for i in range(3)]; m=(rg[...,3]>200)&(abs(r-g)<12)&(abs(g-b)<12)&(abs(r-b)<12)&(r>40)&(r<125)
    lab,n=ndi.label(ndi.binary_opening(m,iterations=1))
    if n==0: return None
    sz=ndi.sum(m,lab,range(1,n+1)); L=1+int(np.argmax(sz))
    if sz.max()<25: return None
    cy,cx=[v.mean() for v in np.nonzero(lab==L)]; keep=np.zeros_like(m)
    for k in range(1,n+1):
        if sz[k-1]<12: continue
        ys,xs=np.nonzero(lab==k)
        if np.hypot(xs.mean()-cx,ys.mean()-cy)<48: keep|=(lab==k)
    ys,xs=np.nonzero(keep); pts=np.c_[xs,ys].astype(float); c=pts.mean(0); u=np.linalg.svd(pts-c,full_matrices=False)[2][0]; pr=(pts-c)@u
    e1,e2=c+u*pr.min(),c+u*pr.max()
    return float(c[0]),float(c[1]),int(keep.sum()),[float(e1[0]),float(e1[1]),float(e2[0]),float(e2[1])]
# sheets B and C exist in two versions: one-handed (a69234c3, 4a869418) and two-handed (d8712247, 479d10e5)
B_SRC,C_SRC=('d8712247','479d10e5') if 'two' in sys.argv[1:] else ('a69234c3','4a869418')
A,B,Cc,D=cells('a06ea9f8'),cells(B_SRC),cells(C_SRC),cells('bf5bdea5')
F={}   # name -> (rgba, ax, ay or None(=bottom), want hilt)
def add(name,rg,ax,ay=None,h=False): F[name]=(rg,ax,ay,h)
m=feetmid(A[0]); add('idle0',A[0],m); add('idle1',A[1],m)
add('dash',A[2],feetmid(A[2])); add('rise',A[3],stripe_x(A[3])); add('fall',A[4],stripe_x(A[4]))
al=A[5][...,3]>128; add('slide',A[5],np.nonzero(al.any(0))[0].max()-HW*NATIVE_PER_UNIT)
add('hurt',A[6],stripe_x(A[6],False)); add('use',A[7],feetmid(A[7]))
EX=cells('34e7690d')[0]; add('adash',EX,stripe_x(EX))   # air dash: its own single-pose sheet (second of two takes)
m=feetmid(B[0])
for i,n in enumerate(['s1_0','s1_1','s1_2','s2_0','s2_1','s2_2']): add(n,B[i],m,h=True)
m=feetmid(Cc[0])
for i in range(4): add(f's3_{i}',Cc[i],m,h=True)
m=feetmid(Cc[4])
for i in range(4): add(f'charge_{i}',Cc[4+i],m,h=True)
add('air_0',D[0],stripe_x(D[0]),h=True); add('air_1',D[1],stripe_x(D[1]),h=True)
m=feetmid(D[2]); add('datk_0',D[2],m,h=True); add('datk_1',D[3],m,h=True)
for i in (4,5):
    al=D[i][...,3]>128; add(f'wall_{i-4}',D[i],np.nonzero(al.any(0))[0].min()+HW*NATIVE_PER_UNIT,h=True)
add('dead0',D[6],stripe_x(D[6],False)); al=D[7][...,3]>128; xs=np.nonzero(al.any(0))[0]; add('dead1',D[7],(xs.min()+xs.max())/2)
for i in range(8):
    rg=np.array(Image.open(f'/home/claude/gen4/out/run_{i+1}.png').convert('RGBA')); add(f'run{i}',rg,360.0,640.0)
# trim, scale, pack
items=[]
for name,(rg,ax,ay,wh) in F.items():
    al=rg[...,3]>20; ys,xs=np.nonzero(al); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    if ay is None: ay=float(np.nonzero((rg[...,3]>128).any(1))[0].max()+1)
    hp=hilt(rg) if wh else None
    im=Image.fromarray(rg[y0:y1,x0:x1],'RGBA'); w,h=max(1,round(im.width*SC)),max(1,round(im.height*SC)); im=im.resize((w,h),Image.LANCZOS)
    d={'w':w,'h':h,'ax':round((ax-x0)*SC,1),'ay':round((ay-y0)*SC,1)}
    if hp: d['hx']=round((hp[0]-x0)*SC,1); d['hy']=round((hp[1]-y0)*SC,1); d['_hpx']=hp[2]; e=hp[3]; d['he']=[round((e[0]-x0)*SC,1),round((e[1]-y0)*SC,1),round((e[2]-x0)*SC,1),round((e[3]-y0)*SC,1)]
    elif wh: print('NO HILT',name)
    items.append((name,im,d))
W=2048; x=y=rowh=0; pad=2; order=sorted(items,key=lambda t:-t[2]['h'])
for name,im,d in order:
    if x+d['w']+pad>W: x=0; y+=rowh+pad; rowh=0
    d['x'],d['y']=x,y; x+=d['w']+pad; rowh=max(rowh,d['h'])
H=y+rowh; atlas=Image.new('RGBA',(W,H),(0,0,0,0))
for name,im,d in order: atlas.alpha_composite(im,(d['x'],d['y']))
atlas.quantize(colors=256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(OUT+'assets/hero.png',optimize=True)   # flat shading: 256 colours is enough, 2.0MB -> 0.4MB
meta={'ppu':round(PPU,3),'frames':{n:{k:v for k,v in d.items() if not k.startswith('_')} for n,im,d in items}}
open(OUT+'js/hero_atlas.js','w').write('// generated by the atlas tool from the character sheets: do not edit by hand\nconst HERO_ATLAS = '+json.dumps(meta,separators=(',',':'))+';\n')
# check sheet: every frame on a common ground line with anchor (green) and hilt (magenta)
n=len(items); cw=300; chh=380; chk=Image.new('RGB',(cw*10,chh*((n+9)//10)),(128,128,128)); dr=ImageDraw.Draw(chk)
for i,(name,im,d) in enumerate(items):
    ox=(i%10)*cw+150; oy=(i//10)*chh+350
    bg=Image.new('RGBA',im.size,(0,0,0,0)); chk.paste(im,(int(ox-d['ax']),int(oy-d['ay'])),im)
    dr.line([(ox-140,oy),(ox+140,oy)],fill=(40,40,40)); dr.line([(ox,oy-8),(ox,oy+8)],fill=(0,255,0),width=2)
    if 'hx' in d:
        for q in (0,2): hx,hy=ox-d['ax']+d['he'][q],oy-d['ay']+d['he'][q+1]; dr.ellipse([hx-4,hy-4,hx+4,hy+4],outline=(255,0,255),width=2)
    dr.text((ox-140,oy+10),name,fill=(255,255,255))
chk.save('/home/claude/gen11/out/atlas_check.png')
print(atlas.size, n,'frames', 'ppu',round(PPU,2)); print({n:d.get('_hpx') for n,im,d in items if '_hpx' in d})
