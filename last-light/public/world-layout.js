// Bounded, seeded level plans. Curved connections are shared by the renderer and map.
const hash = value => [...String(value)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
export function makeLayout(seed, biome) {
    let state = hash(seed);
    const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const variant = Math.floor(rand() * 3), mirror = rand() > .5 ? 1 : -1;
    const plans = [{ source: [-30, -5], archive: [25, -7], ally: [-19, 19], workshop: [25, 20], sanctum: [1, -43], vault: [-26, -37], relay: [26, -38], exit: [0, 37] }, { source: [-24, -13], archive: [29, 3], ally: [-30, 15], workshop: [16, 22], sanctum: [14, -42], vault: [-25, -39], relay: [32, -35], exit: [-10, 36] }, { source: [-33, 1], archive: [21, -14], ally: [-17, 23], workshop: [29, 16], sanctum: [-9, -42], vault: [-33, -36], relay: [23, -41], exit: [13, 34] }];
    const positions = Object.fromEntries(Object.entries(plans[variant]).map(([id, [x, z]]) => [id, { x: x * mirror + (rand() - .5) * 2, z: z + (rand() - .5) * 2 }]));
    const gate = { x: (variant - 1) * 9 * mirror, z: -25 };
    const nodes = { ...positions, hub: { x: 0, z: 0 }, gate };
    const edges = [['hub', 'ally'], ['ally', 'source'], ['source', 'gate'], ['gate', 'vault'], ['vault', 'sanctum'], ['sanctum', 'relay'], ['relay', 'gate'], ['gate', 'archive'], ['archive', 'workshop'], ['workshop', 'exit'], ['exit', 'ally'], ['hub', 'workshop']];
    const paths = edges.map(([a, b], i) => { const p = nodes[a], q = nodes[b], bend = (i % 2 ? 1 : -1) * (3 + rand() * 3); const midpoint = { x: (p.x + q.x) / 2 + (q.z - p.z) / Math.hypot(q.x - p.x, q.z - p.z) * bend, z: (p.z + q.z) / 2 - (q.x - p.x) / Math.hypot(q.x - p.x, q.z - p.z) * bend }; if (a === 'gate' || b === 'gate') {
        const other = a === 'gate' ? q : p;
        midpoint.z = other.z > gate.z ? Math.max(gate.z + 5, midpoint.z) : Math.min(gate.z - 5, midpoint.z);
    } return [{ x: p.x, z: p.z }, midpoint, { x: q.x, z: q.z }]; });
    return { version: 1, variant: ['crescent', 'ravine', 'courtyard'][variant], biome, gate, positions, paths, pattern: rand() > .5 ? [0, 2, 1] : [2, 0, 1] };
}
export function distanceToRoute(x, z, paths) { let best = Infinity; for (const points of paths)
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    } return best; }
