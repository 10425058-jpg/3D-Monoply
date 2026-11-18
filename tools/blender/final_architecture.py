"""Offline architectural craft pass for the surrounding floating kingdom.

The imported source keeps its footprints, apertures and effect anchors. New
overlapping slate tiles, load-bearing buttresses, dressed masonry, deeply
profiled tower crowns and entrance stonework provide readable geometric relief.
All parts use the project's ten shared atlas materials, joined at GLB export.
"""
import math

from core import box, mesh, lathe, arch, tube, transform_objects
from generate_castles import _window


def _tint_tiles(obj, tones):
    data = obj.data
    color = data.color_attributes.get('Color')
    if color is None:
        color = data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    data.color_attributes.active_color = color
    for polygon, tone in zip(data.polygons, tones):
        for loop_index in polygon.loop_indices:
            color.data[loop_index].color = (tone * .95, tone, min(1, tone * 1.06), 1)
    return obj


def _spire_tiles(materials, radius, height, location, tier):
    """Staggered slate plates with a scalloped lower edge and real thickness.

    The existing swept shell is retained beneath the open joints, so a tile gap
    always resolves as blue slate rather than sky. The plate rhythm is coarse
    enough to survive the gameplay view, unlike a fine painted shingle texture.
    """
    columns = {'high': 14, 'balanced': 12, 'low': 9}[tier]
    rows = {'high': 6, 'balanced': 5, 'low': 3}[tier]
    vertices, faces, tones = [], [], []

    def surface(t, angle, lift=0):
        r = radius * max(.012, (1-t) ** .87) * (1 - math.sin(t*math.pi)*.11)
        r += .022 + lift
        return (math.cos(angle)*r, math.sin(angle)*r, .18+height*t)

    for row in range(rows):
        t0 = row * .90 / rows + .012
        t1 = min(.96, (row+1) * .90 / rows + .04)
        for column in range(columns):
            angle = (column + (row % 2)*.5) * math.tau/columns
            half = math.pi/columns * .955
            # Six-vertex tile: the lower central lobe projects just below the
            # seam and catches a soft highlight, while the upper edge tucks in.
            n = len(vertices)
            vertices.extend([
                surface(t0, angle-half, .018),
                surface(max(.002, t0-.022), angle, .035),
                surface(t0, angle+half, .018),
                surface(t1, angle+half, 0),
                surface(t1, angle-half, 0),
                surface(t0+.012, angle, -.012),
            ])
            faces.extend([(n,n+1,n+2,n+3,n+4), (n+2,n+1,n+5), (n+1,n,n+5)])
            tone = [.82, .91, .99, .87, .95][(column*7+row*3) % 5]
            tones.extend([tone, tone*.78, tone*.80])
    obj = mesh('Final kingdom individually staggered scallop slates', vertices, faces, materials['blue'], location)
    return [_tint_tiles(obj, tones)]


def _tower_craft(materials, location, radius, height, roof_height, tier):
    # The authored source already closes the shaft and roof. These additions
    # need only their visible side profiles: cap fans would be wholly buried.
    segments = {'high': 12, 'balanced': 10, 'low': 8}[tier]
    x,y,z = location
    parts = _spire_tiles(materials, radius*1.07, roof_height, (x,y,z+height), tier)
    # A bold, shadow-separated cornice makes the roof structurally supported.
    profile = [(radius*1.04,height-.50), (radius*1.21,height-.34),
               (radius*1.21,height-.24), (radius*1.16,height+.025)]
    def visible_profile(name, contour, material, origin):
        part=lathe(name,contour,segments,material,origin)
        data=part.data
        coordinates=[tuple(v.co) for v in data.vertices]
        faces=[tuple(poly.vertices) for poly in data.polygons[:-2]]
        data.clear_geometry();data.from_pydata(coordinates,[],faces);data.update()
        for poly in data.polygons:poly.use_smooth=True
        return part
    parts.append(visible_profile('Final kingdom deeply profiled tower crown', profile, materials['stone'], location))
    parts.append(visible_profile('Final kingdom blue shadow beneath tower crown',
        [(radius*1.075,height-.47),(radius*1.075,height-.425)], materials['blue'], location))
    # Light corbels under broad eaves articulate cylindrical silhouettes.
    count = 8 if tier == 'high' else 6 if tier == 'balanced' else 4
    for i in range(count):
        angle = i*math.tau/count
        point = (x+math.cos(angle)*radius*1.025,y+math.sin(angle)*radius*1.025,z+height-.49)
        corbel = box('Final kingdom eaves carved corbel', point,
            (radius*.22,radius*.24,.29), materials['ivory'], 0)
        corbel.rotation_euler.z=angle
        parts.append(corbel)
    # Fine gold is reserved for one roof edge, keeping a consistent hierarchy.
    parts.append(visible_profile('Final kingdom gilt swept drip edge',
        [(radius*1.31,.025),(radius*1.28,.06)],
        materials['gold'], (x,y,z+height)))
    return parts


