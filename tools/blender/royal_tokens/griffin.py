"""Seated leonine anatomy, hooked eagle profile and folding flight feathers."""

from math import cos, sin
from mathutils import Vector

from horses import breastpiece, cheek_eye, saddle
from sculpt import BLUE, BRASS, FEATHER, GOLD, IVORY, X, Y, Z


def lion(sculpt):
    parts = [
        sculpt.sectional("Lion ribcage and tucked pelvis", [
            (0,-.97,1.23,.084,.172), (0,-.76,1.19,.451,.535), (0,-.37,1.08,.558,.613),
            (0,.10,.982,.562,.558), (0,.58,.867,.537,.499), (0,.97,.803,.385,.395),
            (0,1.17,.81,.075,.11),
        ], IVORY, (X,Z)),
        sculpt.sectional("Sloped shoulder and eagle neck", [
            (0,-.45,.88,.335,.374), (0,-.59,1.27,.471,.472), (0,-.68,1.57,.410,.409),
            (0,-.77,1.89,.327,.324), (0,-.826,2.18,.300,.302), (0,-.90,2.43,.336,.341),
            (0,-.971,2.58,.26,.24),
        ], IVORY),
        sculpt.sectional("Eagle cranium, cheek and cere", [
            (0,-.54,2.42,.047,.075),(0,-.64,2.44,.264,.285),(0,-.88,2.49,.357,.371),
            (0,-1.115,2.47,.366,.347),(0,-1.343,2.425,.292,.245),
            (0,-1.468,2.408,.176,.144),(0,-1.52,2.405,.065,.064),
        ], IVORY, (X,Z)),
    ]
    paws = []
    for s in (-1, 1):
        parts.append(sculpt.sectional("Strong canted lion foreleg", [
            (s*.338,-.923,.086,.194,.221),(s*.355,-.904,.269,.178,.188),(s*.369,-.820,.510,.168,.188),
            (s*.384,-.736,.774,.188,.207),(s*.365,-.608,1.055,.225,.236),
            (s*.295,-.571,1.39,.234,.254),(s*.18,-.561,1.52,.18,.17),
        ], IVORY))
        parts.append(sculpt.sweep("Seated cat thigh and fold", [
            (s*.289,.73,1.01,.293,.301),(s*.437,.62,.813,.344,.307),
            (s*.490,.497,.616,.285,.273),(s*.526,.683,.434,.220,.198),
            (s*.506,.727,.263,.166,.173),(s*.477,.532,.157,.205,.183),
        ], IVORY))
        paws += [(s*.344,-1.090), (s*.493,.317)]
    for x,y in paws:
        parts.append(sculpt.sectional("Broad padded paw", [
            (x,y-.008,.025,.229,.226),(x,y-.008,.047,.247,.253),
            (x,y+.028,.111,.249,.254),(x,y+.033,.203,.224,.237),
            (x,y+.097,.263,.157,.164),(x,y+.15,.287,.067,.071),
        ], IVORY, exponent=.87, sides=30))
        for i in (-1,0,1):
            toe_x, toe_y = x+i*.144, y+.036*abs(i)-.173
            parts.append(sculpt.pebble("Sculpted lion digit", (toe_x,toe_y,.13), X,Z,Y,
                                       (.097,.111,.161), IVORY, 18))
            sculpt.sweep("Curved gold claw", [
                (toe_x,toe_y-.098,.145,.059,.080),
                (toe_x,toe_y-.150,.122,.061,.066),
                (toe_x,toe_y-.195,.077,.048,.049),
                (toe_x,toe_y-.209,.037,.020,.025),
                (toe_x,toe_y-.199,.026,.005,.007),
            ], GOLD)
    sculpt.fuse("Continuous lion shoulders, haunches and paws", parts, .017 if sculpt.master else .034)
    tail = [
        (.115,.869,.624,.126,.122),(.239,1.139,.572,.125,.114),
        (.422,1.337,.395,.112,.106),(.618,1.518,.363,.103,.102),
        (.749,1.634,.476,.101,.092),(.774,1.668,.643,.091,.092),(.729,1.642,.817,.082,.080),
    ]
    sculpt.sweep("Lion tail curving upward from the haunch", tail, IVORY)
    sculpt.pebble("Gold tail cuff", (.74,1.637,.774), X,Y,Z, (.116,.111,.084), GOLD)
    sculpt.sweep("Flame-shaped curled tail tuft", [
        (.725,1.640,.774,.091,.114),(.739,1.650,.925,.171,.183),
        (.723,1.725,1.085,.180,.193),(.631,1.791,1.209,.143,.162),
        (.528,1.789,1.283,.084,.103),(.463,1.722,1.291,.009,.013),
    ], BLUE,face=Vector((.74,-.61,.14)).normalized(),ridge=.15,channels=True,sides=24)


