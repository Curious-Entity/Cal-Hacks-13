// Small vector props stay clickable independently of background image cropping.
// All SVG paths are authored here; generated text never becomes SVG markup.
const shapes={
  letter:'<rect x="9" y="17" width="46" height="32" rx="3"/><path d="m10 19 22 17 22-17M10 47l15-14m29 14L39 33"/>',
  radio:'<rect x="7" y="21" width="50" height="31" rx="5"/><path d="M14 21 43 8M14 29h20m-20 6h20m-20 6h20"/><circle cx="45" cy="36" r="6"/>',
  key:'<circle cx="21" cy="23" r="12"/><circle cx="21" cy="23" r="4"/><path d="m29 32 22 21m-8-9 6-6m-1 11 6-6"/>',
  book:'<path d="M10 13q13-4 22 4 9-8 22-4v37q-13-4-22 3-9-7-22-3Z"/><path d="M32 17v36M16 23l10 2m-10 6 10 2m12-8 10-2m-10 10 10-2"/>',
  terminal:'<rect x="8" y="10" width="48" height="34" rx="4"/><path d="M25 44v8m14-8v8M18 54h28M17 21l7 6-7 6m14 0h12"/>',
  map:'<path d="m8 17 16-6 16 6 16-6v37l-16 6-16-6-16 6Z"/><path d="M24 11v37m16-31v37M13 29q9-8 18 4t17 4" stroke-dasharray="3 3"/><circle cx="47" cy="25" r="4"/>',
  bag:'<rect x="10" y="20" width="44" height="34" rx="6"/><path d="M23 20v-6q9-9 18 0v6M10 33h44m-23-3h7v8h-7M17 20v34m30-34v34"/>',
  lamp:'<path d="M24 12h16l9 25H15Zm8 25v15M20 54h24M29 8h6"/><path d="m11 20-5-3m47 3 5-3m-5 24 5 3m-47-3-5 3" opacity=".6"/>',
  door:'<path d="M13 56V9h38v47M20 56V15h25v41"/><circle cx="38" cy="36" r="2"/><path d="M8 56h48"/>',
  object:'<path d="m32 8 23 13v25L32 59 9 46V21Zm0 26L9 21m23 13 23-13M32 34v25M21 15l23 13"/>',
};
export function objectIcon(type) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[type] || shapes.object}</svg>`;
}
export function objectPositions(count) {
  return ({2:[[30,61],[72,54]],3:[[20,58],[50,68],[79,54]],4:[[17,54],[38,68],[63,50],[82,66]]})[count] || [];
}
