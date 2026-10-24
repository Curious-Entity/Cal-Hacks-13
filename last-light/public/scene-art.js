// Atmospheric vector art composed from the storyteller's scene parameters.
// Only validated colors and fixed shape templates enter the SVG markup.
export function sceneArt(visual = {}, seedText = '') {
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const sky = color(visual.sky, '#163d4a');
  const accent = color(visual.accent, '#c4dfb2');
  const front = color(visual.foreground, '#10282d');
  let seed = [...seedText].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 2031);
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const setting = visual.setting || 'mountain';
  const stars = Array.from({length:45}, () => `<circle cx="${Math.round(random()*1200)}" cy="${Math.round(random()*500)}" r="${(random()*1.5+.5).toFixed(1)}" opacity="${(random()*.5+.2).toFixed(2)}"/>`).join('');
  const mountains = (y, height) => {
    let points = `0,${y+80}`;
    for (let x=0;x<=1300;x+=100) points += ` ${x},${Math.round(y-random()*height)}`;
    return points + ' 1200,900 0,900';
  };
  let landscape = '';
  if (setting === 'city' || setting === 'ocean') {
    const buildings = Array.from({length:18}, (_,i) => {
      const x=i*75-30; const h=70+Math.round(random()*270); const w=40+Math.round(random()*35);
      const windows = Array.from({length:Math.floor(h/25)}, (_,j) => `<path d="M${x+10} ${620-h+18+j*25}h7m10 0h7" stroke="${accent}" stroke-width="3" opacity=".4"/>`).join('');
      return `<rect x="${x}" y="${620-h}" width="${w}" height="${h}" fill="${front}" opacity=".7"/>${windows}`;
    }).join('');
    landscape = `<path d="M0 600Q300 470 600 580T1200 590V900H0Z" fill="${front}" opacity=".4"/>${buildings}<path d="M0 660Q300 590 650 640T1200 630V900H0Z" fill="${front}"/>`;
    if (setting === 'ocean') {
      landscape += `<path d="M0 0h1200v900H0Z" fill="${sky}" opacity=".2"/><g fill="none" stroke="${accent}" opacity=".2">${Array.from({length:20},()=>`<circle cx="${Math.round(random()*1200)}" cy="${Math.round(random()*800)}" r="${Math.round(random()*12+3)}"/>`).join('')}</g><path d="M180 770q-55-100-20-170m20 120q45-70 30-110m-30 75q-65-32-70-75M1010 800q50-100 20-180m-10 105q-50-40-50-90" fill="none" stroke="${accent}" stroke-width="8" opacity=".35"/>`;
    }
  } else if (setting === 'forest') {
    landscape = `<polygon points="${mountains(590,120)}" fill="${front}" opacity=".4"/>`;
    landscape += Array.from({length:15},(_,i)=>{
      const x=i*95-30; const h=130+Math.round(random()*200); const y=610+Math.round(random()*100);
      return `<path d="m${x} ${y-h} -65 ${h*.65}h30l-57 ${h*.35}h184l-57-${h*.35}h30Z" fill="${front}" opacity="${i%2?.65:.9}"/><path d="M${x-5} ${y-30}h10v75h-10Z" fill="${front}"/>`;
    }).join('');
    landscape += `<path d="M0 770Q500 610 1200 745V900H0Z" fill="${front}"/><path d="M610 650Q510 770 665 900h140Q620 770 610 650Z" fill="${accent}" opacity=".18"/>`;
  } else if (setting === 'space') {
    landscape = `<circle cx="790" cy="345" r="146" fill="${accent}" opacity=".2"/><ellipse cx="790" cy="345" rx="235" ry="32" fill="none" stroke="${accent}" stroke-width="13" opacity=".3" transform="rotate(-24 790 345)"/><polygon points="${mountains(720,80)}" fill="${front}"/><path d="m225 650 220-65 80 74-300 55Z" fill="${accent}" opacity=".2"/><path d="m288 640 85-113 58 73Z" fill="${front}" stroke="${accent}" stroke-opacity=".3"/>`;
  } else if (setting === 'interior') {
    landscape = `<path d="M110 900V240Q600-90 1090 240V900h-80V260Q600-15 190 260v640Z" fill="${front}"/><path d="M275 720V330Q600 80 925 330v390Z" fill="${front}" opacity=".4"/><path d="M335 700V365Q600 145 865 365v335Z" fill="${sky}"/><path d="M0 750h1200v150H0Z" fill="${front}"/><path d="M600 750 200 900m400-150 400 150M0 820h1200" stroke="${accent}" stroke-opacity=".13"/><path d="M565 365h70v305h-70Z" fill="${front}" opacity=".6"/><circle cx="600" cy="395" r="16" fill="${accent}" opacity=".8"/>`;
  } else if (setting === 'desert') {
    landscape = `<path d="M0 560Q200 450 490 580T1200 540V900H0Z" fill="${accent}" opacity=".2"/><path d="M0 690Q300 490 650 650T1200 610V900H0Z" fill="${front}" opacity=".5"/><path d="M0 770Q600 580 1200 740V900H0Z" fill="${front}"/><path d="m765 590 40-190 45 190Z" fill="${front}"/><path d="M806 390v250" stroke="${accent}" stroke-opacity=".35" stroke-width="3"/>`;
  } else {
    landscape = `<polygon points="${mountains(540,220)}" fill="${accent}" opacity=".13"/><polygon points="${mountains(660,180)}" fill="${front}" opacity=".6"/><path d="M0 750Q300 650 600 750T1200 700V900H0Z" fill="${front}"/><path d="M510 775q120-35 240 0m-190 25h130" fill="none" stroke="${accent}" stroke-opacity=".2" stroke-width="3"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Atmospheric illustration of the current setting"><defs><linearGradient id="scene-sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${front}"/></linearGradient><radialGradient id="scene-glow"><stop stop-color="${accent}" stop-opacity=".28"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><path d="M0 0h1200v900H0Z" fill="url(#scene-sky)"/><ellipse cx="650" cy="380" rx="500" ry="440" fill="url(#scene-glow)"/><g fill="${accent}">${visual.timeOfDay==='day'?'':stars}</g>${setting==='space'?'':`<circle cx="775" cy="300" r="${visual.timeOfDay==='night'?47:65}" fill="${accent}" opacity=".62"/>`}${landscape}</svg>`;
}
