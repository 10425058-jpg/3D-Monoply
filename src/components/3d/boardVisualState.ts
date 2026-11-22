/** Presentation priority; never changes a deed or an action's availability. */
export function tileOutline({selected, hovered, auction, landed, purchasable}: {
  selected:boolean; hovered:boolean; auction:boolean; landed:boolean; purchasable:boolean;
}) {
  if(selected)return '#d7a840';
  if(auction)return '#b692df';
  if(hovered)return '#fff4d9';
  if(landed)return purchasable?'#67b9a0':'#91b5d0';
  return null;
}

/** Owner frame: four rails just inside the independent interaction outline.
 * Rails meet without overlapping, so an additive glow layer has even brightness. */
export function ownerEdgeLayout(width:number,depth:number,thickness=.05) {
  const x=width/2-.11,z=depth/2-.11;
  return [
    {x:-x,z:0,width:thickness,depth:2*z+thickness},
    {x,z:0,width:thickness,depth:2*z+thickness},
    {x:0,z:-z,width:2*x-thickness,depth:thickness},
    {x:0,z,width:2*x-thickness,depth:thickness},
  ];
}
