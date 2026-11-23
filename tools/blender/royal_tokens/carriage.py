"""A hollow coach with arched openings, swept roof ribs and cast wheel petals."""

import math
from math import cos, pi, sin

import bmesh
import bpy
from mathutils import Vector

from sculpt import BLUE, BRASS, GEM, GOLD, IVORY, LAMP, NAVY, SEAT, VELVET, X, Y, Z, curve, select


COACH = [
    (0,0,.56,.510,.745), (0,0,.62,.657,.895), (0,0,.76,.725,.947),
    (0,0,1.02,.764,.987), (0,0,1.33,.783,1.005), (0,0,1.65,.791,1.001),
    (0,0,1.93,.761,.976), (0,0,2.16,.700,.899), (0,0,2.226,.649,.826),
]


def sign_power(value, exponent):
    return math.copysign(abs(value)**exponent, value)


def wall_depth(u,z,front):
    for a, b in zip(COACH,COACH[1:]):
        if z <= b[2]:
            break
    factor = max(0,min(1,(z-a[2])/(b[2]-a[2])))
    a_width = a[3] + factor*(b[3]-a[3])
    a_length = a[4] + factor*(b[4]-a[4])
    across, deep = (a_width,a_length) if front else (a_length,a_width)
    return deep * max(.0001,1-(abs(u)/across)**(2/.60))**.30


def facade(u, z, front, s, inset=0):
    depth = (wall_depth(u,z,front) + inset)*s
    return Vector((u,depth,z) if front else (depth,u,z))


def hollow_cabin(sculpt):
    shell = sculpt.sectional("Porcelain coach body", COACH, IVORY, exponent=.60,
                             sides=96 if sculpt.master else 56)
    inner = sculpt.sectional("Hollow cabin cutter", [
        (0,0,.767,.52,.74),(0,0,.866,.628,.849),(0,0,1.32,.686,.916),
        (0,0,1.67,.683,.907),(0,0,1.98,.649,.868),(0,0,2.20,.604,.818),
        (0,0,2.35,.565,.777),
    ], IVORY, exponent=.60, sides=64)
    def cut(cutter):
        select([shell])
        boolean = shell.modifiers.new("Open the cabin", "BOOLEAN")
        boolean.operation = "DIFFERENCE"
        boolean.solver = "EXACT"
        boolean.object = cutter
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    def clean_cut_edges():
        mesh = bmesh.new()
        mesh.from_mesh(shell.data)
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=.0005)
        bmesh.ops.dissolve_degenerate(mesh, edges=list(mesh.edges), dist=.0003)
        bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
        mesh.to_mesh(shell.data)
        mesh.free()
        shell.data.update()

    cut(inner)
    cutouts = {}
    for front in (True, False):
        width = .566 if front else .745
        outline = [(width*x, z) for x,z in [
            (0,1.175),(.56,1.188),(.88,1.253),(.995,1.450),(.965,1.715),
            (.807,1.949),(.524,2.081),(.266,2.051),(0,1.989),
            (-.266,2.051),(-.524,2.081),(-.807,1.949),(-.965,1.715),(-.995,1.450),
            (-.88,1.253),(-.56,1.188),
        ]]
        # A curved double arch is cut through both faces along this axis.
        cutouts[front] = outline
        opening = curve(outline, 4, True)
        sections = [[(u,level,z) if front else (level,u,z) for u,z in opening]
                    for level in (-1.34,1.34)]
        cut(sculpt.rings("Double-arch tunnel cutter",sections,IVORY))
    clean_cut_edges()
    bevel = shell.modifiers.new("Rounded window reveals", "BEVEL")
    bevel.width = .017
    bevel.segments = 3 if sculpt.master else 2
    bevel.limit_method = "ANGLE"
    select([shell])
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    clean_cut_edges()
    for face in shell.data.polygons:
        face.use_smooth = True
    for front, outline in cutouts.items():
        for s in (-1,1):
            sculpt.sweep("Cast double-arched window frame",
                [(*facade(u,z,front,s,-.006),.057,.036) for u,z in outline],GOLD,
                face=Y if front else X,closed=True,steps=4)
            if not front:
                sculpt.sweep("Door window mullion", [
                   (*facade(0,z,front,s,inset),.030,.026)
                   for z,inset in [(1.175,.003),(1.423,-.033),(1.72,-.030),(1.994,.004)]
                ], GOLD, guide=X)
            curtains(sculpt,front,s,.566 if front else .745)


