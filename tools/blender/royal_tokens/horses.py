"""Sculpted equine base, separate mane silhouettes, harnesses and feathered Pegasus."""

from math import cos, pi, sin

from mathutils import Vector

from sculpt import BLUE, CREAM, EYE, FEATHER, GEM, GLINT, GOLD, IVORY, NAVY, ROSE, VELVET, X, Y, Z


def horse_anatomy(sculpt):
    parts = [sculpt.sectional("Deep barrel and hindquarters", [
        (0,-1.13,1.32,.06,.14), (0,-.98,1.37,.37,.45), (0,-.66,1.38,.46,.53),
        (0,-.20,1.34,.53,.50), (0,.36,1.32,.57,.52), (0,.75,1.35,.51,.50),
        (0,1.05,1.40,.35,.36), (0,1.17,1.43,.025,.05),
    ], IVORY, (X, Z))]
    parts.append(sculpt.sectional("Chest, throat and poll", [
        (0,-.77,1.06,.43,.33), (0,-.74,1.39,.45,.42), (0,-.75,1.67,.39,.40),
        (0,-.83,1.92,.34,.34), (0,-.91,2.19,.30,.31), (0,-.98,2.50,.32,.30),
        (0,-.99,2.67,.18,.16),
    ], IVORY))
    parts.append(sculpt.sectional("Poll, cheek, bridge and rounded muzzle", [
        (0,-.75,2.48,.13,.21), (0,-.90,2.47,.360,.385), (0,-1.13,2.46,.403,.422),
        (0,-1.36,2.39,.368,.354), (0,-1.56,2.27,.312,.253), (0,-1.76,2.23,.270,.218),
        (0,-1.88,2.24,.19,.156), (0,-1.93,2.24,.045,.050),
    ], IVORY, (X, Z)))
    legs = []
    for side in (-1, 1):
        for back in (False, True):
            x = side*(.345 if back else .305)
            y = .76 if back else -.87
            legs.append((x, y))
            silhouette = [
                (x,y,.13,.147,.162), (x,y,.35,.143,.151), (x,y+.036,.58,.147,.146),
                (x-side*.012,y+.055,.80,.174,.169), (x-side*.04,y+.06,1.05,.213,.208),
                (x-side*.06,y+.09,1.35,.241,.259), (x-side*.18,y+.05,1.57,.182,.224),
            ]
            if back:
                silhouette[2] = (x,y+.10,.58,.154,.157)
                silhouette[3] = (x,y+.08,.82,.194,.174)
                silhouette[4] = (x-side*.025,y-.05,1.06,.237,.245)
                silhouette[5] = (x-side*.071,y-.06,1.40,.257,.304)
            parts.append(sculpt.sectional("Hock and hind leg" if back else "Shoulder and foreleg", silhouette, IVORY, sides=28))
        ear = [(side*.248,-.991,2.680,.113,.087), (side*.329,-1.056,2.837,.121,.080),
               (side*.377,-1.053,2.991,.096,.071), (side*.365,-1.017,3.135,.053,.041),
               (side*.339,-.986,3.202,.008,.010)]
        parts.append(sculpt.sweep("Sculpted equine ear", ear, IVORY))
    sculpt.fuse("Continuous porcelain anatomy", parts, .016 if sculpt.master else .032)
    for side in (-1, 1):
        sculpt.sweep("Recessed inner ear", [
            (side*.308,-1.112,2.791,.035,.016), (side*.356,-1.128,2.891,.069,.019),
            (side*.377,-1.119,3.012,.060,.022), (side*.367,-1.077,3.103,.035,.015),
            (side*.346,-1.025,3.174,.006,.007),
        ], ROSE)
        cheek_eye(sculpt, side, .354, -1.339, 2.514, .109, .127, .86)
        nostril_n = Vector((side*.52,-.85,.12)).normalized()
        nostril_h = Z.cross(nostril_n).normalized()
        nostril_c = Vector((side*.134,-1.893,2.290))
        sculpt.pebble("Soft inset nostril edge", nostril_c, nostril_h, Z, nostril_n, (.042,.044,.017), CREAM)
        sculpt.pebble("Nostril", nostril_c + nostril_n*.013, nostril_h, Z, nostril_n, (.024,.028,.010), ROSE, 12)
        sculpt.line("Smile crease", [(side*.245,-1.725,2.131), (side*.213,-1.670,2.098),
                        (side*.221,-1.596,2.098)], .008, CREAM)
    return legs