def _pitched_tiles(materials, width, depth, height, location, tier, swept=True):
    """Real transverse slate rows on the prominent nave or hip front pitch."""
    rows = {'high':7,'balanced':5,'low':3}[tier]
    columns = {'high':10,'balanced':7,'low':5}[tier]
    vertices,faces,tones=[],[],[]
    w,d=width*.5,depth*.5
    for side in (-1,1):
        for row in range(rows):
            t0=row/rows
            t1=min(.98,(row+1.12)/rows)
            for col in range(columns):
                # Gabled nave slopes inward in X; Y is the ridge direction.
                v0=-d+(col+(row%2)*.3)*depth/columns
                v1=min(d,v0+depth/columns*.95)
                if v0>=d:continue
                def at(t,v,down=0):
                    if swept:
                        if t < .26: factor=1.08-(t/.26)*.20
                        elif t < .72: factor=.88-((t-.26)/.46)*.40
                        else: factor=.48*(1-(t-.72)/.28)
                    else: factor=1-t
                    return (side*w*factor+side*.025,
                            v, height*t+.025+down)
                n=len(vertices)
                vertices += [at(t0,v0),at(t0,v1),at(t1,v1),at(t1,v0),at(t0,v0,-.045),at(t0,v1,-.045)]
                tile_faces=[(n,n+1,n+2,n+3),(n+4,n+5,n+1,n)]
                faces += [tuple(reversed(face)) if side < 0 else face for face in tile_faces]
                tone=[.86,.95,.80,.91,.99][(col*3+row*7+(0 if side<0 else 2))%5]
                tones += [tone,tone*.78]
    return [_tint_tiles(mesh('Final kingdom overlapping nave slate plates',vertices,faces,materials['blue'],location),tones)]


def _rose_window(materials, location, radius=.22, tier='high'):
    """A recessed radial window, surrounded by a carved concentric stone ring."""
    segments = 16 if tier=='high' else 12
    x,y,z=location
    parts=[]
    # Lathe axis is Z; turn toward the semantic front (-Y).
    for name,profile,material in [
        ('Final kingdom rose window dark reveal',[(0,0),(radius*1.07,0),(radius*1.07,.025)],materials['rock']),
        ('Final kingdom rose window amber glass',[(0,0),(radius*.88,0),(radius*.88,.025)],materials['window']),
        ('Final kingdom rose window carved surround',[(radius*.95,0),(radius*1.17,0),(radius*1.24,.035),(radius*1.16,.085),(radius*.95,.085)],materials['stone']),
    ]:
        part=lathe(name,profile,segments,material,(x,y,z))
        if 'surround' in name:
            # The core lathe closes its ends with filled caps. A tracery ring
            # needs an actual aperture, so remove just those two cap polygons.
            data=part.data
            kept=[tuple(poly.vertices) for poly in data.polygons[:-2]]
            coordinates=[tuple(vertex.co) for vertex in data.vertices]
            data.clear_geometry();data.from_pydata(coordinates,[],kept);data.update()
        if 'glass' in name: part.location.y-=.035
        part.rotation_euler.x=math.pi/2
        parts.append(part)
    spokes=8 if tier!='low' else 4
    for i in range(spokes):
        angle=i*math.tau/spokes
        parts.append(tube('Final kingdom rose window radial tracery',
            [(x,y-.07,z),(x+math.cos(angle)*radius*.86,y-.07,z+math.sin(angle)*radius*.86)],.017,materials['gold'],sides=4))
    return parts


