/** Solo's whole-dollar convention: principal plus 10% interest rounded up.
 * Integer arithmetic avoids ceil(100 * 1.1) accidentally charging 111. */
export const unmortgageCost = (principal: number) => principal + Math.ceil(principal / 10);
