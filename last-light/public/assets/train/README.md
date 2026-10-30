# The Westbound Limited artwork

Created with the built-in image_gen tool for the featured illustrated train adventure. All six final images are 1536 × 1024 JPEGs, encoded from the generated PNGs for web delivery.

- `carriage-arrival.jpg`: detailed carriage, Mara, Eli, face-down photograph, radio and red brake.
- `carriage-collected.jpg`: the same carriage after the photograph is picked up; the app composites only its tabletop patch.
- `station-photograph.jpg`: the actual three-person keepsake shown in the photograph viewer.
- `radio-compartment.jpg`: chapter 3 dispatch desk, radio, route chart, and Eli, generated using the original carriage as a character/style reference.
- `vestibule-before-dawn.jpg`: chapter 4 Mara at the carriage door, cream ticket, luggage shelf, and red brake, using the same reference.
- `platform-dawn.jpg`: a matching dawn arrival, compatible with either a shared or a solitary ending.

The exact final prompt set and generation/edit operations are recorded in [prompts.json](prompts.json). Character and style references use the arrival illustration. The photograph's reverse is live HTML so its handwriting is legible at every display size.

`public/train-scene.js` owns the measured prop/character hit areas and window masks. `public/train.css` preserves the painting's aspect ratio and animates only the clipped exterior and subtle atmospheric details. Motion can be paused and respects reduced-motion preferences. This curated sample uses bundled assets; custom generations retain their own provider pipeline.
