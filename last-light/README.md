
# Last Light — AI Interactive Storytelling

**Create a world. Make a choice. Change the story.**

Last Light is an AI-powered interactive storytelling project built for Cal Hacks 13.0.

Our goal is to let users create their own fictional worlds, become characters within those worlds, and experience stories that evolve dynamically based on their decisions.

Unlike traditional interactive fiction with predefined story branches, Last Light aims to combine generative AI, persistent story memory, and player-driven actions to create personalized narratives with meaningful consequences.

## Demo

### Current Playable Prototype

The current app generates a five-scene adventure from your premise, character, tone, and optional world details. Gemini writes only the next scene after your decision. Each scene includes 2–4 inspectable objects with descriptions and clues that carry forward in story memory.

To use your own keys, clone this branch and create a local configuration:

```bash
git clone --branch feature/generated-3d-world https://github.com/Curious-Entity/Cal-Hacks-13.git
cd Cal-Hacks-13
cp last-light/.env.example last-light/.env
# Edit last-light/.env locally; add GEMINI_API_KEY, CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_API_TOKEN.
python3 last-light/run.py
```

Open the URL printed in the terminal. The launcher uses a free port between 8000 and 8010 and finds or downloads a verified Node.js runtime if needed. Keep the terminal open while playing. A static Python HTTP server cannot run the AI endpoints.

Use Python 3.12+ for the launcher. No `npm install` or production build is required for local play. If `.env` is missing, the launcher creates it from the blank template without overwriting an existing file. With Node.js 22.13+ installed, you can also run `cd last-light` followed by `node server.mjs`.

