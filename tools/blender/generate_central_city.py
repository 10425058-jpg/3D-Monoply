"""Original central royal district, authored offline with bpy.

Reuses the project's architectural construction modules, not background GLBs.
Blender Z-up/front -Y -> exported glTF Y-up/front +Z. All geometry stays
inside the existing 15.3m central lawn; the Monopoly ring is never authored here.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from core import reset_scene,make_materials,box,mesh,lathe,tube,arch,arch_panel,transform_objects,uv_project
from generate_castles import generate_castle,_tower,_window,_gable_roof,_heraldry
from generate_villages import generate_house
from generate_vegetation import generate_shrub,generate_garden_rocks,_cluster
from generate_gardens import generate_pavilion
from generate_lanterns import generate_lantern
import generate_castles as castle_modules
import generate_villages as village_modules

OUT=HERE.parents[1]/'public/assets/models/central-city'
SEED=10425058
BUDGET={'high':100000,'balanced':68000,'low':38000}


def city_window(materials,position,width=.32,height=.76,rotation=0,detail='high',name='Lancet'):
    # Side reveals in the reusable authoring module point inward. Correct that
    # placement only in this district's offline invocation; source modules and
    # all shipped floating-world assets remain immutable.
    if 'side' in name.lower() and abs(abs(rotation)-math.pi/2)<.001:rotation=-rotation
    return _window(materials,position,width,height,rotation,detail,name)


castle_modules._window=city_window
village_modules._window=city_window


def city_materials():
    m=make_materials()
    specs=[('ivory','eddfbd',.77,0),('stone','bcb49f',.88,0),('blue','234c91',.46,.06),
      ('gold','e3b657',.34,.48),('wood','754c32',.82,0),('window','ffd28c',.35,0),
      ('grass','599044',.96,0),('rock','726b7b',.96,0),('blossom','f19ac3',.92,0),
      ('leaf','2c6844',.95,0),('red','a92f50',.88,0),('paving','d2c7ae',.87,0),
      ('cream','eee4c8',.80,0),('purple','764e91',.85,0)]
    atlas=bpy.data.images.new('Central_royal_surface_atlas_256',width=256,height=256)
    atlas.colorspace_settings.name='sRGB';pixels=[.5,.5,.5,1.]*(256*256)
    for index,(key,hexcolor,roughness,metallic) in enumerate(specs):
        if key not in m:
            mat=bpy.data.materials.new('Royal district '+key);mat.use_nodes=True;m[key]=mat
        mat=m[key];mat['atlas_index']=index
        nodes=mat.node_tree.nodes;shader=nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value=roughness;shader.inputs['Metallic'].default_value=metallic
        rgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
        mat.diffuse_color=(*rgb,1)
        texture=next((node for node in nodes if node.type=='TEX_IMAGE'),None) or nodes.new('ShaderNodeTexImage')
        for node in nodes:
            if node.type=='TEX_IMAGE':node.image=atlas
        if key not in {'grass','blossom','rock'}:mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
        if key=='window':
            shader.inputs['Emission Color'].default_value=(1,.52,.12,1)
            shader.inputs['Emission Strength'].default_value=1.65
        rng=random.Random(SEED+index*53)
        for y in range(64):
            for x in range(64):
                grain=(rng.random()-.5)*.026
                if key=='blue':
                    row=y//12;seam=(y%12<1 or (x+row%2*8)%16<1)
                    grain+=-.075 if seam else .012*math.sin((y%12)/12*math.pi)
                elif key in {'ivory','stone','paving'}:
                    row=y//16
                    grain+=-.035 if y%16==0 or (x+(row%2)*16)%32==0 else .006
                elif key=='wood':grain+=math.sin(y*.30+math.sin(x*.17))*.022
                elif key=='grass':grain+=math.sin(x*.11+y*.08)*.014
                offset=(((index//4)*64+y)*256+(index%4)*64+x)*4
                pixels[offset:offset+4]=[max(0,min(1,c+grain)) for c in rgb]+[1]
    atlas.pixels.foreach_set(pixels);atlas.update();atlas.pack()
    return m


def ring(name,center,inner,outer,height,mat,segments=48):
    x,y,z=center;vertices=[]
    for r in [inner,outer]:
        vertices.extend((x+math.cos(i*math.tau/segments)*r,y+math.sin(i*math.tau/segments)*r,z) for i in range(segments))
    return mesh(name,vertices,[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)],mat)


def hollow_moulding(name,profile,segments,material,location):
    # Closed cross-section swept around a ring, with an actual open centre.
    vertices=[(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for r,z in profile for i in range(segments)]
    faces=[]
    for j in range(len(profile)):
        k=(j+1)%len(profile)
        for i in range(segments):
            n=(i+1)%segments;faces.append((j*segments+i,j*segments+n,k*segments+n,k*segments+i))
    return mesh(name,vertices,faces,material,location,smooth=True)


def paver_curve(m,points,width,tier):
    objects=[]
    for a,b in zip(points,points[1:]):
        delta=Vector(b)-Vector(a);length=delta.length
        count=max(1,round(length/(.46 if tier=='high' else .64)))
        for i in range(count):
            t=(i+.5)/count;p=Vector(a).lerp(Vector(b),t)
            block=box('Hand-set avenue limestone paver',(p.x,p.y,.305),(width,length/count-.025,.045),m['paving'],.012 if tier=='high' else 0)
            block.rotation_euler.z=-math.atan2(delta.x,delta.y);objects.append(block)
    return objects


def bench(m,location,rotation):
    objects=[]
    for i in range(4):objects.append(box('Park bench seat slat',(0,-.18+i*.12,.34),(1.04,.095,.065),m['wood'],.015))
    for z in [.55,.72]:objects.append(box('Park bench shaped back slat',(0,.23,z),(1.06,.065,.12),m['wood'],.02))
    for x in [-.42,.42]:
        objects.append(tube('Bench curved cast support',[(x,-.19,.02),(x,-.16,.33),(x,.22,.40),(x,.26,.79)],.035,m['gold'],5))
        objects.append(tube('Bench rolled arm',[(x,-.23,.43),(x,-.19,.56),(x,.12,.55)],.027,m['gold'],5))
    return transform_objects(objects,location,.8,rotation)


def flower_bed(m,center,radius,tier,seed):
    rng=random.Random(seed);x,y,z=center
    objects=[lathe('Dressed circular flowerbed curb',[(radius,0),(radius,.09),(radius-.08,.12)],20 if tier=='high' else 12,m['stone'],center)]
    count=9 if tier=='high' else 7 if tier=='balanced' else 5
    for i in range(count):
        a=i*2.399963;r=radius*.69*math.sqrt((i+.5)/count)
        p=(x+math.cos(a)*r,y+math.sin(a)*r,z+.14)
        objects.append(_cluster('Low clipped garden shrub',p,(.21,.19,.18),m['leaf'],'low',i%3,a))
        for j in range(3 if tier!='low' else 2):
            angle=a+j*math.tau/3;px=p[0]+math.cos(angle)*.13;py=p[1]+math.sin(angle)*.13
            vertices=[(px,py,p[2]+.22)]
            for k in range(10):
                theta=k*math.tau/10;rr=.09 if k%2==0 else .041
                vertices.append((px+math.cos(theta)*rr,py+math.sin(theta)*rr,p[2]+.22+.015*math.sin(theta*2)))
            objects.append(mesh('Five-petal royal garden flower',vertices,[(0,k+1,(k+1)%10+1) for k in range(10)],m['blossom'] if i%3 else m['purple']))
    return objects


def pine(m,position,scale,tier):
    objects=[lathe('Pine textured trunk',[(.10,0),(.07,1.75)],6,m['wood'])]
    for i in range(4):
        z=.38+i*.40;r=.68-i*.13
        objects.append(lathe('Pine swept layered bough',[(r*.85,z),(r,z+.10),(r*.74,z+.28),(.03,z+.87)],9 if tier=='low' else 12,m['leaf']))
    return transform_objects(objects,position,scale)


def castle(m,tier):
    base=generate_castle(m,'left',tier)
    # A real inhabited rear gallery, rather than the unwindowed back of a box.
    rear=[box('Rear gallery limestone chamber',(0,1.63,1.52),(2.65,1.18,2.12),m['ivory'],.055)]
    rear+=_gable_roof(m,2.90,1.52,.95,(0,1.63,2.58),'Rear garden gallery slate gable')
    for x in [-.79,0,.79]:rear+=_window(m,(x,2.235,1.03),.35,.86,math.pi,tier,'Rear garden gallery lancet')
    rear+=[box('Rear gallery supported balcony',(0,2.41,.83),(3.12,.58,.15),m['stone'],.035)]
    for x in [-1.4,-1.05,-.7,-.35,0,.35,.7,1.05,1.4]:rear.append(lathe('Rear balcony carved baluster',[(.04,0),(.06,.12),(.028,.36)],5,m['ivory'],(x,2.66,.91)))
    rear.append(box('Rear gallery gilt handrail',(0,2.66,1.29),(3.11,.08,.065),m['gold'],.01))
    for side in [-1,1]:
        rear+=_window(m,(side*2.03,1.365,1.20),.38,.87,math.pi,tier,'Rear wing upper lancet')
        rear+=_window(m,(side*2.925,.1,1.15),.38,.84,side*math.pi/2,tier,'Outer wing carved window')
        rear+=_window(m,(side*2.45,1.58,2.13),.29,.66,math.pi,tier,'Flanking tower rear lancet')
    for z in [3.77,5.22]:rear+=_window(m,(-.20,1.635,z),.34,.72,math.pi,tier,'High keep rear carved lancet')
    rear+=_window(m,(-.20,.105,5.22),.34,.72,0,tier,'High keep front gilded lancet')
    for side in [-1,1]:rear+=_window(m,(-.20+side*.765,.87,5.22),.30,.69,side*math.pi/2,tier,'High keep lateral lancet')
    rear+=_window(m,(0,2.409,2.68),.30,.49,math.pi,tier,'Rear gallery gable window')
    # Distinctive portal gable, gold ornaments and deep stone voussoirs.
    rear+=_gable_roof(m,2.65,.64,1.16,(0,-1.03,3.94),'Great entrance pediment')
    for side in [-1,1]:
        for z in [.90,1.40,1.90,2.40,2.90,3.40]:rear.append(box('Portal dressed quoin',(side*1.38,-1.21,z),(.23,.16,.23),m['stone'],.018))
    for step in range(6):
        y=-1.90-step*.20;z=.31-step*.047
        rear.append(box('Grand entrance stair tread',(0,y,z),(2.3+step*.22,.27,.10),m['paving'],.018))
        rear.append(box('Ceremonial burgundy stair runner',(0,y,z+.053),(.86,.25,.009),m['red'],0))
        for side in [-1,1]:rear.append(box('Runner gold woven edge',(side*.425,y,z+.06),(.023,.25,.01),m['gold'],0))
    for x in [-1.46,1.46]:rear+=_heraldry(m,(x,-1.33,2.58))
    objects=transform_objects(base+rear,(0,3.02,.32),1.05)
    # Broader supporting terrace, open side railings and a real rear access walk.
    objects.append(box('Castle dressed limestone garden foundation',(0,3.05,.37),(8.5,5.75,.26),m['stone'],.09))
    for side in [-1,1]:
        for i in range(8):objects.append(lathe('Terrace shaped baluster',[(.055,0),(.077,.14),(.037,.40)],6,m['ivory'],(side*4.02,.66+i*.63,.51)))
        objects.append(box('Terrace side coping',(side*4.02,2.88,.94),(.12,5.0,.10),m['ivory'],.02))
    return objects


def houses(m,tier):
    objects=[]
    for index,(x,y,variant,rotation) in enumerate([(-5.15,-.30,'cafe',-.12),(5.15,-.30,'boutique',.12),(-4.85,-5.10,'cottage',-.15),(4.85,-5.10,'townhouse',.15)]):
        parts=generate_house(m,variant,tier)
        for obj in list(parts):
            if 'Cafe sweeping awning' in obj.name or 'Cafe gold awning edge' in obj.name or (index==0 and any(key in obj.name for key in ['pitched slate roof','gold ridge cap','gable bargeboard','roof tile seam'])):
                parts.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
        if index==0:
            # A crafted burgundy mansard distinguishes the café from the
            # three blue pitched cottages, without adding another material.
            vertices=[(sx*w,sy*d,z) for w,d,z in [(1.0,.87,2.18),(.65,.57,2.79),(.43,.38,3.08)] for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            faces=[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i) for j in range(2) for i in range(4)]+[(8,9,10,11)]
            parts.append(mesh('Cafe shaped burgundy mansard roof',vertices,faces,m['red']))
            parts.append(box('Cafe mansard gilt ridge',(0,0,3.10),(.90,.055,.055),m['gold'],.01))
            parts.append(box('Cafe dormer stone chamber',(0,-.74,2.48),(.55,.36,.51),m['ivory'],.025))
            parts+=_gable_roof(m,.64,.46,.33,(0,-.74,2.72),'Cafe dormer blue slate')
            parts+=_window(m,(0,-.94,2.29),.28,.45,0,tier,'Cafe mansard arched dormer')
        # Complete rear façade and stone foundation details on each small house.
        parts+=_window(m,(0,.71,.77),.33,.69,math.pi,tier,'Townhouse garden-facing window')
        if index!=1:
            for i in range(7):
                stripe=mesh('Shop striped canvas awning',[(-.76+i*.215,-.76,1.39),(-.76+(i+1)*.215,-.76,1.39),(-.76+(i+1)*.215,-1.11,1.16),(-.76+i*.215,-1.11,1.16)],[(0,1,2,3)],m['cream'] if i%2 else m['red'] if index==0 else m['blue'])
                parts.append(stripe)
        objects+=transform_objects(parts,(x,y,.32),1.02,rotation)
    return objects


def fountain(m,tier):
    objects=[];center=(0,-2.85,.30)
    sides=48 if tier=='high' else 36 if tier=='balanced' else 24
    for r,z in [(1.42,0),(1.33,.12),(1.23,.24)]:objects.append(lathe('Royal fountain stepped octagonal plinth',[(r,z),(r,z+.11)],sides,m['stone'],center))
    objects.append(lathe('Lower basin sculpted limestone wall',[(1.21,.31),(1.27,.36),(1.25,.50),(1.10,.53),(1.08,.41)],sides,m['ivory'],center))
    objects.append(lathe('Fountain turned pedestal',[(.28,.35),(.33,.46),(.19,.63),(.13,1.02),(.32,1.10)],sides//2,m['stone'],center))
    objects.append(lathe('Upper basin carved rim',[(.63,1.03),(.70,1.12),(.69,1.22),(.57,1.25),(.54,1.14)],sides,m['ivory'],center))
    objects.append(lathe('Crown fountain central column',[(.14,1.15),(.19,1.29),(.10,1.55),(.27,1.62)],sides//2,m['gold'],center))
    objects.append(lathe('Crown fountain top tazza',[(.38,1.59),(.44,1.69),(.43,1.77),(.34,1.79),(.30,1.66)],sides,m['ivory'],center))
    for r,z in [(1.27,.47),(.70,1.17),(.44,1.73)]:objects.append(hollow_moulding('Fountain open gilded basin lip',[(r-.012,z),(r+.014,z+.018),(r-.012,z+.04)],sides,m['gold'],center))
    return objects


def landscape(m,tier):
    objects=[box('Central district original footprint stone plinth',(0,0,-.10),(15.3,15.3,.54),m['rock'],.09),
      box('Royal garden continuous meadow',(0,0,.22),(15.0,15.0,.12),m['grass'],.10)]
    # Open circular promenade and hand-set radial stones frame the fountain.
    objects.append(ring('Circular plaza warm limestone paving',(0,-2.85,.293),1.38,2.18,.02,m['paving']))
    objects.append(ring('Plaza narrow gilded compass border',(0,-2.85,.299),2.12,2.145,.01,m['gold']))
    count=48 if tier=='high' else 36 if tier=='balanced' else 24
    for i in range(count):
        a=i*math.tau/count;mid=1.76
        p=box('Radial plaza individual limestone sett',(math.cos(a)*mid,-2.85+math.sin(a)*mid,.306),(.36,.16,.035),m['cream'] if i%3 else m['stone'],.009 if tier=='high' else 0)
        p.rotation_euler.z=a;objects.append(p)
    for points,width in [([(0,.1),(0,-.40)],1.85),([(-5.15,-.55),(-2.0,-1.7)],.85),([(5.15,-.55),(2,-1.7)],.85),([(-5.0,-5.1),(-2.0,-4)],.85),([(5,-5.1),(2,-4)],.85),([(-5.4,-6.25),(5.4,-6.25)],.90)]:
        objects+=paver_curve(m,points,width,tier)
    # Sakura on these lawns are placed by the game from the shared GLBs.
    for side in [-1,1]:
        for x,y,scale in [(3.0,-.75,.80),(2.75,-4.6,.72),(6.8,4.7,.70)]:objects+=pine(m,(side*x,y,.30),scale,tier)
        for x,y,r in [(2.6,-1.1,.55),(2.75,-4.6,.58),(1.0,-5.5,.45),(5.1,1.5,.49),(5.2,-3.2,.46)]:objects+=flower_bed(m,(side*x,y,.30),r,tier,SEED+int(x*9-y*7))
        for y in [-1.8,-2.6,-3.4]:objects+=generate_shrub(m,origin=(side*3.0,y,.31),scale=.57,detail='low',seed=int(y*10)%91)
        for x,y,rot in [(2.43,-2.5,side*math.pi/2),(2.0,-5.7,0)]:objects+=bench(m,(side*x,y,.31),rot)
        objects+=generate_garden_rocks(m,(side*6.6,-4.0,.30),.65)
    objects+=generate_pavilion(m,tier,(5.9,5.65,.30),.61)
    # A real open rose arbor on the south approach, never a solid doorway slab.
    objects.append(arch('South garden open rose arbor',1.20,1.75,.26,(0,-5.95,.31),m['stone'],.11,12))
    objects.append(arch('Rose arbor gold inner lining',1.02,1.68,.08,(0,-6.11,.31),m['gold'],.025,12))
    for side in [-1,1]:
        objects+=generate_shrub(m,(side*.72,-5.95,.31),.63,True,'low',SEED+int(side))
    return objects


def progression(m,tier):
    result={level:[] for level in range(2,6)}
    for side in [-1,1]:
        result[2]+=_tower(m,(side*2.8,5.60,.52),.43,4.05,1.58,tier,'Royal level two rear watchtower')
        result[3]+=_tower(m,(side*3.65,.68,.52),.27,1.75,.92,tier,'Royal level three terrace turret')
    for y,rotation in [(1.55,0),(4.78,math.pi)]:
        parts=[lathe('Royal clock ivory dial',[(.32,0),(.32,.045)],24,m['cream'])]
        # Clock face is a vertical XY circle after rotating from Blender Z-up.
        for o in parts:o.rotation_euler.x=math.pi/2
        parts.append(tube('Royal clock gilt minute hand',[(0,-.055,0),(0,-.055,.22)],.018,m['gold'],4))
        parts.append(tube('Royal clock gilt hour hand',[(0,-.055,0),(.14,-.055,.08)],.021,m['gold'],4))
        result[4]+=transform_objects(parts,(0,y,4.25),1,rotation)
    result[5]+=[lathe('Level five sovereign crown rim',[(.22,0),(.28,.08),(.25,.15)],16,m['gold'],(0,-2.85,2.13))]
    for i in range(5):
        a=i*math.tau/5
        result[5].append(tube('Level five crown raised point',[(math.cos(a)*.23,-2.85+math.sin(a)*.23,2.22),(math.cos(a)*.28,-2.85+math.sin(a)*.28,2.48)],.035,m['gold'],5))
    return result


def lighting_and_flags(m,groups,tier):
    anchors=[]
    for level,objects in groups.items():
        for obj in list(objects):
            if 'royal pennant' not in obj.name:continue
            anchor=bpy.data.objects.new(f'city_flag_level_{level}_{len(anchors)}',None);bpy.context.collection.objects.link(anchor)
            anchor.location=obj.location;anchor.rotation_euler=obj.rotation_euler;anchor.scale=obj.scale
            anchor['unlock_level']=level;anchor['role']='effect-anchor';anchor['city_effect']='flag'
            anchor['flag_scale']=float(obj.scale.x);anchor.scale=(1,1,1);anchors.append(anchor)
            objects.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
    for i,(x,y,scale) in enumerate([(-1.8,.0,.55),(1.8,.0,.55),(-2.1,-2.85,.55),(2.1,-2.85,.55),(-3.5,-5.7,.55),(3.5,-5.7,.55),(-5.5,1.4,.52),(5.5,1.4,.52),(-1,-6.6,.46),(1,-6.6,.46)]):
        groups[1]+=generate_lantern(m,tier,(x,y,.31),scale)
        anchor=bpy.data.objects.new(f'city_lantern_{i}',None);bpy.context.collection.objects.link(anchor)
        anchor.location=(x,y,.31+scale*1.51);anchor['role']='effect-anchor';anchor['city_effect']='lantern';anchor['radius']=scale*.33;anchors.append(anchor)
    for name,position in [('fountain',(0,-2.85,.30)),('spire',(-.21,3.93,9.72))]:
        anchor=bpy.data.objects.new('city_'+name,None);bpy.context.collection.objects.link(anchor);anchor.location=position;anchor['role']='effect-anchor';anchor['city_effect']=name;anchors.append(anchor)
    return anchors


def bake_contacts(groups,m):
    # Tree lobes share authoring geometry. Bake each placed object independently.
    for objects in groups.values():
        for obj in objects:
            if obj.data.users>1:obj.data=obj.data.copy()
    bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
    vertices=[];faces=[]
    for obj in groups[1]:
        evaluated=obj.evaluated_get(graph);data=evaluated.to_mesh();offset=len(vertices)
        vertices.extend(obj.matrix_world@v.co for v in data.vertices);faces.extend(tuple(offset+i for i in p.vertices) for p in data.polygons);evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(vertices,faces);sun=Vector((-.48,-.56,.72)).normalized()
    for objects in groups.values():
        for obj in objects:
            data=obj.data;color=data.color_attributes.get('Color')
            if not color:color=data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER');color.data.foreach_set('color',[1.,1.,1.,1.]*len(color.data))
            data.color_attributes.active_color=color;mat=data.materials[0]
            if mat==m['window']:continue
            normal_matrix=obj.matrix_world.to_3x3().inverted().transposed();factors=[]
            for v in data.vertices:
                normal=(normal_matrix@v.normal).normalized();p=obj.matrix_world@v.co+normal*.024
                blocked=tree.ray_cast(p+sun*.015,sun,20)[0] is not None
                ao=sum(tree.ray_cast(p,ray.normalized(),.95)[0] is not None for ray in [normal+Vector((.4,.3,.6)),normal+Vector((-.3,-.4,.6))])
                shade=(.10 if mat==m['blossom'] else .20 if mat==m['leaf'] else .35 if mat==m['grass'] else .18)
                factors.append((1-shade*blocked)*(1-ao*(.04 if mat==m['blossom'] else .075)))
            for loop in data.loops:
                old=color.data[loop.index].color;f=factors[loop.vertex_index]
                color.data[loop.index].color=tuple(max(0,min(1,c*f)) for c in old[:3])+(1,)


def export(groups,anchors,tier):
    bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();batches=[];triangles=0;points=[];level_counts={}
    for level,objects in groups.items():
        staging=[]
        for source in objects:
            evaluated=source.evaluated_get(graph);data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=graph)
            data.transform(source.matrix_world)
            for layer in list(data.uv_layers):
                if layer.name!='SurfaceUV':data.uv_layers.remove(layer)
            color=data.color_attributes.get('Color');data.color_attributes.active_color=color
            obj=bpy.data.objects.new('City staging',data);bpy.context.collection.objects.link(obj);staging.append(obj)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in staging:obj.select_set(True)
        bpy.context.view_layer.objects.active=staging[0];bpy.ops.object.join();batch=bpy.context.object
        batch.name=f'city_level_{level}';batch['unlock_level']=level;batch['role']='central-city';batch['seed']=SEED
        batch.data.calc_loop_triangles();count=len(batch.data.loop_triangles);triangles+=count;level_counts[str(level)]=count
        points.extend(v.co.copy() for v in batch.data.vertices);batches.append(batch)
    assert triangles<=BUDGET[tier],f'{tier}: {triangles} exceeds {BUDGET[tier]}'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in batches+anchors:obj.select_set(True)
    OUT.mkdir(parents=True,exist_ok=True);file='central-royal-district'+('' if tier=='high' else '-'+tier)+'.glb';path=OUT/file
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_extras=True,
      export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',export_image_format='AUTO',export_texcoords=True,
      export_normals=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    record={'id':'central-royal-district','file':file,'tier':tier,'triangles':triangles,'triangleBudget':BUDGET[tier],
      'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'levelTriangles':level_counts,
      'bounds':{'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]},'origin':[0,0,0],
      'anchors':{o.name:[round(o.location.x,6),round(o.location.z,6),round(-o.location.y,6)] for o in anchors}}
    print(json.dumps(record),flush=True);return record


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--tiers',default='high,balanced,low')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);records=[]
    for tier in args.tiers.split(','):
        if tier not in BUDGET:raise ValueError('Unknown quality tier')
        reset_scene();m=city_materials();groups={1:landscape(m,tier)+castle(m,tier)+houses(m,tier)+fountain(m,tier),**progression(m,tier)}
        anchors=lighting_and_flags(m,groups,tier);bake_contacts(groups,m);records.append(export(groups,anchors,tier))
    path=OUT/'manifest.json'
    if path.is_file():
        existing={a['tier']:a for a in json.loads(path.read_text(encoding='utf-8'))['assets']};existing.update({a['tier']:a for a in records});records=list(existing.values())
    sources=['core.py','generate_castles.py','generate_villages.py','generate_vegetation.py','generate_gardens.py','generate_lanterns.py','generate_central_city.py']
    path.write_text(json.dumps({'schemaVersion':1,'generator':'tools/blender/generate_central_city.py','blenderVersion':bpy.app.version_string,
      'seed':SEED,'license':'Original project assets; repository MIT license','units':'metres; glTF Y-up; front +Z',
      'sourceHashNormalization':'UTF-8 with LF line endings',
      'sourceHashes':{f:hashlib.sha256((HERE/f).read_text(encoding='utf-8').encode('utf-8')).hexdigest() for f in sources},'assets':records},indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':main()