def eagle(sculpt):
    sculpt.sectional("Upper beak with sculpted hook", [
        (0,-1.352,2.403,.173,.124),(0,-1.452,2.433,.257,.158),
        (0,-1.574,2.423,.264,.172),(0,-1.728,2.385,.210,.154),
        (0,-1.852,2.328,.135,.116),(0,-1.927,2.259,.073,.097),
        (0,-1.949,2.197,.035,.059),(0,-1.922,2.155,.008,.020),
    ], GOLD, (X,Z), exponent=.83)
    sculpt.sweep("Inset lower mandible", [
        (0,-1.39,2.294,.127,.063),(0,-1.533,2.255,.204,.066),
        (0,-1.703,2.235,.147,.045),(0,-1.855,2.261,.037,.023),
    ], BRASS)
    for s in (-1,1):
        normal = Vector((s*.92,-.38,.03)).normalized()
        cheek_eye(sculpt,s,.327,-1.235,2.505,.098,.107,.92,fierce=True)
        sculpt.sweep("Eagle's heavy sculpted brow", [
            (s*.124,-1.468,2.540,.059,.051),(s*.252,-1.363,2.595,.082,.072),
            (s*.327,-1.231,2.635,.087,.067),(s*.354,-1.069,2.703,.082,.056),
            (s*.334,-.936,2.734,.018,.030),
        ], IVORY, guide=Z)
        sculpt.pebble("Eagle nostril", (s*.208,-1.586,2.479), Z.cross(normal),Z,normal,(.028,.010,.012),BRASS,12)
        for n, (y, z, end_y, end_z) in enumerate([
            (-1.165,2.56,-.737,2.722),(-1.170,2.46,-.663,2.521),(-1.232,2.36,-.712,2.344),
            (-1.236,2.273,-.775,2.216),(-1.295,2.198,-.857,2.023),
        ]):
            offset = .304 + .022*(n%2)
            sculpt.feather("Overlapping cheek feather", (s*offset,y,z),
                (s*(offset+.122),.52*y+.48*end_y,z-.052), (s*(offset+.086),end_y,end_z),
                .088 + .012*n,.061,FEATHER,normal,.034)
        for j, (x,y,z) in enumerate(((.31,-.885,2.902),(.22,-.753,3.055),(.101,-.676,2.945))):
            sculpt.feather("Raised eagle crest", (s*x*.47,y-.43,2.684-j*.028),
                           (s*x,y-.121,2.73+j*.06), (s*(x+.102),y+.074,z), .091,.062,IVORY,normal,.023)
        for row, z in enumerate((1.85,2.07,2.25)):
            for index, a in enumerate((.20,.57,1.02,1.55,2.12,2.66,3.03)):
                angle = a + .082*(row%2)
                n = Vector((s*sin(angle),-cos(angle),.07)).normalized()
                c = Vector((s*(.306+.018*row)*sin(angle),-.81-(.342-.018*row)*cos(angle),z))
                start = c + Z*.103 - n*.082
                control = c + n*(.103+.03*(2-row)) - Z*.09
                drop = (.361,.291,.345,.268,.282,.253,.220)[index]
                tip = c + n*(.126+.034*(2-row)) - Z*(drop+(.044 if row == 0 else 0))
                sculpt.feather("Shingled eagle ruff",start,control,tip,.112-.009*row,.071,
                               IVORY if (index+row)%3 else FEATHER,n,.018,blunt=index in (2,4,5))
        sculpt.sweep("Arched eagle diadem with upturned ends", [
            (s*.034,-1.402,2.729,.065,.054),(s*.177,-1.355,2.765,.074,.049),
            (s*.289,-1.179,2.791,.075,.044),(s*.373,-.973,2.761,.068,.044),
            (s*.456,-.825,2.797,.062,.045),(s*.479,-.751,2.924,.052,.034),
            (s*.442,-.726,3.034,.012,.011),
        ], GOLD, guide=Z)
    sculpt.jewel("Griffin diadem sapphire", (0,-1.420,2.752), X,Z,Vector((0,-.91,.41)),.141,.180)


