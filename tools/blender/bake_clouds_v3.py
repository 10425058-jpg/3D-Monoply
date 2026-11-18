"""Original connected cumulus impostors, authored offline for the cloud pass.

Blender --background --factory-startup --python-exit-code 1 --python
tools/blender/bake_clouds_v3.py

Square cells preserve the authored cloud aspect in every view. Optical depth
and short sunlight probes model connected masses; no runtime volume march,
external image, paid provider, or mesh sphere is involved. RGB is linear and
alpha is straight. Transparent texels retain a light RGB fringe for mipmaps.
"""
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import numpy as np

from bake_clouds_v2 import noise, png, resize

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/textures/environment'
SEED = 10425058
CELL_SIZES = {'low': 128, 'balanced': 192, 'high': 256}

# Connected, asymmetric bough-like massing rather than detached circles. Each
# tuple is x, y, z, width, height, depth, density of a softly blended volume.
PROFILES = [
    [(-.65,-.13,.02,.49,.40,.50,1),(-.18,.08,-.06,.63,.58,.65,1),(.35,.03,.02,.52,.49,.55,1),(.72,-.18,-.12,.34,.32,.38,.8)],
    [(-.70,-.16,-.08,.42,.36,.42,.8),(-.27,.10,.02,.57,.56,.65,1),(.20,.22,-.05,.52,.62,.57,1),(.63,-.09,.08,.44,.39,.52,.9)],
    [(-.56,-.11,.01,.52,.45,.58,1),(-.13,.24,-.02,.50,.62,.60,1),(.30,-.05,.05,.53,.43,.66,1),(.75,-.20,-.12,.34,.32,.35,.7)],
    [(-.76,-.16,-.08,.34,.29,.38,.8),(-.35,.01,.01,.52,.48,.59,1),(.11,-.03,-.02,.62,.46,.68,1),(.64,-.15,.06,.45,.34,.48,.9)],
    [(-.68,-.13,.03,.46,.41,.47,.9),(-.22,.19,-.05,.57,.59,.62,1),(.27,.08,.07,.55,.52,.61,1),(.68,-.15,-.10,.38,.31,.44,.7)],
    [(-.65,-.12,-.02,.44,.39,.52,.9),(-.17,.00,.02,.57,.53,.67,1),(.29,.22,-.10,.49,.62,.59,1),(.71,-.15,.05,.35,.34,.43,.8)],
    [(-.70,-.15,.03,.43,.34,.46,.8),(-.24,.05,-.02,.59,.49,.62,1),(.23,.02,.01,.57,.50,.59,1),(.70,-.16,-.05,.37,.30,.40,.8)],
    [(-.67,-.18,-.07,.41,.33,.43,.8),(-.29,.16,.02,.48,.55,.57,1),(.15,.13,-.05,.60,.59,.68,1),(.67,-.11,.05,.44,.39,.46,.8)],
]