def curtains(sculpt, front, s, width):
    for side in (-1,1):
        def curtain(u,z,inset):
            return facade(u*width*side,z,front,s,inset)
        for fold in range(4):
            f = fold/3
            sculpt.sweep("Gathered velvet window curtain", [
                (*curtain(.32+.37*f,2.016-.10*f,-.055), .072,.052),
                (*curtain(.37+.38*f,1.905-.103*f,-.066),.073,.066),
                (*curtain(.50+.36*f,1.767-.117*f,-.078),.074,.064),
                (*curtain(.67+.24*f,1.586,-.074),.056,.047),
                (*curtain(.70+.17*f,1.453,-.070),.041,.042),
                (*curtain(.62+.23*f,1.306,-.068),.062,.043),
                (*curtain(.56+.22*f,1.200,-.075),.065,.046),
            ], VELVET if fold<3 else BLUE, guide=Y if front else X)
        sculpt.sweep("Gilt curtain tieback", [
            (*curtain(u,z,offset),.034,.025) for u,z,offset in
            [(.63,1.50,-.071),(.69,1.479,-.043),(.78,1.473,-.031),(.88,1.48,-.046),(.945,1.507,-.081)]
        ], GOLD,guide=Y if front else X)


def seat(sculpt):
    sculpt.sectional("Coach floor and gilded undercarriage", [
        (0,0,.445,.575,.809),(0,0,.476,.638,.857),(0,0,.543,.687,.920),
        (0,0,.601,.706,.919),(0,0,.649,.706,.903),(0,0,.670,.664,.887),
    ], GOLD,exponent=.65)
    sculpt.sectional("Dark leather floor", [
        (0,0,.661,.583,.872),(0,0,.690,.655,.899),(0,0,.766,.655,.899),
    ], NAVY, exponent=.70)
    for s in (-1,1):
        for j in (-1,0,1):
            x = j*.315
            sculpt.pebble("Rolled velvet seat pad",(x,s*.62,.878),X,Y,Z,(.205,.305,.154),SEAT)
            sculpt.pebble("Tufted velvet backrest",(x,s*.777,1.117),X,Z,Y,(.228,.236,.131),SEAT)
            sculpt.bead("Seat tuft button",(x,s*.655,1.129),.025,BRASS)
    for s in (-1,1):
        sculpt.sweep("Wheel axle",[(-.921,s*.764,.50,.066,.066),(0,s*.764,.50,.072,.072),
                    (.921,s*.764,.50,.066,.066)],BRASS,guide=Z)


def wheels(sculpt):
    for s in (-1,1):
        for front in (True,False):
            center = Vector((s*.810,-.731 if front else .742, .465 if front else .542))
            r = center.z
            # This is an open rim. The gap between the cast floral petals shows through.
            section = [
                (.81,-.092),(.845,-.137),(.954,-.132),(1.,-.103),(1.015,-.059),
                (1.017,.059),(1.007,.103),(.967,.135),(.864,.137),
                (.818,.105),(.801,.063),(.800,-.059),
            ]
            sides = 64 if sculpt.master else 40
            rings = [[center + X*k + Y*(r*radius*cos(a)) + Z*(r*radius*sin(a))
                      for a in (2*pi*i/sides for i in range(sides))]
                     for radius,k in curve(section,3 if sculpt.master else 2,True)]
            sculpt.rings("Rolled cast-gold wheel rim",rings,GOLD,loop=True)
            for side in (-1,1):
                sculpt.line("Raised hub lip on rim",[
                    center + X*(side*.136) + Y*(r*.900*cos(a)) + Z*(r*.900*sin(a))
                    for a in (2*pi*i/20 for i in range(20))
                ],.011,BRASS,closed=True,guide=X)
            for j in range(6):
                a = 2*pi*j/6 + (.06 if front else .17)
                radial = Y*cos(a) + Z*sin(a)
                cross = Y*(-sin(a)) + Z*cos(a)
                pos = center + X*(s*.045)
                sculpt.feather("Cast petal spoke",pos+radial*(r*.12),
                               pos+radial*(r*.48)+cross*.041,
                               pos+radial*(r*.867),r*.159,.074,GOLD,X*s,.031,blunt=True)
            sculpt.pebble("Rounded gilt wheel hub", center+X*s*.121,Y,Z,X,(r*.233,r*.233,.083),GOLD)
            sculpt.pebble("Domed sapphire wheel hub", center+X*s*.196,Y,Z,X,(r*.136,r*.141,.045),GEM)