def wings(sculpt):
    for s in (-1,1):
        def p(x,y,z):
            return Vector((s*x*.853,y-max(0,x-.52)*.35,z))
        face = Vector((s*.29,-.91,.13)).normalized()
        spar = [
            (.34,-.483,1.51,.24,.206),(.55,-.404,1.76,.237,.177),(.71,-.32,2.11,.221,.154),
            (.89,-.246,2.50,.215,.123),(1.064,-.171,2.815,.180,.104),
            (1.254,-.082,3.085,.159,.089),(1.406,.026,3.211,.135,.075),
            (1.61,.105,3.08,.076,.053),
        ]
        sculpt.sweep("Raised griffin shoulder and swept wrist", [(*p(x,y,z),w,h) for x,y,z,w,h in spar],
                     FEATHER,face=face)
        flights = [
            ((1.35,.05,3.17),(1.985,.45,2.99),(2.235,.75,2.48),.178),
            ((1.255,-.025,3.085),(2.04,.52,2.73),(2.430,.82,1.987),.223),
            ((1.151,-.105,2.96),(1.991,.51,2.46),(2.340,.815,1.593),.242),
            ((1.04,-.169,2.83),(1.846,.454,2.235),(2.159,.789,1.348),.228),
            ((.94,-.21,2.66),(1.629,.391,2.013),(1.906,.739,1.250),.212),
            ((.827,-.25,2.47),(1.398,.34,1.883),(1.666,.648,1.283),.198),
            ((.719,-.28,2.28),(1.217,.29,1.718),(1.427,.545,1.340),.183),
            ((.619,-.34,2.07),(1.041,.21,1.587),(1.218,.449,1.355),.164),
            ((.535,-.38,1.86),(.845,.14,1.528),(.992,.337,1.384),.139),
            ((.427,-.40,1.69),(.701,.049,1.437),(.794,.247,1.396),.121),
        ]
        for i, (start, middle, end, w) in enumerate(reversed(flights)):
            shift = face*(.007*i)
            sculpt.feather("Broad overlapping griffin flight feather",p(*start)+shift,p(*middle)+shift,
                           p(*end)+shift,w,.092,FEATHER,face,.024,blunt=True)
        for i, (start, middle, end, w) in enumerate(flights):
            start, middle, tip = p(*start), p(*middle), p(*end)
            shift = face*(.114+(9-i)*.003)
            lean = .68 + .083*(i in (2,3,4))
            sculpt.feather("Gilded wing's blue median feather",start+shift,
                           start.lerp(middle,.80)+shift, start.lerp(tip,lean)+shift-Z*.069,
                           w*.80,.071, BLUE if i in range(2,9) else IVORY,face,.019,blunt=True)
            shift += face*.081
            sculpt.feather("Ivory wrist covert",start+shift,start.lerp(middle,.46)+shift,
                           start.lerp(tip,.39)+shift-Z*.118,w*.72,.055,IVORY,face,.019,blunt=True)
            shift = -face*.084
            sculpt.feather("Reverse griffin covert",start+shift,start.lerp(middle,.61)+shift,
                           start.lerp(tip,.54)+shift-Z*.061,w*.75,.056,IVORY,-face,.014,blunt=True)
        gold_path = [
            (.36,-.653,1.50,.050,.035),(.56,-.605,1.62,.075,.043),
            (.728,-.546,1.891,.084,.045),(.88,-.46,2.21,.081,.045),
            (1.049,-.37,2.545,.084,.047),(1.252,-.277,2.840,.090,.055),
            (1.411,-.187,3.10,.091,.054),(1.424,-.15,3.257,.078,.054),
            (1.330,-.15,3.331,.076,.048),(1.238,-.184,3.266,.062,.047),
            (1.242,-.187,3.165,.048,.036),(1.326,-.195,3.159,.028,.024),
            (1.35,-.195,3.218,.009,.015),
        ]
        sculpt.sweep("Continuous gilt leading-edge scrollwork", [(*(p(x,y,z)+face*.032),w*1.17,h) for x,y,z,w,h in gold_path],
                     GOLD,face=face)


def build(sculpt):
    lion(sculpt)
    eagle(sculpt)
    saddle(sculpt, griffin=True)
    breastpiece(sculpt, "griffin")
    wings(sculpt)