`GEMINI_API_KEY` enables live stories. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` enable the default Cloudflare image provider. Each teammate supplies their own keys. In setup, enable AI illustrations, then press **Illustrate this scene** after starting a story. Object interactions work with both the included atmospheric artwork and AI illustrations.

The original scripted train adventure is available at `/sample.html` and needs no API key.

### Hosted Demo

[Open Last Light](https://last-light-calhacks-thirteen.awaregoat514.chatgpt.site). The hosted demo is public and opens without a ChatGPT login. API keys remain on the server.

### Optional AI illustrations

Keep real credentials only in the ignored `.env` file. Never put keys in `.env.example`, browser JavaScript, screenshots, or Git commits.

```dotenv
GEMINI_API_KEY=your_gemini_key
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
IMAGE_PROVIDER=cloudflare
ENABLE_IMAGE_GENERATION=true
OPENAI_IMAGE_USE_REFERENCE=false
```

Cloudflare illustrations default to **Once for every scene** in a fresh setup. Saved image preferences are respected. You can turn images off or select **Only when I ask**, then use **Illustrate this scene**. One image is requested per visited scene; unchosen branches are never illustrated. Images are cached in the browser and reused on reload.

The Cloudflare provider uses `@cf/black-forest-labs/flux-2-klein-4b` at 1024×768. Each adventure keeps its seed, cast descriptions, mood, and art direction. Later scenes reuse the first available scene image as a reference, resized below 512 pixels on both dimensions. This improves visual continuity but cannot guarantee identical character likeness. Choices and clickable objects remain available while images paint.

OpenAI remains available by setting `IMAGE_PROVIDER=openai` and adding `OPENAI_API_KEY`. It uses `gpt-image-2.5-flare`, low quality, one 1024×1024 JPEG per request, and requires OpenAI API credits. Its reference input is off by default; enable it with `OPENAI_IMAGE_USE_REFERENCE=true` if desired. `IMAGE_PROVIDER=gemini` selects the Gemini image provider, subject to that project's image access and quota. See the [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation) for its current options.

The clickable props use a separate SVG foreground layer, so their hit areas remain aligned across screen sizes. Their descriptions and clues arrive with the story; inspecting them makes no additional model or image call.

### Connection errors

A configured key is not proof that Gemini accepts requests. The setup status stays unverified until a story scene succeeds; failed requests show their error instead of claiming the storyteller is ready. Rejected keys, blocked keys, project restrictions, quota limits, and invalid request settings have separate messages.

Local `.env` settings apply only to your local server. The hosted demo uses its own server secrets; replacing a local key does not update the hosted key. The owner must update the hosted secret and deploy the change. If `STORY_SESSION_SECRET` is unset, rotating the Gemini key also invalidates existing signed journeys; start a new adventure. Set a separate stable session secret before creating adventures if future key rotations must preserve them.

### Custom mood and art direction

Choose **Custom…** in either menu to write your own preferences. Story mood accepts up to 240 characters; art direction accepts up to 400. For example: “bittersweet with dry humor” and “gouache on textured paper, amber highlights, indigo shadows.” The draft is saved locally, and these directions are included in every story turn and illustration prompt.

### Free Cloudflare image setup

1. Create a free [Cloudflare account](https://dash.cloudflare.com/).
2. Open **Workers AI → REST API → Create a Workers AI API Token**. The token needs Workers AI Read and Edit permissions scoped to your account.
3. Copy the Account ID and put both values in your ignored `last-light/.env`. Keep the tracked `.env.example` blank.
4. Keep `IMAGE_PROVIDER=cloudflare` and `ENABLE_IMAGE_GENERATION=true`, start the server, and begin an adventure with AI illustrations enabled.

Cloudflare's Workers Free plan provides a shared account allowance of 10,000 Neurons per day. Stay on **Workers Free** to have requests stop at the daily limit instead of creating paid overage. Limits reset at 00:00 UTC. The app handles quota/capacity errors without losing your story and never falls back to a paid image provider. See [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and its [REST token setup guide](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).

Live Cloudflare generation was verified on October 24, 2026; the first test image took about 37 seconds. Latency varies with service capacity. The [official Klein integration example](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/) documents multipart requests and reference inputs. Image descriptions and object clues remain playable while generation runs.

## Explorable 3D world MVP

Choose **Explore a 3D world** on the starting form, describe your setting and protagonist, and keep the existing mood/art-direction controls. Gemini creates a validated world blueprint and its opening quest stage. The browser assembles a compact low-poly level from supported assets; it does not generate arbitrary 3D model files.

- **WASD / arrow keys:** walk; **Shift:** run.
- **Drag:** turn the camera; **scroll:** zoom.
- **F near a landmark:** inspect it and save its clue.
- **E with the landmark panel open:** perform its available story action.
- **J:** open the journal. Touch devices have on-screen movement and interaction controls.

There are four reachable landmarks and five quest stages. Actions change landmark effects, weather, lighting, NPC positions, and relationships. The map and player position persist between turns. Walking, rendering, and repeat inspections make no model calls. A new AI call is needed only for initial creation or a meaningful story action. World state is signed on the server; save/resume and interrupted-action retries use a separate browser save from the illustrated adventure.

Supported environments are forest, city, space, ocean, desert, mountain, and interior. Supported landmark meshes include trees, wells, campfires, portals, cottages, terminals, towers, crystals, archives, and gardens. Model-generated names and descriptions adapt these to the setting. Supporting characters use reusable humanoid, robot, dragon, small-animal, or octopus forms where their descriptions match. Mood and art preferences influence story, palette, and lighting; they do not create arbitrary new meshes or guarantee a requested raster painting style in 3D.

The existing **Illustrated story** mode and original train demo remain available. World creation needs the Gemini server key; 3D rendering does not use the Cloudflare image API.

### Implementation and attribution

`backend/world.js` validates generated blueprints and quest states; `backend/api.js` routes both story modes. `public/world-engine.js` builds and updates the scene, and `public/world.js` handles exploration, journal, saves, and API events. Tests cover the five-stage quest, immutable landmarks, clue memory, duplicate requests, and invalid/tampered actions.

The team's original `make-x20/fantasy-roam` prototype is retained unchanged. Its procedural scenery, WASD movement, and follow-camera approach informed this implementation. Three.js 0.160.1 is vendored locally (with its MIT license in `public/vendor/THREE-LICENSE.txt`) so gameplay does not depend on loading a runtime CDN. The renderer uses reusable geometry and instanced scenery; map generation returns data rather than executable code.

## Core Concept

Last Light transforms a simple user prompt into an interactive fictional world.

The intended experience follows five steps:

1. **World Generation** — Users describe the world they want to explore.
2. **Character Creation** — AI generates characters, relationships, and a central conflict.
3. **Interactive Storytelling** — Players influence the narrative through choices and inspect objects for clues. Free-text actions are a future extension.
4. **Persistent Memory** — Important decisions, events, and world rules carry forward into later chapters.
5. **Dynamic Endings** — The story reaches a coherent ending shaped by the player's previous actions.

## Example Experience

A user enters:

> A magical kingdom where every spell permanently erases one of the caster's memories.

Last Light generates a fictional world with its own history, characters, and rules.

The player encounters a forbidden magical archive and must decide what to do.

Possible actions include:

- Use magic to open the sealed archive.
- Persuade a guard to provide access.
- Search for another entrance.
- Write a custom action.

Each decision may affect future events, character relationships, and the final outcome.

For example, choosing to use magic may open the archive but permanently remove a memory from the protagonist.

The system should remember this consequence and incorporate it into subsequent chapters.

## AI Architecture

The current MVP storytelling pipeline is:

```text
User Prompt
    |
    v
