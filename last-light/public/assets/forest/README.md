# The River Remembers

This featured 3D scene is built with the project's bundled MIT-licensed Three.js renderer. The world, trees, leaf and bark maps, terrain, water, traveler, camp objects, smoke, embers and sound are generated locally by `public/forest-engine.js` and `public/forest.js`. No external model downloads, AI requests or API keys are required during play.

`river-clearing.jpg` is a browser capture of this actual rendered scene, used for the adventure picker.

`public/forest-rules.js` owns deterministic contact fire, heat propagation, wetness, water range/cost, health, permanent charred trees and endings. The player can contain the fire or abandon the forest; those outcomes are recorded by the local story journal. Each browser keeps its own crossing under `last-light-river-embers-v1`.

The generated-world and illustrated-story pipelines are separate experiences. This fixed showcase demonstrates physical cause and effect; it does not claim to generate arbitrary simulation rules from a prompt.
