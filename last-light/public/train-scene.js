// Coordinates are measured against the finished 1536 × 1024 carriage painting.
// The stage preserves this aspect ratio, so the same hit areas work on phones.
export const TRAIN_ART = {
  width: 1536, height: 1024,
  carriage: '/assets/train/carriage-arrival.jpg',
  collected: '/assets/train/carriage-collected.jpg',
  photograph: '/assets/train/station-photograph.jpg',
  platform: '/assets/train/platform-dawn.jpg',
};
export const TRAIN_HOTSPOTS = {
  mara: {x: 16, y: 18, w: 36, h: 49, label: 'Mara', detail: 'The passenger by the window'},
  eli: {x: 64.5, y: 4, w: 19, h: 61, label: 'Eli', detail: 'The conductor and his stopped watch'},
  photograph: {x: 26.2, y: 73.5, w: 16.2, h: 11, label: 'Photograph', detail: 'A memory left on the table'},
  radio: {x: 78.8, y: 32.5, w: 13.6, h: 24, label: 'Radio', detail: 'A voice through the static'},
  brake: {x: 92.8, y: 7.8, w: 5.1, h: 20.5, label: 'Brake', detail: 'The red handle beside the door'},
};
export function mountTrainMotion(host) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1536 1024');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'train-motion');
  // Every moving exterior is clipped away from Mara, the lamps and the frames.
  svg.innerHTML = `<defs>
    <clipPath id="train-window-glass"><path d="M0 0H207L310 106V180L289 204 274 236 268 272 274 314 254 355 245 382 196 399 125 421 94 383 0 376Z M127 421L237 384 235 458 217 484 127 522Z M628 153H774Q789 153 789 168V389H628Z M930 248L992 225V375L934 398Z"/></clipPath>
    <linearGradient id="train-passing-light"><stop stop-color="#d9bd79" stop-opacity="0"/><stop offset=".5" stop-color="#e9cd96" stop-opacity=".36"/><stop offset="1" stop-color="#d9bd79" stop-opacity="0"/></linearGradient>
    <linearGradient id="train-dawn-haze" x2="0" y2="1"><stop stop-color="#d6ae6f" stop-opacity="0"/><stop offset="1" stop-color="#e3b77b" stop-opacity=".22"/></linearGradient>
  </defs><g clip-path="url(#train-window-glass)">
    <g class="exterior-distant" fill="#5e8eaa" opacity=".2"><path d="M-1536 320L-1320 240 -1160 300 -950 210 -740 310 -510 215 -320 275 -110 220 80 290 280 205 450 310 680 235 890 295 1120 200 1340 280 1536 235 1720 280 1940 220 2140 305 2350 225 2550 290 2780 210 3072 300V570H-1536Z"/></g>
    <g class="exterior-trees" fill="#071a2b" opacity=".62"></g>
    <g class="exterior-poles" stroke="#07131c" stroke-width="7" opacity=".62"><path d="M-250 150V600M-290 185H-210M600 130V600M560 165H640M1450 150V600M1410 185H1490M2300 120V600M2260 155H2340"/></g>
    <rect class="window-light-pass" x="-400" y="0" width="270" height="600" fill="url(#train-passing-light)"/>
    <g class="window-rain" stroke="#d5e9ed" stroke-width="1.3" opacity=".32"></g>
    <g class="approaching-station" fill="#17232b" opacity="0"><path d="M-750 338H30L80 357H-780Z M-690 355H-680V520H-690Z M-340 355H-330V520H-340Z M10 355H20V520H10Z M-800 510H130V527H-800Z"/><circle cx="-350" cy="397" r="12" fill="#edce89" opacity=".8"/></g>
    <rect class="dawn-haze" width="1536" height="650" fill="url(#train-dawn-haze)" opacity="0"/>
  </g><g class="tea-steam" fill="none" stroke="#efe9d6" stroke-width="2" opacity=".18"><path d="M284 644C265 621 303 609 282 585"/><path d="M300 646C324 620 285 608 308 580"/></g>`;
  const forest = svg.querySelector('.exterior-trees');
  for (let i = -14; i < 70; i++) {
    const x = i * 42, h = 38 + (Math.abs(i * 37) % 52);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${x} 456V${455-h}M${x-16} ${458-h*.15}L${x} ${455-h}L${x+16} ${458-h*.15}Z M${x-21} 465L${x} ${430-h*.3}L${x+21} 465Z`);
    forest.append(path);
  }
  const rain = svg.querySelector('.window-rain');
  for (let i = 0; i < 55; i++) {
    const line = document.createElementNS(ns, 'path'), x = (i*83)%1536, y = (i*67)%540;
    line.setAttribute('d', `M${x} ${y}l-5 ${8+i%5*4}`);rain.append(line);
  }
  svg.querySelector('#train-window-glass path').dataset.carriagePath = svg.querySelector('#train-window-glass path').getAttribute('d');
  host.append(svg);
  return svg;
}

// Each new chapter has its own measured art and only the props visible in it.
const SIGNAL_HOTSPOTS = {
  radio: {x:20,y:40,w:27,h:40,label:'Radio',detail:'Tune the three-note signal'},
  chart: {x:42,y:75,w:53,h:20,label:'Route chart',detail:'Follow the dim platform on Eli’s chart'},
  eli: {x:61,y:4,w:26,h:67,label:'Eli',detail:'The conductor beside his dispatch desk'},
};
const VESTIBULE_HOTSPOTS = {
  mara: {x:15,y:9,w:30,h:83,label:'Mara',detail:'Share what you are carrying'},
  ticket: {x:49,y:79,w:12,h:6,label:'Ticket',detail:'Your one-way ticket on the shelf'},
  brake: {x:90,y:12,w:7,h:25,label:'Brake',detail:'Wait until the last platform is beside the train'},
};
export function getTrainScene(state) {
  if (state.stage === 'signal') return {id:'signal',art:'/assets/train/radio-compartment.jpg',hotspots:SIGNAL_HOTSPOTS,windowPath:'M0 0H409V457L200 502V329L141 299V220H82V291L0 298Z M444 0L635 147Q660 177 660 213V434L444 493Z',alt:'Eli stands beside a warmly lit dispatch desk with a wooden radio and railway route chart. Moonlit mountains pass beyond the compartment window.'};
  if (state.stage === 'vestibule') return {id:'vestibule',art:'/assets/train/vestibule-before-dawn.jpg',hotspots:VESTIBULE_HOTSPOTS,windowPath:'M915 0H1310V584Q1310 653 1252 642L877 583V67Q877 0 915 0Z',alt:'Mara waits beside the rain-streaked carriage door. A ticket rests on the luggage shelf; the red brake hangs beside the window as the station approaches.'};
  if (state.ending && state.ending !== 'loop') return {id:'platform',art:TRAIN_ART.platform,hotspots:{},alt:'The Westbound Limited rests beside a rain-wet mountain platform in golden dawn light, with an open carriage door and empty bench.'};
  return {id:'carriage',art:TRAIN_ART.carriage,hotspots:TRAIN_HOTSPOTS};
}
