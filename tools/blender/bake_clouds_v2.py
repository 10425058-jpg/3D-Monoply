"""Bake eight original soft cloud volumes into compact RGBA impostor atlases.

Run with Blender --background --factory-startup --python-exit-code 1 --python
tools/blender/bake_clouds_v2.py. NumPy ships with Blender. No renderer, provider,
photograph, concept pixels, sphere meshes or runtime volume march is required.
RGB is linear, alpha is straight. Atlas cells have fully transparent gutters.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

import numpy as np

OUT=Path(__file__).resolve().parents[2]/"public/assets/textures/environment"
SEED=10425058


def noise(grid,x,y,z):
    x,y,z=np.broadcast_arrays(x,y,z)
    ix,iy,iz=np.floor(x).astype(np.int32),np.floor(y).astype(np.int32),np.floor(z).astype(np.int32)
    fx,fy,fz=x-ix,y-iy,z-iz
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz)
    ix&=31;iy&=31;iz&=31
    a=grid[ix,iy,iz]*(1-fx)+grid[(ix+1)&31,iy,iz]*fx
    b=grid[ix,(iy+1)&31,iz]*(1-fx)+grid[(ix+1)&31,(iy+1)&31,iz]*fx
    c=grid[ix,iy,(iz+1)&31]*(1-fx)+grid[(ix+1)&31,iy,(iz+1)&31]*fx
    d=grid[ix,(iy+1)&31,(iz+1)&31]*(1-fx)+grid[(ix+1)&31,(iy+1)&31,(iz+1)&31]*fx
    return ((a*(1-fy)+b*fy)*(1-fz)+(c*(1-fy)+d*fy)*fz).astype(np.float32)


def cloud_volume(index,width=320,height=192,steps=36):
    rng=np.random.default_rng(SEED+index*239)
    grid=rng.random((32,32,32),dtype=np.float32)
    x,y=np.meshgrid(np.linspace(-1.7,1.7,width,dtype=np.float32),np.linspace(-1,1,height,dtype=np.float32))
    # Long, asymmetric wind-shaped banks. The density field, rather than a union
    # of lobes, supplies all internal shapes and irregular boundaries.
    phase=index*1.37
    bend=np.sin(x*1.8+phase)*.13+np.sin(x*4.1-phase)*.035
    spread=.37+noise(grid,x*.8+4,y*.5+7,np.float32(2+index))*.15
    if index>=4: spread*=.76
    body=np.exp(-np.power(np.abs(x)/1.37,4)-np.square((y-bend+.07)/spread))
    volume=[]
    zs=np.linspace(.95,-.95,steps,dtype=np.float32)
    for z in zs:
        envelope=body*np.exp(-np.power(abs(z)/.78,4))
        coarse=noise(grid,x*2.1+11,y*3.1+index,z*2.4+9)
        detail=noise(grid,x*5.3+3,y*7.2+15,z*5.8+2)
        fine=noise(grid,x*11.4+6,y*15.0+3,z*12.3+14)
        field=coarse*.61+detail*.28+fine*.11
        density=np.maximum(0,envelope*1.06-.51+(field-.5)*.96)
        # Fine fringe erosion keeps a feathered edge and drifting wisps.
        density=np.maximum(0,density)*(np.minimum(1,np.maximum(0,envelope-.06)*4))
        volume.append(density.astype(np.float32))
    volume=np.stack(volume)
    trans=np.ones((height,width),dtype=np.float32)
    rgb=np.zeros((height,width,3),dtype=np.float32)
    yy,xx=np.indices((height,width))
    for k in range(steps):
        # Six short optical-depth samples through the existing volume create
        # self-shadowed billows without any sphere surface normals.
        optical=np.zeros_like(trans)
        for j in range(1,7):
            sk=max(0,k-j*2)
            sx=xx-j*max(1,width//64)
            sy=yy+j*max(1,height//37)
            valid=(sx>=0)&(sy<height)
            optical+=np.where(valid,volume[sk,np.minimum(sy,height-1),np.maximum(sx,0)],0)*.20
        sunlight=np.exp(-optical*3.0)
        height_light=np.clip((y+.45)*.36,0,.40)
        light=.30+sunlight*.67+height_light*.16
        shade=np.array([.32,.39,.57],dtype=np.float32)
        pearl=np.array([1.11,1.04,.99],dtype=np.float32)
        color=shade+(pearl-shade)*light[...,None]
        alpha=1-np.exp(-volume[k]*(1.9/steps)*8.2)
        weight=alpha*trans
        rgb+=color*weight[...,None]
        trans*=1-alpha
    alpha=1-trans
    rgb/=np.maximum(alpha[...,None],.0001)
    # Mild optical softness; smooth density edges remain below full opacity.
    alpha=np.clip(alpha*.95,0,1)
    rgba=np.concatenate((np.clip(rgb,0,1),alpha[...,None]),axis=2)
    rgba[alpha<.002]=0
    return np.round(rgba*255).astype(np.uint8)


def resize(image,width,height):
    xs=np.linspace(0,image.shape[1]-1,width)
    ys=np.linspace(0,image.shape[0]-1,height)
    ix=np.floor(xs).astype(int);iy=np.floor(ys).astype(int)
    fx=(xs-ix)[None,:,None];fy=(ys-iy)[:,None,None]
    jx=np.minimum(ix+1,image.shape[1]-1);jy=np.minimum(iy+1,image.shape[0]-1)
    a=image[iy[:,None],ix[None,:]]*(1-fx)+image[iy[:,None],jx[None,:]]*fx
    b=image[jy[:,None],ix[None,:]]*(1-fx)+image[jy[:,None],jx[None,:]]*fx
    return np.round(a*(1-fy)+b*fy).astype(np.uint8)


def png(path,pixels):
    height,width=pixels.shape[:2]
    def chunk(kind,data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    # No gAMA chunk: bytes encode linear RGB for the custom Three shader.
    raw=b"".join(b"\0"+row.tobytes() for row in pixels[::-1])
    data=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")
    path.write_bytes(data)
    return {"file":path.name,"width":width,"height":height,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()}


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    clouds=[]
    for i in range(8):
        clouds.append(cloud_volume(i))
        print(f"VOLUME {i+1}/8 baked",flush=True)
    records=[]
    for tier,(width,height) in {"low":(128,80),"balanced":(224,128),"high":(320,192)}.items():
        atlas=np.zeros((height*2,width*4,4),dtype=np.uint8)
        for i,cloud in enumerate(clouds):
            tile=resize(cloud,width,height)
            atlas[(i//4)*height:(i//4+1)*height,(i%4)*width:(i%4+1)*width]=tile
        record=png(OUT/f"cloud-volume-v2-{tier}.png",atlas)
        records.append({"tier":tier,"columns":4,"rows":2,**record})
        print(f"ATLAS {record['file']} {record['bytes']} bytes",flush=True)
    manifest={"schema":1,"generator":"tools/blender/bake_clouds_v2.py","seed":SEED,
      "method":"3D fractal density, offline Beer-Lambert integration and six optical-depth lighting taps",
      "license":"Original procedural project textures; repository MIT license applies",
      "colorSpace":"linear RGB, straight alpha","variants":8,"assets":records}
    (OUT/"cloud-volume-v2-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__":main()