def cheek_eye(sculpt, side, x, y, z, width, height, angle, fierce=False):
    normal = Vector((side*angle, -(.38 if fierce else .50), .074)).normalized()
    across = Z.cross(normal).normalized()
    up = normal.cross(across).normalized()
    center = Vector((side*x,y,z))
    sculpt.pebble("Raised eyelid", center - normal*.008, across, up, normal,
                  (width*1.16,height*1.10,.031), CREAM)
    sculpt.pebble("Glossy expression", center + normal*.012, across, up, normal, (width,height,.042), EYE)
    sculpt.pebble("Pupil catchlight", center + normal*.053 + up*height*.39 - across*side*width*.20,
                  across, up, normal, (.019,.022,.008), GLINT, 12)
    if not fierce:
        for i in range(2):
            lash = center + normal*.025 + across*side*width*.76 + up*(.050 + i*.028)
            sculpt.sweep("Sculpted eyelash", [
                (*lash,.014,.014), (*(lash + across*side*.042 + up*.004),.011,.01),
                (*(lash + across*side*.064 + up*(.025 + i*.014)),.003,.003),
            ], EYE, up, sides=8)


def hooves(sculpt, legs, pegasus):
    for x, y in legs:
        profile = [
            (x,y-.031,.016,.160,.200), (x,y-.033,.028,.178,.212), (x,y-.030,.061,.183,.210),
            (x,y-.018,.112,.176,.194), (x,y-.008,.197,.154,.173), (x,y,.227,.150,.163),
            (x,y,.238,.131,.149),
        ]
        sculpt.sectional("Rounded gilt hoof", profile, GOLD, exponent=.84, sides=32)
        sculpt.sectional("Hoof cuff" if not pegasus else "Satin ankle band", [
            (x,y,.166,.162,.177), (x,y,.179,.173,.186), (x,y,.227,.168,.184),
            (x,y,.270,.160,.175), (x,y,.283,.143,.158),
        ], BLUE if pegasus else GOLD, exponent=.89, sides=32)
        for z in ((.268,) if pegasus else (.177,.270)):
            sculpt.line("Rolled cuff edge",
                [(x+.163*cos(a),y+.178*sin(a),z) for a in [2*pi*i/16 for i in range(16)]],
                .012, GOLD, closed=True)
        if not pegasus:
            sculpt.jewel("Hoof sapphire", (x,y-.181,.222), X, Z, -Y, .059, .080)
            for s in (-1,1):
                sculpt.volute("Miniature cuff scroll", (x+s*.105,y-.137,.225), X, Z,
                               .032, -.8, handedness=s)


