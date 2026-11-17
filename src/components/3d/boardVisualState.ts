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

/** Narrow owner rails stay inside the independent interaction outline. */
export function ownerEdgeLayout(width:number,depth:number) {
  return [-1,1].map(side=>({x:side*(width/2-.11),z:0,width:.028,depth:depth-.27}));
}