def cloud_volume(index, size=256, steps=44):
    rng = np.random.default_rng(SEED+index*313)
    grid = rng.random((32,32,32), dtype=np.float32)
    coordinates = np.linspace(-1.58,1.58,size,dtype=np.float32)
    x,y = np.meshgrid(coordinates,coordinates)
    zs = np.linspace(1.04,-1.04,steps,dtype=np.float32)
    densities=[]
    for z in zs:
        envelope=np.zeros_like(x)
        # Compact overlapping billows retain their shoulders. Gaussian sums
        # over-merged the crowns into smooth triangle-shaped mounds; a bounded
        # max union gives each unequal core a readable round silhouette.
        shoulders=PROFILES[index]
        for cx,cy,cz,rx,ry,rz,weight in shoulders:
            r2=np.square((x-cx)/rx)+np.square((y-cy)/ry)+np.square((z-cz)/rz)
            lobe=np.maximum(0,1-r2)
            envelope=np.maximum(envelope,lobe*weight)
        for j in (0,2):
            cx,cy,cz,rx,ry,rz,_=shoulders[(j+index%2)%4]
            r2=np.square((x-(cx-.12))/ (rx*.66))+np.square((y-(cy+ry*.67))/(ry*.68))+np.square((z-(cz+.10))/(rz*.73))
            envelope=np.maximum(envelope,np.maximum(0,1-r2)*.86)
        # Two smaller foreground lobes lend depth to the skirt without adding
        # detached bubbles or hiding the shape in an opaque horizontal strip.
        for j in (1,2):
            cx,cy,cz,rx,ry,rz,_=shoulders[j]
            r2=np.square((x-(cx+.13))/(rx*.73))+np.square((y-(cy-ry*.40))/(ry*.63))+np.square((z-(cz+.27))/(rz*.70))
            envelope=np.maximum(envelope,np.maximum(0,1-r2)*.78)
        coarse=noise(grid,x*2.15+11,y*2.25+index,z*2.1+9)
        detail=noise(grid,x*5.9+3,y*6.3+15,z*5.5+2)
        fine=noise(grid,x*13.2+6,y*13.6+3,z*11.7+14)
        erosion=(coarse-.5)*.10+(detail-.5)*.045+(fine-.5)*.014
        density=np.maximum(0,envelope-.012+erosion*np.clip(envelope*8,0,1))
        # A compact optical fringe remains soft over a few pixels instead of
        # spreading low alpha across most of a card and reading as flat fog.
        density=np.power(density,1.08)
        densities.append(density.astype(np.float32))
    volume=np.stack(densities)
    trans=np.ones((size,size),dtype=np.float32)
    color_accum=np.zeros((size,size,3),dtype=np.float32)
    yy,xx=np.indices((size,size))
    for k in range(steps):
        optical=np.zeros_like(trans)
        # Sunward probes point up and left through the original density field.
        # They shade internal undercuts without introducing spherical normals.
        for tap in range(1,7):
            sk=max(0,k-tap*2)
            sx=xx-tap*max(1,size//70)
            sy=yy+tap*max(1,size//65)
            valid=(sx>=0)&(sy<size)
            optical+=np.where(valid,volume[sk,np.minimum(sy,size-1),np.maximum(sx,0)],0)*.31
        sunlight=np.exp(-optical*3.2)
        crown=np.clip((y+.30)*.42,0,.38)
        light=np.clip(.12+sunlight*.76+crown*.14,0,1)
        shade=np.array([.36,.35,.52],dtype=np.float32)
        pearl=np.array([1.02,.97,.93],dtype=np.float32)
        color=shade+(pearl-shade)*light[...,None]
        alpha=1-np.exp(-volume[k]*(2.08/steps)*7.8)
        weight=alpha*trans
        color_accum+=color*weight[...,None]
        trans*=1-alpha
    alpha=np.clip((1-trans)*.97,0,1)
    rgb=color_accum/np.maximum((1-trans)[...,None],.0001)
    # Light colour in zero-alpha gutters prevents dark filtering fringes when
    # straight-alpha cells are linearly filtered or downsampled for mip levels.
    rgb[alpha<.003]=np.array([.90,.86,.92])
    alpha[alpha<.003]=0
    rgba=np.concatenate((np.clip(rgb,0,1),alpha[...,None]),axis=2)
    return np.round(rgba*255).astype(np.uint8)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    clouds=[]
    for index in range(8):
        clouds.append(cloud_volume(index))
        print(f'CUMULUS {index+1}/8 integrated',flush=True)
    records=[]
    for tier,size in CELL_SIZES.items():
        atlas=np.zeros((size*2,size*4,4),dtype=np.uint8)
        for index,cloud in enumerate(clouds):
            tile=resize(cloud,size,size)
            atlas[(index//4)*size:(index//4+1)*size,(index%4)*size:(index%4+1)*size]=tile
        record=png(OUT/f'cloud-volume-v3-{tier}.png',atlas)
        records.append({'tier':tier,'columns':4,'rows':2,'cellSize':size,**record})
        print(f'ATLAS {record["file"]}: {record["bytes"]} bytes',flush=True)
    script=Path(__file__).resolve()
    manifest={'schema':1,'generator':'tools/blender/bake_clouds_v3.py','seed':SEED,
        'blenderVersion':bpy.app.version_string,'variants':8,
        'method':'Connected asymmetric 3D cumulus density, offline Beer-Lambert integration, six optical-depth sunlight probes',
        'license':'Original procedural project textures; repository MIT license applies',
        'colorSpace':'linear RGB, straight alpha; light RGB retained in transparent gutters',
        'sourceHashes':{name:hashlib.sha256((script.parent/name).read_bytes().replace(b'\r\n',b'\n')).hexdigest()
            for name in ['bake_clouds_v3.py','bake_clouds_v2.py']},
        'assets':records}
    (OUT/'cloud-volume-v3-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()