def roof(sculpt):
    levels = [(2.095,.752,.940),(2.142,.757,.939),(2.281,.721,.884),
              (2.411,.625,.765),(2.517,.481,.579),(2.602,.293,.359),
              (2.642,.132,.174),(2.657,.028,.035)]
    def point(angle, z, rx, ry, offset=0):
        low = .046*cos(4*angle) - .016*cos(8*angle)
        waviness = (1-min(1,(z-2.095)/.56))**1.7
        return Vector(((rx+offset)*sign_power(cos(angle),.67),(ry+offset)*sign_power(sin(angle),.67),
                       z + low*waviness + offset*.40))
    rings = [[point(2*pi*i/72,z,rx,ry) for i in range(72)] for z,rx,ry in curve(levels,4)]
    sculpt.rings("Scalloped blue coach canopy",rings,BLUE)
    for i in range(8):
        angle = i*pi/4
        sculpt.sweep("Broad gilded roof rib", [
            (*point(angle,z,rx,ry,.027), .041 if index<6 else .034,.029)
            for index,(z,rx,ry) in enumerate(levels)
        ],GOLD,guide=Z)
    sculpt.sweep("Sculpted wave along canopy hem",[
        (*point(i*2*pi/48,2.122,.751,.932,.022),.049,.038) for i in range(48)
    ],GOLD,guide=Z,closed=True)
    for sx in (-1,1):
        for sy in (-1,1):
            # The volutes sit high on the four corners, above the window frame.
            c = Vector((sx*.623,sy*.787,2.186))
            across = Vector((sx*.63,-sy*.78,0))
            sculpt.volute("Canopy corner scroll",c,across,Z,.204,-1.65,handedness=sx*sy)
            sculpt.sweep("Short sweeping band below the corner scroll",[(*p,w,.042) for p,w in [
                (Vector((sx*.368,sy*.914,2.142)),.036),
                (Vector((sx*.546,sy*.876,2.094)),.054),
                (c-Z*.174,.055),
            ]],GOLD,guide=Z)
    for s in (-1,1):
        sculpt.jewel("Canopy hem sapphire",(0,s*.961,2.105),X,Z,Y*s,.105,.152)


def crown(sculpt):
    scallops = [[(cos(a)*r*(1+.060*cos(10*a)),sin(a)*r*(1+.060*cos(10*a)),z)
                 for a in (2*pi*i/80 for i in range(80))]
                for z,r in ((2.603,.201),(2.632,.268),(2.672,.292),(2.701,.253),(2.720,.206))]
    sculpt.rings("Scalloped gilt crown cushion mount",scallops,GOLD)
    profiles = [(0,0,2.682,.204,.204),(0,0,2.741,.247,.247),(0,0,2.840,.276,.276),
                (0,0,2.929,.303,.303),(0,0,3.005,.267,.267),(0,0,3.054,.178,.178),
                (0,0,3.105,.046,.046)]
    sculpt.sectional("Crown's upholstered royal-blue cap",profiles,BLUE)
    sculpt.sectional("Crown's gold circlet",[(0,0,z,r,r) for z,r in
        [(2.694,.207),(2.716,.247),(2.765,.253),(2.811,.250),(2.828,.235)]],GOLD)
    for j in range(6):
        a = (j+.5)*pi/3
        normal = Vector((cos(a),sin(a),0))
        across = Z.cross(normal)
        sculpt.sweep("Gilded outward-swept crown arch", [
            (*(normal*r+Z*z),wide,thick) for r,z,wide,thick in
              [(.223,2.753,.049,.035),(.284,2.857,.060,.041),
               (.331,2.972,.062,.042),(.290,3.075,.062,.038),
               (.174,3.126,.053,.034),(.050,3.129,.051,.028)]
        ],GOLD,guide=across)
        angle = a + pi/6
        n = Vector((cos(angle),sin(angle),0))
        sculpt.jewel("Faceted sapphire on the crown",n*.261+Z*2.792,Z.cross(n),Z,n,.074,.098)
    sculpt.pebble("Crown finial collar",(0,0,3.134),X,Y,Z,(.122,.122,.040),GOLD)
    sculpt.bead("Polished crown finial",(0,0,3.246),.109)


