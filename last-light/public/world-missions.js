import { CHALLENGES, challengePattern } from './world-challenges.js';
const SYMBOLS = ['SUN', 'WAVE', 'LEAF'], COLORS = ['#ffce73', '#75d9ed', '#b2e282'];
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function createMissionSystem(c) {
    const { THREE, world, root, material, mesh, box, sphere, height, avatar, characters } = c;
    const enabled = world.playMode === 'active', tasks = new Map(), saved = c.saved || {}, textures = [], groups = [], held = new THREE.Group();
    root.add(held);
    sphere(held, .4, material('#8de9ed', true), 0, 0, 0);
    const heldRing = mesh(held, new THREE.TorusGeometry(.6, .06, 10, 24), material('#e8edc0'));
    heldRing.rotation.x = .6;
    let state = null, available = new Map(), lastHint = '', followerTask = null, clock = 0, locked = false;
    const point = (x, z) => ({ x, z });
    function anchor(id) {
        const rule = CHALLENGES[id];
        const p = world.landmarks.find(p => p.id === (({
            stabilize_source: 'source', rescue_ally: 'ally', retrieve_records: 'archive', scavenge_tools: 'workshop', draw_power: 'source', repair_machinery: 'workshop', decode_signal: 'archive', trace_missing: 'ally', open_vault: 'vault', retrieve_relic: 'vault', activate_relay: 'relay', repair_source: 'source', open_sanctum: 'sanctum', study_consequence: 'sanctum', restore_world: 'exit', escape_world: 'exit', bind_pact: 'exit', send_rescue_signal: 'relay'
        })[id]));
        if (id === 'make_promise')
            return point(0, 0);
        if (id === 'raise_bridge')
            return point(world.layout.gate.x, world.layout.gate.z + 5);
        if (rule.kind === 'ending')
            return point(p.x + ({ restore_world: -7, escape_world: 0, bind_pact: 7 })[id], p.z + 6);
        if (['power', 'defend'].includes(rule.kind))
            return point(p.x, p.z + 9);
        return point(p.x, p.z);
    }
    function board(group, text, x, y, z, color = '#e8efda', size = 7) { const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#10232ce8'; ctx.fillRect(0, 0, 1024, 160); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 1018, 154); ctx.fillStyle = color; ctx.font = 'bold 35px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 80, 980); const t = new THREE.CanvasTexture(canvas); textures.push(t); const m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }), s = new THREE.Sprite(m); s.scale.set(size, size / 6.4, 1); s.position.set(x, y, z); group.add(s); return s; }
    function marker(group, x, z, index, color = COLORS[index % 3], elevated = false) {
        const y = height(x, z);
        const mat = material(color, true), orb = mesh(group, new THREE.IcosahedronGeometry(.38, 1), mat, x, y + (elevated ? 2.9 : 1.0), z);
        const ring = mesh(group, new THREE.TorusGeometry(elevated ? .65 : .8, .07, 10, 32), mat, x, y + .12, z);
        ring.rotation.x = Math.PI / 2;
        if (elevated)
            box(group, 1.7, .3, 1.7, material(world.palette.structure), x, y + .15, z);
        return { x, z, orb, ring, index, base: orb.position.y };
    }
    function build(id, rule) {
        const group = new THREE.Group();
        root.add(group);
        groups.push(group);
        const a = anchor(id), p = { collected: [], sequence: [], timer: 0, seconds: 0, dodges: 0, started: false, distance: 0, ...saved[id] }, task = { id, rule, group, anchor: a, p, markers: [], lastPad: p.lastPad ?? -1 };
        if (['power', 'platform', 'risky', 'trail'].includes(rule.kind)) {
            for (let i = 0; i < 3; i++) {
                let x = a.x + (i - 1) * 5, z = a.z + 5;
                if (rule.kind === 'power') {
                    x = a.x + (i - 1) * 5;
                    z = a.z - 3;
                }
                if (rule.kind === 'platform') {
                    x = a.x + Math.sin(i * 2.1) * 5;
                    z = a.z + Math.cos(i * 2.1) * 5;
                }
                if (rule.kind === 'risky') {
                    x = a.x - 9 + (i % 2);
                    z = a.z - 4 + i * 3;
                }
                if (rule.kind === 'trail') {
                    const gate = world.layout.gate, t = (i + 1) / 4;
                    x = a.x + (gate.x - a.x) * t;
                    z = a.z + (gate.z + 6 - a.z) * t;
                }
                task.markers.push(marker(group, x, z, i, rule.kind === 'risky' ? '#fa6c70' : COLORS[i], ['power', 'platform'].includes(rule.kind)));
            }
            if (rule.kind === 'risky')
                board(group, 'UNSTABLE SHORTCUT · PACT LOST', a.x - 9, height(a.x - 9, a.z) + 3.8, a.z, '#fa9393', 9);
        }
        if (['pattern', 'circuit'].includes(rule.kind)) {
            const order = challengePattern(id, world);
            board(group, order.map(i => SYMBOLS[i]).join('  →  '), a.x, height(a.x, a.z) + 4.5, a.z + 5);
            for (let i = 0; i < 3; i++) {
                const x = a.x + (i - 1) * 4.5, z = a.z + 7, pad = marker(group, x, z, i);
                pad.orb.visible = false;
                box(group, 2.5, .18, 2.5, material(COLORS[i]), x, height(x, z) + .1, z);
                board(group, SYMBOLS[i], x, height(x, z) + 1.3, z, COLORS[i], 2.7);
                task.markers.push(pad);
            }
        }
        if (['power', 'defend'].includes(rule.kind)) {
            const mat = new THREE.MeshBasicMaterial({ color: '#74e4ef', transparent: true, opacity: .55, side: THREE.DoubleSide });
            task.wave = mesh(group, new THREE.RingGeometry(.95, 1.04, 64), mat, a.x, height(a.x, a.z) + .14, a.z);
            task.wave.geometry.rotateX(-Math.PI/2);task.wave.position.set(a.x,0,a.z);task.wave.userData.base=new Float32Array(task.wave.geometry.attributes.position.array);task.wave.frustumCulled=false;
            task.socket = mesh(group, new THREE.TorusGeometry(1.2, .18, 12, 32), material('#8de9ed', true), a.x, height(a.x, a.z) + .22, a.z);
            task.socket.rotation.x = Math.PI / 2;
            board(group, rule.kind === 'power' ? 'CELL SOCKET · COLLECT 3 BLUE CELLS' : 'STARTUP ZONE · JUMP THE WAVES', a.x, height(a.x, a.z) + 3.2, a.z, '#b5e8dd', 9);
        }
        if (rule.kind === 'pickup') {
            const offsets = id === 'scavenge_tools' ? [5, -3] : [0, 5];
            task.markers.push(marker(group, a.x + offsets[0], a.z + offsets[1], 0, '#ead79b'));
            board(group, id === 'retrieve_relic' ? 'RELIC' : id === 'retrieve_records' ? 'LOOSE RECORDS' : 'TOOLKIT', a.x + offsets[0], height(a.x, a.z) + 2.7, a.z + offsets[1], '#ead79b', 4);
        }
        if (rule.kind === 'ending') {
            const color = { restore_world: '#9ae5ad', escape_world: '#ffc76f', bind_pact: '#c49cff' }[id], mat = material(color, true);
            const arch = mesh(group, new THREE.TorusGeometry(2.1, .18, 12, 48), mat, a.x, height(a.x, a.z) + 2.3, a.z);
            task.lockBar = box(group, 4, .16, .2, material('#ee8b91', true), a.x, height(a.x,a.z)+1.8, a.z);task.lockBar.rotation.z=.6;
            task.veil = mesh(group, new THREE.CircleGeometry(1.9, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .18 }), a.x, height(a.x, a.z) + 2.3, a.z);
            board(group, { restore_world: 'RESTORE · SPEND THE RELIC', escape_world: 'ESCAPE · KEEP THE RELIC', bind_pact: 'PACT · LEAVE TOGETHER' }[id], a.x, height(a.x, a.z) + 5.3, a.z, color, 7);
        }
        if (rule.kind === 'escort') {
            task.guards = [];
            const npc = world.characters[0];
            board(group, 'ESCORT · ' + npc.name.toUpperCase(), a.x, height(a.x, a.z) + 3.6, a.z, '#bdecb7', 5);
            for (let i = 0; i < 2; i++) {
                const orb = sphere(group, .5, material('#ef946d', true), 0, 1, 0);
                task.guards.push(orb);
            }
        }
        task.group.visible = false;
        tasks.set(id, task);
    }
    if (enabled)
        for (const [id, rule] of Object.entries(CHALLENGES))
            build(id, rule);
    function complete(t, evidence) { if (t.p.done || locked)
        return; t.p.done = true; locked = true; c.onComplete?.({ actionId: t.id, challenge: { kind: t.rule.kind, ...evidence } }); }
    function setState(next) { state = next; available = new Map(next.beat.actions.map(a => [a.id, a])); locked = [...tasks.values()].some(t => t.p.done && available.has(t.id)); for (const t of tasks.values()) {
        const live = available.has(t.id);
        t.group.visible = live || (t.rule.kind === 'ending' && !next.beat.isEnding && next.campaign.flags.includes('truth_known'));
        if (t.veil){t.veil.material.opacity = live ? .4 : .07;t.lockBar.visible=!live;}
        if (!live && followerTask === t)
            followerTask = null;
        if (live && t.rule.kind === 'escort' && t.p.started && !t.p.done) {
            followerTask = t;
            if (t.p.npc && !t.restored) {
                const npc = characters.get(world.characters[0].id).group;
                npc.position.set(t.p.npc.x, height(t.p.npc.x, t.p.npc.z), t.p.npc.z);
                t.restored = true;
            }
        }
    } }
    function emitHint(text, progress = 0) { if (text !== lastHint) {
        lastHint = text;
        c.onTask?.(text, progress);
    }
    else
        c.onTaskProgress?.(progress); }
    function tick(dt, jumpHeight) {
        if (!enabled || !state)
            return;
        clock += dt;
        const player = avatar.position;
        let closest = null, best = Infinity;
        held.visible = false;
        for (const t of tasks.values()) {
            if (!available.has(t.id) || t.p.done)
                continue;
            for (const child of t.group.children)
                if (child.isSprite)
                    child.visible = distance(player, child.position) < 20;
            const { p, rule, anchor: a } = t;
            let near = distance(player, a);
            for (const m of t.markers)
                if (!p.collected.includes(m.index))
                    near = Math.min(near, distance(player, m));
            if (near < best) {
                best = near;
                closest = t;
            }
            if (locked || dt === 0)
                continue;
            for (const m of t.markers) {
                if (['pattern', 'circuit'].includes(rule.kind))
                    continue;
                m.orb.visible = !p.collected.includes(m.index);
                m.ring.visible = m.orb.visible;
                m.orb.rotation.y = clock;
                m.orb.position.y = m.base + Math.sin(clock * 2 + m.index) * .12;
                if (distance(player, m) < 1.15 && (!['power', 'platform'].includes(rule.kind) || jumpHeight > .65)) {
                    if (rule.kind === 'pickup') {
                        complete(t, { reached: true });
                        break;
                    }
                    if (!p.collected.includes(m.index)) {
                        p.collected.push(m.index);
                        c.onNotice?.(p.collected.length + '/3 recovered');
                    }
                }
            }
            if (['platform', 'trail', 'risky'].includes(rule.kind) && p.collected.length === 3)
                complete(t, { collected: p.collected });
            if (['pattern', 'circuit'].includes(rule.kind)) {
                const pad = t.markers.find(m => distance(player, m) < 1.25 && jumpHeight < .4), index = pad?.index ?? -1;
                if (index !== t.lastPad && index !== -1) {
                    const order = challengePattern(t.id, world);
                    if (index === order[p.sequence.length]) {
                        p.sequence.push(index);
                        c.onNotice?.('Circuit ' + p.sequence.length + '/3 · ' + SYMBOLS[index]);
                        c.onTone?.(220 + index * 110);
                    }
                    else {
                        p.sequence = [];
                        c.onNotice?.('Wrong symbol. Read the sign and begin again.');
                        c.onTone?.(110);
                    }
                    if (p.sequence.length === 3)
                        complete(t, { sequence: p.sequence });
                }
                t.lastPad = index;
                p.lastPad = index;
                t.markers.forEach(m => m.ring.material.emissiveIntensity = p.sequence.includes(m.index) ? 2 : .3);
            }
            if (['power', 'defend'].includes(rule.kind)) {
                const ready = rule.kind === 'defend' || p.collected.length === 3;
                if (rule.kind === 'power' && ready && !p.started) {
                    held.visible = true;
                    held.position.set(player.x, player.y + 1.5, player.z - .8);
                    held.rotation.y = clock;
                    if (distance(player, a) < 1.7) {
                        p.started = true;
                        c.onNotice?.('Cell inserted. Stay in the circle and jump the expanding waves.');
                    }
                }
                if (rule.kind === 'defend' && !p.started && distance(player, a) < 8) {
                    p.started = true;
                    c.onNotice?.('Startup engaged. Jump as the rings reach you.');
                }
                t.wave.visible = p.started;
                if (p.started) {
                    const old = p.timer;
                    p.timer += dt;
                    const radius = (p.timer % 2.6) / 2.6 * 12, oldRadius = (old % 2.6) / 2.6 * 12, wave = Math.floor(p.timer / 2.6), d = distance(player, a);
                    const vertices=t.wave.geometry.attributes.position,base=t.wave.userData.base;for(let i=0;i<vertices.count;i++){const x=base[i*3]*Math.max(.01,radius),z=base[i*3+2]*Math.max(.01,radius);vertices.setXYZ(i,x,height(a.x+x,a.z+z)+.13,z);}vertices.needsUpdate=true;
                    if (d < 8.5)
                        p.seconds += dt;
                    if (d < 11 && p.waveChecked !== wave && (oldRadius <= d && radius >= d || radius < oldRadius && d < .7)) {
                        p.waveChecked = wave;
                        if (jumpHeight > .65) {
                            p.dodges++;
                            c.onNotice?.('Wave cleared · ' + p.dodges + '/' + rule.jumps);
                        }
                        else {
                            p.seconds = Math.max(0, p.seconds - 1.5);
                            c.onDamage?.(12);
                            c.onNotice?.('The wave hit. Jump as the next ring reaches your feet.');
                        }
                    }
                    if (p.seconds >= rule.seconds && p.dodges >= rule.jumps)
                        complete(t, { collected: p.collected, seconds: p.seconds, dodges: p.dodges });
                }
            }
            if (rule.kind === 'escort') {
                const npc = characters.get(world.characters[0].id).group;
                if (!p.started && distance(player, npc.position) < 3) {
                    p.started = true;
                    p.last = { x: npc.position.x, z: npc.position.z };
                    p.trail = [{ x: player.x, z: player.z }];
                    followerTask = t;
                    c.onNotice?.('Your companion is following. Lead them to the blue safe clearing; stay within 18 steps.');
                }
                t.guards.forEach((g, i) => { g.position.set(a.x * (.35 + i * .3) + Math.sin(clock * 1.1 + i * 2) * 4, height(a.x * .5, a.z * .5) + .9, a.z * (.35 + i * .3) + Math.cos(clock * 1.1 + i * 2) * 3); });
                if (p.started) {
                    followerTask = t;
                    const d = distance(player, npc.position), tail = p.trail.at(-1);
                    if (distance(player, tail) > .7)
                        p.trail.push({ x: player.x, z: player.z });
                    if (p.trail.length > 240)
                        p.trail.shift();
                    const hit = t.guards.some(g => distance(g.position, npc.position) < 1.4);
                    p.invulnerable = Math.max(0, (p.invulnerable || 0) - dt);
                    if (hit && !p.invulnerable) {
                        p.stunned = .9;
                        p.invulnerable = 3;
                    }
                    p.stunned = Math.max(0, (p.stunned || 0) - dt);
                    if (d < 18 && d > 2.2 && !p.stunned) {
                        while (p.trail.length > 1 && distance(npc.position, p.trail[0]) < .9)
                            p.trail.shift();
                        const dest = p.trail[0], length = distance(dest, npc.position), step = Math.min(length, 6.8 * dt), nx = npc.position.x + (dest.x - npc.position.x) / Math.max(.001, length) * step, nz = npc.position.z + (dest.z - npc.position.z) / Math.max(.001, length) * step;
                        if (c.canMove(nx, nz)) {
                            const moved = Math.hypot(nx - npc.position.x, nz - npc.position.z);
                            p.distance += moved;
                            npc.rotation.y = Math.atan2(nx - npc.position.x, nz - npc.position.z);
                            npc.position.set(nx, height(nx, nz), nz);
                        }
                    }
                    p.npc = { x: npc.position.x, z: npc.position.z };
                    if (Math.hypot(npc.position.x, npc.position.z) < 5 && Math.hypot(player.x, player.z) < 5 && p.distance >= 8)
                        complete(t, { rescued: true, distance: p.distance });
                }
            }
            if (rule.kind === 'reveal') {
                const near = distance(player, a) < (t.id === 'make_promise' ? 4 : 5);
                p.seconds = near ? p.seconds + dt : 0;
                if (p.seconds > 2)
                    complete(t, { reached: true });
            }
            if (rule.kind === 'ending') {
                if (distance(player, a) < 4 && player.z < a.z - .8)
                    p.armed = true;
                if (p.armed && Math.abs(player.x - a.x) < 1.5 && player.z > a.z + .7 && player.z < a.z + 3)
                    complete(t, { reached: true });
            }
        }
        if (state.beat.isEnding) {
            emitHint('Your world remembers how you played. Explore its new future.');
            return;
        }
        const sealed=[...tasks.values()].find(t=>t.rule.kind==='ending'&&t.group.visible&&!available.has(t.id)&&distance(player,t.anchor)<4.5);if(sealed){emitHint('PACT SEALED · Rescue early, make a promise in the clearing, restore stable power, and never take the red shortcut.');return;}
        const urgent = tasks.get(available.has('rescue_ally') ? 'rescue_ally' : 'send_rescue_signal');
        if (urgent?.p.started && !urgent.p.done)
            closest = urgent;
        if ((closest && best < 18) || closest?.p.started) {
            const { p, rule } = closest;
            let hint = rule.goal, progress = 0;
            if (rule.kind === 'escort' && p.started) {
                const npc = characters.get(world.characters[0].id).group, d = distance(avatar.position, npc.position);
                hint = p.stunned ? 'Your companion is stunned by a surge. Lead around it when they recover.' : d >= 18 ? 'You left your companion behind. Return until they can follow.' : 'Escort to the BLUE clearing · companion ' + Math.round(d) + ' steps away';
                progress = Math.max(0, 1 - Math.hypot(npc.position.x, npc.position.z) / 35);
            }
            else if (['pattern', 'circuit'].includes(rule.kind)) {
                hint += ' ' + p.sequence.length + '/3';
                progress = p.sequence.length / 3;
            }
            else if (['power', 'defend'].includes(rule.kind) && p.started) {
                hint = 'JUMP THE RINGS · Charge ' + Math.min(100, Math.round(p.seconds / rule.seconds * 100)) + '% · Dodges ' + p.dodges + '/' + rule.jumps;
                progress = Math.min(1, p.seconds / rule.seconds);
            }
            else if (p.collected.length) {
                hint += ' ' + p.collected.length + '/3';
                progress = p.collected.length / 3;
            }
            emitHint(hint, progress);
        }
        else
            emitHint('Follow the winding paths. Start by finding your companion, or jump for the blue cells at the power source.');
    }
    return { setState, tick, blocked:(x,z)=>[...tasks.values()].some(t=>t.rule.kind==='ending'&&t.group.visible&&!available.has(t.id)&&Math.abs(x-t.anchor.x)<2.1&&Math.abs(z-t.anchor.z)<.6), controlsCompanion: () => !!followerTask && available.has(followerTask.id), snapshot: () => Object.fromEntries([...tasks].map(([id, t]) => [id, { ...t.p, trail: t.p.trail?.slice(-180) }])), dispose() { held.removeFromParent(); for (const g of groups)
            g.removeFromParent(); for (const t of textures)
            t.dispose(); } };
}
