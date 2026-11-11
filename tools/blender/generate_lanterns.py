"""A small reusable cast-metal lantern with a peaked roof and warm glass core."""
from core import box, lathe, mesh, transform_objects


def generate_lantern(materials, detail="high", origin=(0,0,0), scale=1):
    objects=[lathe("Lantern moulded foot",[(.18,0),(.18,.09),(.12,.15),(.07,.23)],10,materials["gold"]),
             lathe("Lantern tapered standard",[(.065,.20),(.045,1.32)],8,materials["wood"]),
             lathe("Lantern gold collar",[(.085,1.18),(.085,1.24),(.055,1.27)],8,materials["gold"]),
             box("Lantern warm glass chamber",(0,0,1.51),(.27,.27,.43),materials["window"],.025),
             box("Lantern lower frame",(0,0,1.28),(.39,.39,.085),materials["gold"],.02)]
    if detail!="low":
        for x in [-.16,.16]:
            for y in [-.16,.16]:
                objects.append(box("Lantern mullion",(x,y,1.51),(.035,.035,.49),materials["wood"],.005))
    r=.27; base=1.77
    objects.append(mesh("Lantern swept pyramidal cap",[(-r,-r,base),(r,-r,base),(r,r,base),(-r,r,base),(0,0,2.02)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],materials["gold"]))
    objects.append(lathe("Lantern top ornament",[(.055,0),(.065,.06),(.018,.15)],8,materials["gold"],(0,0,2.02)))
    for obj in objects: obj["asset_module"]="lantern"
    return transform_objects(objects,origin,scale)
