// A small vocabulary of playable mechanics. Browser telemetry is validated for
// shape/completeness; this is a single-player game, not an anti-cheat service.
export const CHALLENGES = {
    stabilize_source: { kind: 'power', goal: 'Jump to collect three blue cells, carry their charge to the socket, then dodge two startup waves.', seconds: 7, jumps: 2 },
    rescue_ally: { kind: 'escort', goal: 'Reach your companion. Lead them back to the safe clearing; stay close and avoid the moving surges.' },
    retrieve_records: { kind: 'pickup', goal: 'Find the loose records inside the archive courtyard.' },
    scavenge_tools: { kind: 'pickup', goal: 'Recover the toolkit from behind the workshop.' },
    draw_power: { kind: 'risky', goal: 'RED ROUTE: cross all three red seals to take unstable power. This permanently closes the pact ending.' },
    repair_machinery: { kind: 'circuit', goal: 'Connect the workshop floor circuit in the order shown on its sign.' },
    decode_signal: { kind: 'pattern', goal: 'Read the archive sign, then walk its three symbols in order. A wrong symbol resets the pattern.' },
    raise_bridge: { kind: 'defend', goal: 'Charge the gate mechanism. Stay in its circle and jump the expanding waves.', seconds: 7, jumps: 2 },
    trace_missing: { kind: 'trail', goal: 'Follow the three traces from camp toward the northern gate.' },
    open_vault: { kind: 'pattern', goal: 'Read the vault clue. Walk the three seals in order while avoiding the guardian.' },
    retrieve_relic: { kind: 'pickup', goal: 'Walk behind the raised vault door and recover the relic.' },
    activate_relay: { kind: 'defend', goal: 'Stay near the relay and jump the expanding energy waves until it powers up.', seconds: 10, jumps: 3 },
    send_rescue_signal: { kind: 'escort', goal: 'Find your stranded companion at the relay. Escort them back to the safe clearing.' },
    repair_source: { kind: 'circuit', goal: 'Reconnect all three repair plates in order to contain the rupture.' },
    open_sanctum: { kind: 'platform', goal: 'Jump through the three orbiting lights to awaken the sanctum.' },
    study_consequence: { kind: 'reveal', goal: 'Enter the awakened chamber and listen to what the relic remembers.' },
    make_promise: { kind: 'reveal', goal: 'Return to your rescued companion in the safe clearing and stand beside them.' },
    restore_world: { kind: 'ending', goal: 'GREEN ARCH: walk through to spend the relic restoring this world.' },
    escape_world: { kind: 'ending', goal: 'AMBER ARCH: walk through to leave with the relic and abandon unfinished repairs.' },
    bind_pact: { kind: 'ending', goal: 'VIOLET ARCH: walk through together to bind a shared future.' },
};
export function challengePattern(id, world) { const pattern = world.layout?.pattern || [0, 2, 1]; return id === 'open_vault' ? [...pattern].reverse() : id === 'repair_machinery' ? [1, 0, 2] : id === 'repair_source' ? [2, 1, 0] : pattern; }
export function validateCompletion(id, value, world) {
    const task = CHALLENGES[id];
    if (!task || !value || value.kind !== task.kind)
        throw Error('Finish the playable objective before advancing the story.');
    const three = values => Array.isArray(values) && values.length === 3 && new Set(values).size === 3 && values.every(v => Number.isInteger(v) && v >= 0 && v < 3);
    if (['power', 'platform', 'trail', 'risky'].includes(task.kind) && !three(value.collected))
        throw Error('Recover all three objective markers.');
    if (['pattern', 'circuit'].includes(task.kind) && JSON.stringify(value.sequence) !== JSON.stringify(challengePattern(id, world)))
        throw Error('The floor pattern is incomplete.');
    if (['defend', 'power'].includes(task.kind) && (!Number.isFinite(value.seconds) || value.seconds < task.seconds || !Number.isInteger(value.dodges) || value.dodges < task.jumps))
        throw Error('Finish charging the mechanism and dodge its energy waves.');
    if (task.kind === 'escort' && (value.rescued !== true || !Number.isFinite(value.distance) || value.distance < 8))
        throw Error('Escort your companion back to the safe clearing.');
    if (['pickup', 'reveal', 'ending'].includes(task.kind) && value.reached !== true)
        throw Error('Reach the objective in the world.');
    return true;
}