def _hip_tiles(materials,width,depth,height,location,tier):
    """Cover the exact four authored hip pitches, including triangular ends.

    The existing main left roof and both wing roofs use a ridge of 0.34 times
    their width. Treating them as gables puts most plates inside the shell;
    these bilinear sections match the original corner/ridge vertices exactly.
    """
    rows={'high':5,'balanced':4,'low':3}[tier]
    columns={'high':7,'balanced':6,'low':4}[tier]
    vertices,faces,tones=[],[],[]
    w,d=width*.5,depth*.5

    def tile(points,normal,tone,reverse=False):
        # Four exposed faces are enough. The buried upper/back faces are
        # provided by the original opaque shell and need no duplicate topology.
        n=len(vertices)
        offset=tuple(v*.037 for v in normal)
        vertices.extend(tuple(p[i]+offset[i] for i in range(3)) for p in points)
        vertices.extend(tuple(points[j][i]+offset[i]*.18 for i in range(3)) for j in (0,1))
        tile_faces=[(n,n+1,n+2,n+3),(n+4,n+5,n+1,n)]
        faces.extend(tuple(reversed(face)) if reverse else face for face in tile_faces)
        tones.extend([tone,tone*.77])

    for front in (-1,1):
        length=math.hypot(height,d)
        normal=(0,front*height/length,d/length)
        for row in range(rows):
            t0=row/rows+.005
            t1=min(.995,(row+1.1)/rows)
            span0=w*(1-.66*t0)
            span1=w*(1-.66*t1)
            for col in range(columns):
                u0=col/columns+.012
                u1=(col+.96)/columns
                points=[((u0*2-1)*span0,front*d*(1-t0),height*t0),
                        ((u1*2-1)*span0,front*d*(1-t0),height*t0),
                        ((u1*2-1)*span1,front*d*(1-t1),height*t1),
                        ((u0*2-1)*span1,front*d*(1-t1),height*t1)]
                tile(points,normal,[.82,.91,.98,.87,.95][(col*3+row*2)%5],reverse=front>0)
    # The triangular short ends converge at the ends of the ridge. A small
    # fixed number of coarse plates avoids tiny triangles at their apex.
    end_columns=max(3,columns-2)
    for side in (-1,1):
        length=math.hypot(height,w*.66)
        normal=(side*height/length,0,w*.66/length)
        for row in range(rows):
            t0=row/rows+.005
            t1=min(.975,(row+1.08)/rows)
            for col in range(end_columns):
                u0=col/end_columns+.012
                u1=(col+.96)/end_columns
                points=[(side*w*(1-.66*t0),(u0*2-1)*d*(1-t0),height*t0),
                        (side*w*(1-.66*t0),(u1*2-1)*d*(1-t0),height*t0),
                        (side*w*(1-.66*t1),(u1*2-1)*d*(1-t1),height*t1),
                        (side*w*(1-.66*t1),(u0*2-1)*d*(1-t1),height*t1)]
                tile(points,normal,[.94,.85,.98,.89,.92][(col*7+row*3)%5],reverse=side<0)
    return [_tint_tiles(mesh('Final kingdom all four hipped slate pitches',vertices,faces,materials['blue'],location),tones)]


def _gable_frame(materials,width,depth,height,location):
    x,y,z=location
    w=width*.5
    profile=[(-w*1.08,0),(-w*.88,height*.26),(-w*.48,height*.72),(0,height),
             (w*.48,height*.72),(w*.88,height*.26),(w*1.08,0)]
    return [tube('Final kingdom dormer carved stone verge',
        [(x+px,y-depth*.5-.05,z+pz-.025) for px,pz in profile],.045,materials['ivory'],sides=4)]