def locks(sculpt, pegasus):
    main = BLUE if pegasus else IVORY
    dark = NAVY if pegasus else CREAM
    sculpt.sweep("Continuous swept crest and nape", [
        (0,-.56,1.93,.10,.104), (0,-.54,2.16,.27,.202), (0,-.59,2.47,.355,.274),
        (0,-.70,2.78,.366,.240), (0,-.89,2.97,.30,.204),
        (0,-1.16,2.936,.247,.155), (0,-1.38,2.836,.18,.101), (0,-1.46,2.776,.033,.027),
    ], main, ridge=.10, channels=True)
    for s in (-1, 1):
        sculpt.sweep("S-curved nape lock", [
            (s*.16,-1.05,2.955,.097,.075), (s*.285,-.80,2.910,.176,.111),
            (s*.374,-.647,2.778,.181,.126), (s*.407,-.624,2.583,.157,.109),
            (s*.429,-.711,2.423,.119,.102), (s*.448,-.721,2.286,.112,.093),
            (s*.455,-.611,2.208,.107,.089), (s*.471,-.460,2.237,.086,.080),
            (s*.466,-.438,2.358,.065,.058), (s*.444,-.522,2.398,.041,.034),
            (s*.429,-.570,2.341,.008,.010),
        ], main, face=s*X, ridge=.14, channels=True)
        sculpt.sweep("Coiled lower mane lock", [
            (s*.2,-.503,2.53,.110,.100), (s*.329,-.453,2.386,.129,.104),
            (s*.385,-.463,2.199,.144,.101), (s*.398,-.581,2.063,.117,.095),
            (s*.393,-.762,2.014,.100,.089), (s*.401,-.864,1.934,.100,.076),
            (s*.414,-.835,1.827,.076,.065), (s*.414,-.720,1.828,.055,.051),
            (s*.395,-.704,1.912,.037,.031), (s*.378,-.766,1.932,.008,.009),
        ], dark if pegasus else main, face=s*X, ridge=.15, channels=True)
        y = -1.39 if pegasus else -1.24
        spread = 1 if s == 1 or not pegasus else .73
        sculpt.sweep("Forelock curl", [
            (s*.006,y+.18,2.943,.113,.093), (s*.164*spread,y-.002,2.835,.132,.101),
            (s*.304*spread,y-.042,2.772,.119,.089), (s*.443*spread,y-.041,2.839,.095,.074),
            (s*.451*spread,y-.008,2.971,.076,.070), (s*.349*spread,y-.018,3.011,.052,.052),
            (s*.307*spread,y-.050,2.933,.035,.039), (s*.350*spread,y-.087,2.897,.008,.012),
        ], main, face=-Y, ridge=.11, channels=True)
    sculpt.sweep("Full coiled tail with sculpted strand crests", [
        (0,.965,1.465,.133,.170), (.016,1.150,1.734,.186,.216),
        (.036,1.443,1.945,.224,.257), (.064,1.749,1.940,.236,.270),
        (.117,1.909,1.707,.220,.264), (.151,1.838,1.448,.182,.247),
        (.182,1.783,1.196,.181,.237), (.209,1.969,1.026,.192,.213),
        (.250,2.206,1.084,.176,.179), (.273,2.302,1.262,.139,.132),
        (.265,2.203,1.413,.103,.104), (.236,2.045,1.388,.061,.064),
        (.206,2.040,1.288,.009,.014),
    ], main, face=X, ridge=.075, channels=True, sides=28 if sculpt.master else 16)
    if not pegasus:
        center = Vector((.061,1.723,1.947))
        cross = Vector((0,.423,.906))
        sculpt.sweep("Gilded tail ribbon", [
            (*(center + X*.273*cos(a) + cross*.242*sin(a)),.035,.024)
            for a in (2*pi*i/32 for i in range(32))
        ],GOLD,face=Vector((0,.906,-.423)),closed=True)


def golden_horn(sculpt):
    base = Vector((0,-1.264,2.804))
    horn_axis = Vector((0,-.52,.86)).normalized()
    radial = horn_axis.cross(X)
    rings = []
    steps = 100 if sculpt.master else 55
    sides = 36 if sculpt.master else 22
    for i in range(steps+1):
        t = i/steps
        center = base + horn_axis*.817*t - Y*(.074*t**2)
        radius = .172*(1-t)**.81 + .004
        for_ring = []
        for j in range(sides):
            angle = j*2*pi/sides
            # Reduce radius at the engraved helical lip while keeping the horn one mesh.
            twist = (angle - 2*pi*(3.70*t)) % (2*pi)
            groove = .077*cos(twist) + .063*cos(2*twist) + .045*cos(3*twist)
            for_ring.append(center + (X*cos(angle) + radial*sin(angle))*radius*(1-groove))
        rings.append(for_ring)
    sculpt.rings("One-piece helical brass horn", rings, GOLD)
    sculpt.pebble("Horn casting collar", base + horn_axis*.08, X, radial, horn_axis,
                  (.191,.188,.079), GOLD)