World Generator
    |
    v
World State
    |
    v
Story Engine
    |
    v
Player Choice + Discovered Clues
    |
    v
State & Memory Update
    |
    v
Next Chapter
    |
    v
Dynamic Ending
```

### World Generation

Generate a structured world containing:

- World background and setting
- Important world rules
- Main characters and relationships
- Central conflict
- Story objective

### Dynamic Story Engine

Generate narrative content based on:

- The current chapter
- Established world rules
- Previous player decisions
- Important events and memories
- Character relationships
- The current player action

### Story Memory

Maintain structured state to reduce narrative inconsistencies.

Examples include:

- Important decisions
- Character trust
- Discovered information
- Inventory
- Major world events
- Unresolved conflicts

### Story Progression and Endings

The intended MVP uses a five-chapter structure:

1. Introduction
2. Exploration
3. Conflict
4. Climax
5. Ending

The final chapter should resolve the central conflict using the player's accumulated decisions and world state.

## Current Implementation

The generated adventure includes:

- User-defined premise, protagonist, tone, art style, and optional world details
- Gemini scene generation with validated JSON and a stable supporting cast
- Five scenes, 2–3 choices per turn, and an ending shaped by previous decisions
- 2–4 clickable objects per scene, a discovery journal, and clues in next-scene context
- Atmospheric vector artwork and Cloudflare illustrations and optional OpenAI/Gemini providers
- Signed story state, browser save/resume, and retryable API errors
- Responsive layouts and keyboard-accessible controls

The original train demo retains three authored chapters, twelve main decision paths, three endings, character relationships, and optional ambient audio.

## Planned MVP Extensions

Free-text player actions, deeper inventory mechanics, and stronger consistency checks remain development goals. The current MVP uses generated choice buttons rather than arbitrary actions.

## Project Structure

```text
Cal-Hacks-13/
├── README.md
└── last-light/
    ├── run.py                  # Local launcher
    ├── server.mjs              # Local HTTP + API server
    ├── backend/                # Shared story, inspection, and image handlers
    ├── public/                 # HTML/CSS/JS, scene art, original train demo
    ├── worker/index.ts         # Hosted API entrypoint
    ├── .env.example            # Placeholder configuration only
    └── tests/                  # Story, API, object, and image tests
```

## Getting Started

Run from the repository root:

```bash
python3 last-light/run.py
```

Open the printed URL. Press `Ctrl+C` to stop. If a port is occupied, the launcher selects another one; `--port 8001` requests a specific port.

### Run Tests

```bash
python3 last-light/run.py --test
```

Tests cover original train paths, generated story progression, signed saves, object inspections and clue memory, image request settings and reuse, invalid output, API errors, and credential-free environment templates. Provider responses are mocked in the automated suite, so tests consume no API credits.

## Technology Stack

### Current Prototype

- HTML
- CSS
- JavaScript
- Node.js built-in test runner
- Browser localStorage
- SVG illustrations

### AI Integration

- Gemini API for structured scene generation
- Cloudflare Workers AI for free-tier scene illustrations with reference images
- Optional OpenAI Images API and Gemini image providers
- Server-side model integration
- Structured JSON responses
- Persistent world and story state
- AI narrative generation and validation

API keys must remain on the server and must never be embedded in frontend JavaScript.

## Development Priorities

1. Preserve a working interactive prototype.
2. Refine dynamic AI story generation.
3. Improve user-created worlds and scene exploration.
4. Add meaningful free-text actions.
5. Maintain story consistency and memory.
6. Generate coherent endings.
7. Test, deploy, and prepare the final demonstration.

## Testing and Reliability

The AI-powered experience should be tested for:

- Successful world generation
- Valid player choices and actions
- Consistency with established world rules
- Correct use of previous story events
- Meaningful consequences
- Coherent narrative endings
- Graceful handling of API errors
- Successful save and resume
- End-to-end functionality in the deployed application

When AI generation fails, the application should provide an appropriate fallback or error message without corrupting the saved story state.

## Cal Hacks 13.0

Developed during Cal Hacks 13.0, October 23–25, 2026, in San Francisco.

### Target Categories

- Most Creative Project
- Most Technically Advanced Hack
- AI-focused sponsor challenges, subject to eligibility and final implementation

## Team

Built by a team of four hackers at Cal Hacks 13.0.

Team member names and contributions will be added before final submission.

## Future Possibilities

Potential extensions include:

- AI-generated character portraits
- World maps
- Voice narration
- Multiplayer storytelling
- More complex NPC memory
- Longer and replayable story campaigns

These features are outside the initial MVP scope.

---

**Last Light — Every choice becomes part of your story.**