def _castle_facade(materials,tier,variant):
    parts=[]
    # Load-bearing corners step inward as they rise. The chunky lower stones
    # ground the main hall; their bevels produce real highlight and contact AO.
    for side in (-1,1):
        for i,(z,w,d,h) in enumerate(((.70,.42,.52,.56),(1.29,.34,.44,.59),(1.91,.28,.35,.61),(2.54,.23,.28,.62))):
            parts.append(box('Final kingdom stepped gatehouse buttress',
                (side*1.49,-1.17,z),(w,d,h),materials['stone' if i%2==0 else 'ivory'],.035))
        parts.append(box('Final kingdom buttress sloped capital',(side*1.49,-1.16,2.91),(.33,.38,.16),materials['stone'],.035))
        if variant=='right' and side==-1:
            # The right palace deliberately has an open gallery instead of a
            # solid west wing. Its smaller swept gable needs its own section.
            parts += _pitched_tiles(materials,1.95,2.20,1.18,(-2.03,.30,2.61),tier)
            parts += _gable_frame(materials,1.95,2.20,1.18,(-2.03,.30,2.61))
        else:
            # Dressed stringcourses and a recessed band add scale to blank wings.
            for z in (.85,1.86):
                parts.append(box('Final kingdom wing dressed stone belt',
                    (side*2.03,-1.052,z),(1.67,.075,.09),materials['stone'],0))
            # Exposed wing sides previously had uninterrupted pale planes.
            # Recesses and pilasters lend the all-orbit facade real depth.
            parts += _window(materials,(side*2.93,.18,1.15),.40,.90,
                rotation=-side*math.pi/2,detail='balanced' if tier!='low' else 'low',
                name='Final kingdom wing side recessed lancet')
            for y in (-.86,1.14):
                parts.append(box('Final kingdom wing side structural pilaster',
                    (side*2.93,y,1.53),(.14,.16,1.72),materials['stone'],0))
            parts += _hip_tiles(materials,2.05,2.7,.87,(side*2.03,.15,2.74),tier)
    # Recessed arch with a more substantial outer profile and a clear keystone.
    parts.append(arch('Final kingdom entrance outer recessed archivolt',
        1.70,2.88,.22,(0,-1.43,.36),materials['ivory'],.11,12 if tier=='high' else 8))
    parts.append(box('Final kingdom entrance carved keystone',(0,-1.57,3.34),(.27,.20,.26),materials['stone'],.035))
    # Express short stone blocks around the outer arch instead of surface noise.
    count=9 if tier=='high' else 7 if tier=='balanced' else 5
    radius=.94;spring=.36+2.88-.85
    for i in range(count):
        angle=(i+.5)*math.pi/count
        brick=box('Final kingdom radial entrance voussoir',
            (math.cos(angle)*radius,-1.555,spring+math.sin(angle)*radius),
            (.23,.12,.13),materials['stone'],0)
        brick.rotation_euler.y=math.pi/2-angle
        parts.append(brick)
    # Wide, articulated stair coping and pedestals frame the existing stair.
    for side in (-1,1):
        parts.append(box('Final kingdom porch coping',(side*1.35,-2.15,.51),(.22,1.18,.13),materials['ivory'],.025))
        parts.append(box('Final kingdom porch pier plinth',(side*1.35,-2.69,.29),(.40,.42,.35),materials['stone'],.03))
        parts.append(box('Final kingdom porch pier cap',(side*1.35,-2.69,.51),(.47,.48,.12),materials['ivory'],.025))
    if variant=='right':
        parts += _pitched_tiles(materials,3.1,2.8,1.72,(0,.12,4.4),tier)
        parts += _gable_frame(materials,3.1,2.8,1.72,(0,.12,4.4))
        parts += _rose_window(materials,(0,-1.326,5.25),.23,tier)
    else:
        # Keep the existing hipped roof; model its front-facing slate rows.
        # Local profile for the little entrance dormer uses the same language.
        parts += _pitched_tiles(materials,1.20,.48,.90,(0,-1.28,3.96),tier)
        parts += _hip_tiles(materials,3.1,2.8,1.1,(0,.12,4.4),tier)
        parts += _gable_frame(materials,1.20,.48,.90,(0,-1.28,3.96))
        parts += _rose_window(materials,(0,-1.545,4.32),.16,tier)
    return parts