def headgear(sculpt, pegasus):
    sculpt.jewel("Forehead sapphire", (0,-1.453,2.755), X, Z, Vector((0,-.928,.372)), .147, .185)
    if pegasus:
        sculpt.sweep("Rolled noseband", [
            (.293*cos(a),-1.629-.071*sin(a),2.231+.240*sin(a),.035,.027)
            for a in [2*pi*i/24 for i in range(24)]
        ], GOLD, guide=Y, closed=True)
    else:
        golden_horn(sculpt)
    for s in (-1, 1):
        if pegasus:
            sculpt.sweep("Bridle headstall", [(s*x,y,z,w,.026) for x,y,z,w in
                [(.06,-1.446,2.766,.039), (.24,-1.336,2.773,.048),
                 (.354,-1.222,2.706,.047), (.401,-1.151,2.527,.043),
                 (.391,-1.154,2.289,.038), (.292,-1.548,2.184,.041)]], GOLD, guide=Z)
            normal = Vector((s*.87,-.49,0)).normalized()
            across = Z.cross(normal)
            c = Vector((s*.382,-1.245,2.326))
            sculpt.pebble("Bridle brass roundel", c, across, Z, normal, (.088,.096,.037), GOLD)
            sculpt.pebble("Bridle cabochon", c + normal*.041, across, Z, normal, (.059,.064,.035), GEM)
        else:
            sculpt.sweep("Gilt coronet scroll from brow", [(s*x,y,z,w,h) for x,y,z,w,h in
                [(.070,-1.453,2.748,.055,.044), (.206,-1.413,2.82,.064,.042),
                 (.299,-1.332,2.863,.061,.039), (.383,-1.260,2.811,.054,.044),
                 (.378,-1.256,2.733,.041,.037), (.32,-1.306,2.753,.021,.018)]], GOLD, guide=Z)
            sculpt.sweep("Gilded ribbon on nape", [(s*x,y,z,w,h) for x,y,z,w,h in
                [(0,-.769,3.135,.042,.030), (.18,-.732,3.113,.050,.030),
                 (.295,-.658,3.024,.054,.030), (.363,-.581,2.878,.045,.026),
                 (.387,-.550,2.739,.015,.013)]], GOLD, guide=Y)


def saddle(sculpt, griffin=False):
    # Drape across the spine and down to a shaped saddle hem on both flanks.
    rear = .94 if not griffin else .70
    neck = -.24 if not griffin else -.36
    def position(u, angle, inset=0):
        v = abs(angle)/1.87
        fore = neck + .17*v**1.6
        aft = rear + (.14 if griffin else .10)*(1-v)
        y = fore + u*(aft-fore)
        arch = .025*sin(pi*u)
        if griffin:
            width = .592+arch+.055*v
            z = 1.075-.218*u+(.620-.174*u+.105*(1-u)**3+arch-inset)*cos(angle)
            z += .22*v*((2*u-1)**4) -.024*v*sin(pi*u)
        else:
            width = .619+arch-.07*u**5
            z = 1.355+.049*u + (.587 + arch - .105*u**5 - inset)*cos(angle)
            z += .17*v*((2*u-1)**4)-.06*v*sin(pi*u)
        return Vector(((width-inset)*sin(angle),y,z))
    rows = 24 if sculpt.master else 16
    columns = 20 if sculpt.master else 12
    vertices = [
        position(i/columns,-1.87+3.74*j/rows,inset)
        for inset in (0,.055) for j in range(rows+1) for i in range(columns+1)
    ]
    stride = columns+1
    face_count = (rows+1)*stride
    polygons = []
    for j in range(rows):
        for i in range(columns):
            pos = j*stride+i
            face = (pos,pos+1,pos+1+stride,pos+stride)
            polygons += [face, tuple(index+face_count for index in reversed(face))]
    perimeter = (list(range(stride)) + [(j+1)*stride-1 for j in range(1,rows+1)]
        + [rows*stride+i for i in reversed(range(columns))]
        + [j*stride for j in reversed(range(1,rows))])
    for i, a in enumerate(perimeter):
        b = perimeter[(i+1)%len(perimeter)]
        polygons.append((a,b,b+face_count,a+face_count))
    sculpt.mesh("Tailored velvet saddle blanket", vertices, polygons, VELVET)
    for side in (-1, 1):
        angle = side*1.87
        sculpt.line("Rolled saddle hem", [position(i/12, angle) for i in range(13)], .034)
        normal = X*side
        p = position(.56, side*1.52, -.018)
        if griffin:
            sculpt.jewel("Shoulder sash gemstone", p, Y, Z, normal, .112, .152)
        else:
            sculpt.fleur("Saddle fleur-de-lis", p, Y, Z, normal, .247)
            for u in (.05,.96):
                x,y,z = position(u,angle)
                sculpt.tassel("Saddle corner tassel", x,y,z-.021,.88)
    for u in (0,1):
        sculpt.line("Gold saddle piping around the spine", [
            position(u,-1.87+3.74*i/18) for i in range(19)
        ], .036, guide=Y)