def lantern(sculpt,x):
    y = -1.007
    sculpt.sectional("Lantern stem and stepped brass base", [(x,y,z,w,w) for z,w in
        [(.91,.062),(.974,.102),(1.068,.117),(1.096,.137),(1.126,.142),(1.150,.124)]],
        GOLD,exponent=.27,sides=32)
    sculpt.sectional("Honey-colored lantern glass",[(x,y,z,w,w) for z,w in
        [(1.143,.103),(1.181,.116),(1.325,.143),(1.405,.149)]], LAMP,exponent=.26,sides=32)
    for dx in (-1,1):
        for dy in (-1,1):
            sculpt.line("Lantern brass glazing bar",
                [(x+dx*.103,y+dy*.103,1.14),(x+dx*.129,y+dy*.129,1.29),
                 (x+dx*.147,y+dy*.147,1.414)],.019)
    sculpt.sectional("Beveled gold lantern bonnet",[(x,y,z,w,w) for z,w in
        [(1.385,.149),(1.402,.166),(1.427,.171),(1.458,.143),(1.517,.076),(1.536,.065)]],
        GOLD,exponent=.44,sides=32)
    sculpt.pebble("Lantern bonnet collar",(x,y,1.540),X,Y,Z,(.071,.071,.021),GOLD)
    sculpt.bead("Lantern finial",(x,y,1.586),.061)


def heraldry(sculpt):
    panel = [(-.468,.099),(-.397,.220),(-.234,.230),(.234,.230),(.397,.220),(.468,.099),
             (.427,-.146),(.265,-.226),(0,-.249),(-.265,-.226),(-.427,-.146)]
    for s in (-1,1):
        frame = Vector((0,s*.978,.901))
        normal = Y*s
        sculpt.relief("Gilt coach heraldic plaque",panel,frame,X,Z,normal,.057,GOLD)
        sculpt.relief("Inset enamel heraldic plaque",[(x*.903,z*.846) for x,z in panel],
                     frame+normal*.046,X,Z,normal,.035,BLUE)
        emblem = [(-.150,.061),(-.102,.001),(-.055,.030),(0,.123),(.055,.030),(.102,.001),
                  (.150,.061),(.110,-.089),(0,-.073),(-.110,-.089)]
        raise_point = frame + normal*.089 + Z*.020
        sculpt.relief("Gilt crown heraldry",emblem,raise_point,X,Z,normal,.023,GOLD)
        for x,z in ((-.150,.061),(0,.111),(.150,.061)):
            sculpt.bead("Heraldic crown orb",raise_point+X*x+Z*z,.029)
        for side in (-1,1):
            sculpt.laurel("Gilt coach heraldic laurel",frame+normal*.082+X*side*.151-Z*.134,X,Z,normal,.275,side)
    step = [(-.224,-.102),(.224,-.102),(.229,.103),(-.229,.103)]
    for s in (-1,1):
        center = Vector((0,s*1.118,.594))
        sculpt.relief("Solid boarding step",step,center,X,Y,Z,.067,GOLD)
        sculpt.relief("Step enamel insert",[(u*.79,v*.77) for u,v in step],center+Z*.067,X,Y,Z,.027,BLUE)
        side_outline = [(-.40,1.160),(-.388,.969),(-.29,.808),(-.112,.726),
                        (.108,.725),(.283,.803),(.388,.972),(.40,1.160)]
        sculpt.line("Gilt fitted door outline",[facade(u,z,False,s,.014) for u,z in side_outline],.023)
        sculpt.fleur("Coach door fleur-de-lis",facade(0,.955,False,s,.028),Y,Z,X*s,.269)
    for s in (-1,1):
        lantern(sculpt,s*.590)
        sculpt.volute("Gilt front fender scroll", (s*.588,-.980,.910),X,Z,.144,-1.69,handedness=s)


def build(sculpt):
    hollow_cabin(sculpt)
    seat(sculpt)
    wheels(sculpt)
    roof(sculpt)
    crown(sculpt)
    heraldry(sculpt)
