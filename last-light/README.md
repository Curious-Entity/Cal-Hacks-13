# Last Light

Describe a world, a character, and any story details. Last Light creates a five-scene choose-your-own-adventure **one scene at a time**. Each decision shapes the next scene and is remembered in the journal.

## Start the app

From the Cal-Hacks-13 repository root:

```sh
python3 last-light/run.py
```

Open the **localhost URL printed in the terminal**. Leave the terminal running; stop with **Ctrl+C**. If port 8000 is already occupied, the launcher chooses the next available port. It works from any directory when you pass the full path to `run.py`.

The launcher uses Node.js 22+ for the backend. If Node is missing, it downloads a verified Node 22 runtime from nodejs.org into your user cache; there is no global installation and no npm install needed for local play.

**The old `python3 -m http.server` command serves static files only. Use `run.py` for the generated adventure.**

## Connect Gemini

Create `last-light/.env` using `.env.example` if the file does not already exist, then fill in:

```dotenv
GEMINI_API_KEY=your_key_here
ENABLE_IMAGE_GENERATION=false
```

`.env` is ignored by Git. The server reads changes on each request, so adding or changing a key does not require a restart. Never paste a real key into HTML, browser JavaScript, a commit, or a screenshot.

The default text model is `gemini-3.5-flash-lite`; override with `GEMINI_TEXT_MODEL` if needed. Free-tier access and quotas depend on your Google project and model. Check the project's active limits in Google AI Studio. Rate-limit errors preserve the existing scene and offer an explicit retry.

## Visuals and API usage

Every generated scene includes an atmospheric vector illustration, composed from the model's setting and color parameters. Supported visual families include oceans, cities, forests, space, deserts, mountains, and interiors. These are procedural illustrations, not AI-generated bitmap images.

Optional AI bitmap illustrations use `gemini-nano-banana-2.1` (override with `GEMINI_IMAGE_MODEL`). They require appropriate image-model access and are disabled by default. To enable them, set `ENABLE_IMAGE_GENERATION=true`, then select the illustration checkbox when creating an adventure. The app makes one separate image request for the current scene, without blocking the story. The first image can serve as a continuity reference for later scenes.

- One text-generation request creates the opening scene.
- Each selected choice generates only its next scene, ending at scene five.
- Alternative branches and future scenes are not generated in advance.
- Images are stored separately in IndexedDB; reloading does not automatically regenerate them.
- Duplicate requests reuse a five-minute, in-process response cache when available. This cache is not durable across server restarts or hosted isolates.

## Files you can edit

- `public/adventure.html`: the premise textbox, character input, optional details, tone/style controls, and game layout.
- `public/adventure.css`: styling for the setup screen and generated adventure.
- `public/styles.css`: shared theme, colors, dialogs, and base scene styling.
- `public/adventure.js`: frontend events, loading/retry, journal, save/resume, and image storage.
- `public/scene-art.js`: the atmospheric vector illustrations.
- `backend/adventure.js`: Gemini requests, response validation, memory, signed journeys, and legal-choice checks.
- `server.mjs`: the dependency-free local HTTP server; serves only `public/` and the API endpoints.
- `public/sample.html`, `public/story.js`, `public/app.js`: the original scripted train demo, still available through “Try the train demo.”

Keep HTML IDs when editing the layout: the JavaScript uses them to connect the controls.

## Memory and saves

Journeys are signed on the server and expire after seven days. The browser saves the current scene and signed journey in localStorage. A rolling summary, established facts, stable character identities, and prior decisions accompany each next-scene request. The journal shows decisions, relationships, and discovered facts.

The model is responsible for narrative continuity; schema validation cannot guarantee that every sentence is consistent. Failed requests leave the previous scene intact. No database, account system, or arbitrary code generation is involved. An optional `STORY_SESSION_SECRET` keeps saved journeys valid when rotating the Gemini key.

## Tests

```sh
python3 last-light/run.py --test
```

The tests mock the model and consume no API quota. They check five-scene progression, selected-choice memory, duplicate requests, tampered saves, invalid model output, missing credentials, quota recovery, opt-in illustrations, and the original train demo’s twelve paths.

## Private hosting

The private Sites demo keeps the same project ID in `.openai/hosting.json`. Its runtime secret configuration is separate from the local `.env` file. The hosted Worker uses the same `backend/adventure.js` handler as the local server. Vinext serves the static `public/` interface; built output lives in ignored `dist/`.

For hosting changes, install the supplied starter dependencies and run the Sites build/package workflow. Never publish `.env` files or credentials in the build archive.