def breastpiece(sculpt, mode):
    if mode == "unicorn":
        for side in (-1,1):
            sculpt.sweep("Gilt collar wrapped around the equine shoulders", [
                (side*x,y,z,w,h) for x,y,z,w,h in [
                    (0,-1.224,1.306,.072,.040),(.151,-1.191,1.329,.074,.046),
                    (.268,-1.137,1.399,.074,.046),(.351,-1.027,1.484,.067,.045),
                    (.417,-.885,1.614,.063,.045),(.410,-.734,1.710,.062,.045),
                    (.344,-.584,1.755,.052,.035),(.244,-.480,1.749,.036,.026),
                ]
            ], GOLD, face=Vector((side*.53,-.85,.10)).normalized())
            sculpt.sweep("Rounded collar scroll", [
                (side*x,y,z,w,h) for x,y,z,w,h in [
                    (.086,-1.252,1.300,.049,.041),(.207,-1.195,1.370,.060,.046),
                    (.315,-1.099,1.440,.085,.046),(.372,-1.067,1.410,.068,.053),
                    (.372,-1.085,1.324,.057,.044),(.309,-1.135,1.310,.048,.041),
                    (.280,-1.156,1.352,.035,.035),(.312,-1.131,1.386,.011,.016),
                ]
            ], GOLD, face=-Y)
        sculpt.jewel("Breast collar sapphire",(0,-1.264,1.321),X,Z,-Y,.158,.202)
        return
    outline = [(-.40,.26),(-.25,.30),(0,.19),(.25,.30),(.40,.26),
               (.454,.12),(.392,-.11),(.217,-.29),(0,-.44),(-.217,-.29),
               (-.392,-.11),(-.454,.12)]
    center = Vector((0,-1.212,1.36 if mode == "griffin" else 1.437))
    # The rim bends around the barrel so the armor is fitted from the rear too.
    def on_chest(u,v,offset=0):
        return center + Vector((u,.89*u*u+.055*v+offset,v))
    for side in (-1,1):
        sculpt.sweep("Shoulder strap following the breastplate", [
            (side*.420,-1.028,1.66,.055,.036),
            (side*.432,-.856,1.728,.056,.042),
            (side*.400,-.685,1.771,.051,.038),
            (side*.325,-.536,1.793,.040,.024),
        ],GOLD,face=X*side)
    # Rim and mid-panel share their curved profile.
    from sculpt import curve
    edge = curve(outline, 3, True)
    rings = []
    for radius, offset in ((.93,.050),(1,0),(.974,-.038),(.77,-.066),(.51,-.080)):
        rings.append([on_chest(u*radius,v*radius,offset) for u,v in edge])
    sculpt.rings("Curved velvet breast armor", rings, VELVET)
    sculpt.line("Raised breast armor binding", [on_chest(u,v,-.037) for u,v in outline], .035, closed=True)
    sculpt.fleur("Heraldic breast device", on_chest(0,-.139,-.079), X, Z, -Y, .197)
    for s in (-1,1):
        if mode == "pegasus":
            sculpt.laurel("Breast laurel", on_chest(s*.156,-.196,-.059), X, Z, -Y, .260,s)
        else:
            sculpt.volute("Gilt griffin armorial scroll", on_chest(s*.346,-.048,-.048), X,Z,.098,-.82,handedness=s)
    if mode == "pegasus":
        sculpt.jewel("Breast armor drop", on_chest(0,-.414,-.067), X, Z, -Y,.094,.126)


