
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
git clone --branch feature/openai-scene-objects https://github.com/Curious-Entity/Cal-Hacks-13.git
cd Cal-Hacks-13
cp last-light/.env.example last-light/.env
# Edit last-light/.env locally; add your own GEMINI_API_KEY and OPENAI_API_KEY.
python3 last-light/run.py
```

Open the URL printed in the terminal. The launcher uses a free port between 8000 and 8010 and finds or downloads a verified Node.js runtime if needed. Keep the terminal open while playing. A static Python HTTP server cannot run the AI endpoints.

Use Python 3.12+ for the launcher. No `npm install` or production build is required for local play. If `.env` is missing, the launcher creates it from the blank template without overwriting an existing file. With Node.js 22.13+ installed, you can also run `cd last-light` followed by `node server.mjs`.

`GEMINI_API_KEY` enables live stories. `OPENAI_API_KEY` enables the selected OpenAI image provider, which also requires API credits and access to the configured image model. Each teammate supplies their own keys. In setup, enable AI illustrations, then press **Illustrate this scene** after starting a story. Object interactions work with both the included atmospheric artwork and AI illustrations.

The original scripted train adventure is available at `/sample.html` and needs no API key.

### Hosted Demo

[Open Last Light](https://last-light-calhacks-thirteen.awaregoat514.chatgpt.site). The hosted demo is currently private to its owner.

### Optional AI illustrations

Keep real credentials only in the ignored `.env` file. Never put keys in `.env.example`, browser JavaScript, screenshots, or Git commits.

```dotenv
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
IMAGE_PROVIDER=openai
ENABLE_IMAGE_GENERATION=true
OPENAI_IMAGE_USE_REFERENCE=false
```

Enable AI illustrations in the setup form. **Only when I ask** is the default: press **Illustrate this scene** when you want an image, or choose one image per scene. OpenAI uses `gpt-image-2.5-flare`, low quality, one 1024×1024 JPEG per request. Images are stored in the browser and reused on reload. Reference-image input is off by default to reduce input cost; it can be enabled with `OPENAI_IMAGE_USE_REFERENCE=true`.

OpenAI API credits are required separately. A missing-credit, access, or rate-limit error leaves the atmospheric artwork, clickable objects, saved story, and decisions available. Add API credits and use **Retry image** when ready. See the [official image guide](https://developers.openai.com/api/docs/guides/image-generation) for current pricing and supported options.

The clickable props use a separate SVG foreground layer, so their hit areas remain aligned across screen sizes. Their descriptions and clues arrive with the story; inspecting them makes no additional model or image call.

### Connection errors

A configured key is not proof that Gemini accepts requests. The setup status stays unverified until a story scene succeeds; failed requests show their error instead of claiming the storyteller is ready. Rejected keys, blocked keys, project restrictions, quota limits, and invalid request settings have separate messages.

Local `.env` settings apply only to your local server. The private hosted demo uses its own server secrets; replacing a local key does not update the hosted key. The owner must update the hosted secret and deploy the change. If `STORY_SESSION_SECRET` is unset, rotating the Gemini key also invalidates existing signed journeys; start a new adventure. Set a separate stable session secret before creating adventures if future key rotations must preserve them.

### Custom mood and art direction

Choose **Custom…** in either menu to write your own preferences. Story mood accepts up to 240 characters; art direction accepts up to 400. For example: “bittersweet with dry humor” and “gouache on textured paper, amber highlights, indigo shadows.” The draft is saved locally, and these directions are included in every story turn and illustration prompt.

### Free image-generation research

Checked October 23, 2026. The strongest free-tier candidate found is **Cloudflare Workers AI with FLUX.2 [klein] 4B**. Cloudflare provides a shared account allowance of 10,000 Neurons per day; on Workers Free, requests stop at the allowance instead of creating paid overage. This is a quota, not unlimited generation or an uptime guarantee. See [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

For visual continuity, generate the first scene, keep the cast descriptions and art direction fixed, and send that first image as a reference for subsequent scenes. Klein 4B supports reference-image editing and reproducible seeds; Cloudflare documents up to four reference images, each smaller than 512×512. Reference reuse should improve continuity, but character likeness still needs visual testing. See the [official model integration example](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/).

Cloudflare requires a free account, its Account ID, and a Workers AI API token. Its [REST setup guide](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) explains token creation. **Cloudflare is a researched next integration, not an image provider currently wired into this app; no live Cloudflare generation has been tested.** The current providers remain OpenAI and Gemini.

Other options reviewed: [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/pricing) currently offers free users $0.10 in monthly credits, subject to change, which is a small experimentation budget. [Pollinations](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md) currently requires authentication for generation and applies account/key budgets; it should not be treated as an unlimited anonymous endpoint.

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
- Atmospheric vector artwork and optional OpenAI or Gemini illustrations
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
- OpenAI Images API for optional low-quality JPEG illustrations (Gemini image provider also supported)
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