def _castle(materials,tier,variant,origin,scale):
    parts=_castle_facade(materials,tier,variant)
    right=variant=='right'
    central=(1.30,1.20,.42) if right else (-.20,.87,.42)
    parts += _tower_craft(materials,central,.74,5.90 if right else 5.85,2.15 if right else 1.85,tier)
    for side in (-1,1):
        h=3.55+(side*.28 if right else 0)
        if not right or side==-1:
            parts += _tower_craft(materials,(side*2.45,.95,.39),.61,h,1.45,tier)
        if not right or side==1:
            parts += _tower_craft(materials,(side*1.32,-1,.39),.43,3.25 if right else 2.75,1.32 if right else 1.15,tier)
    return transform_objects(parts,origin,scale)


def _garden_craft(materials,tier):
    parts=[]
    # Existing three-bay belvedere gains continuous architrave, proper paired
    # piers, a recessed frieze and decorative crest, retaining open arch spans.
    parts.append(box('Final kingdom belvedere continuous architrave',(0,1.40,4.20),(8.55,.62,.19),materials['stone'],.035))
    parts.append(box('Final kingdom belvedere blue inset frieze',(0,1.40,4.35),(8.40,.55,.10),materials['blue'],.015))
    parts.append(box('Final kingdom belvedere upper cornice',(0,1.40,4.46),(8.72,.73,.13),materials['ivory'],.025))
    for x in (-4.20,-1.45,1.45,4.20):
        parts.append(box('Final kingdom belvedere pier plinth',(x,1.40,.27),(.62,.74,.34),materials['stone'],.04))
        parts.append(box('Final kingdom belvedere pier foot',(x,1.40,.50),(.49,.62,.12),materials['ivory'],.025))
        if tier!='low':
            parts.append(box('Final kingdom belvedere front pilaster',(x,1.12,1.75),(.17,.10,2.46),materials['stone'],.018))
        parts.append(lathe('Final kingdom belvedere golden acorn',[(.14,0),(.18,.12),(.10,.30),(0,.45)],8,materials['gold'],(x,1.40,4.54)))
    return parts


def _mill_craft(materials,tier):
    parts=_pitched_tiles(materials,2.35,2.2,1.35,(-1,1,4.15),tier)
    # Broad lower foundation and thin diminishing stringcourses preserve the
    # tapered windmill's clean silhouette while lending a masonry scale.
    for radius,z in ((1.28,.18),(1.18,.61),(1.01,2.06),(.93,3.34)):
        parts.append(lathe('Final kingdom windmill dressed masonry course',
            [(radius,z-.055),(radius+.05,z),(radius,z+.055)],16 if tier=='high' else 12,
            materials['stone'],(-1,1,0)))
    for side in (-1,1):
        parts.append(box('Final kingdom windmill door jamb',(-1+side*.39,-.13,1.55),(.14,.22,1.09),materials['stone'],.025))
    return parts


def apply_architecture(objects,materials,tier,asset_id):
    """Return new geometry and audit counts; sources/roots stay untouched."""
    sites={
        'royal-island-left':('left',(-.65,1.15,.16),.9),
        'royal-island-right':('right',(1,1,.88),.9),
        'royal-island-citadel':('left',(-.2,1,.2),1.1),
    }
    if asset_id in sites:
        variant,origin,scale=sites[asset_id]
        additions=_castle(materials,tier,variant,origin,scale)
        if asset_id=='royal-island-citadel':
            for x,y,h,r in ((-3.8,2.4,5.9,.62),(3.5,2,6.9,.65),(.7,3,8.6,.60)):
                additions += _tower_craft(materials,(x,y,.12),r,h,2,tier)
    elif asset_id=='sky-garden':
        additions=_garden_craft(materials,tier)
    elif asset_id=='sky-windmill':
        additions=_mill_craft(materials,tier)
    else:
        return [],{'architectureParts':0,'slateTiles':0}
    tiles=sum(len(part.data.polygons)//3 for part in additions if 'scallop slates' in part.name)
    return additions,{'architectureParts':len(additions),'slateTiles':tiles,
        'architecturalTreatment':'individually staggered slate plates, structural cornices, carved entrance and dressed masonry'}