def pegasus_wings(sculpt):
    for s in (-1, 1):
        def p(x, y, z):
            return Vector((s*x,y-max(0,x-.45)*.13,z))
        normal = Vector((s*.476,-.79,.33)).normalized()
        sculpt.sweep("Wing shoulder, elbow and wrist", [(*p(x,y,z),w,h) for x,y,z,w,h in [
            (.37,-.39,1.55,.228,.161),(.62,-.32,1.79,.226,.133),(.88,-.18,2.10,.169,.103),
            (1.062,.025,2.39,.132,.089),(1.187,.27,2.59,.103,.067),
            (1.27,.52,2.74,.074,.050),(1.31,.76,2.94,.017,.020)
        ]], FEATHER, face=normal)
        # The longest primaries follow the lifted leading edge. The lower
        # secondaries descend progressively into the shoulder.
        flights = [
            ((1.16,.31,2.55),(1.36,1.08,2.95),(1.43,1.31,3.50),.198),
            ((1.10,.23,2.36),(1.43,1.23,2.69),(1.51,1.51,3.13),.191),
            ((1.00,.12,2.20),(1.43,1.22,2.52),(1.54,1.52,2.84),.184),
            ((.89,.015,2.07),(1.38,1.18,2.32),(1.52,1.53,2.52),.174),
            ((.79,-.08,1.95),(1.28,1.10,2.06),(1.47,1.45,2.23),.165),
            ((.67,-.19,1.83),(1.10,.93,1.82),(1.35,1.27,1.99),.153),
            ((.55,-.25,1.69),(.94,.70,1.65),(1.18,.99,1.75),.147),
            ((.434,-.31,1.58),(.74,.49,1.47),(.99,.72,1.55),.133),
        ]
        for index, (root, joint, tip, width) in enumerate(reversed(flights)):
            nudge = normal*(.012*index)
            sculpt.feather("Raked Pegasus flight feather", p(*root)+nudge, p(*joint)+nudge, p(*tip)+nudge,
                           width,.092,FEATHER,normal,.021,blunt=True)
        for row in range(2):
            for i, (root, joint, tip, width) in enumerate(reversed(flights[1:])):
                start = p(*root) + normal*(.146+row*.069)
                middle = p(*joint)
                finish = p(*tip)
                control = start.lerp(middle, .60-row*.23)
                point = start.lerp(finish, .56-row*.21) - Z*(.16-row*.069)
                sculpt.feather("Rounded Pegasus wing covert",start,control,point,width*(.88-row*.20),
                               .065-row*.012,IVORY,normal,.017,blunt=True)
                if row == 0:
                    start = p(*root) - normal*.092
                    sculpt.feather("Reverse Pegasus covert",start,start.lerp(middle,.47),
                                   start.lerp(finish,.53)-Z*.105,width*.71,.058,FEATHER,-normal,.018,blunt=True)
        gilded = [
            (.40,-.50,1.51,.045,.035),(.60,-.48,1.70,.079,.041),(.81,-.41,1.958,.073,.040),
            (1.012,-.283,2.254,.076,.043),(1.160,-.101,2.584,.081,.045),
            (1.236,.117,2.755,.077,.045),(1.29,.34,2.81,.040,.028),(1.30,.46,2.89,.012,.011),
        ]
        sculpt.sweep("Swept Pegasus wing gilding", [(*(p(x,y,z)+normal*.023),w*1.06,h) for x,y,z,w,h in gilded],
                     GOLD, face=normal)
        sculpt.volute("Pegasus wrist scroll",p(1.209,.025,2.668)+normal*.02,p(.60,.8,0),Z,.110,1.02,handedness=-1)
        sculpt.jewel("Pegasus wing sapphire",p(.635,-.546,1.761),p(.60,.8,0),Z,normal,.116,.156)


def build(sculpt, pegasus=False):
    legs = horse_anatomy(sculpt)
    hooves(sculpt, legs, pegasus)
    locks(sculpt, pegasus)
    headgear(sculpt, pegasus)
    breastpiece(sculpt, "pegasus" if pegasus else "unicorn")
    saddle(sculpt)
    if pegasus:
        pegasus_wings(sculpt)
