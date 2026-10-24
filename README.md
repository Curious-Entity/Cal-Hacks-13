# Last Light — AI Interactive Storytelling

**Create a world. Make a choice. Change the story.**

An AI-powered interactive storytelling game built for **Cal Hacks 13.0**.

Last Light lets players create their own fictional worlds, shape narratives through meaningful choices, and experience personalized adventures that evolve with their decisions.

## Features

- **Custom World Creation:** Describe a setting, character, and story premise.
- **AI-Powered Storytelling:** Generate new scenes dynamically using Gemini.
- **Meaningful Choices:** Each decision shapes what happens next.
- **Story Memory:** Carry important events, character relationships, and decisions into future scenes.
- **Five-Scene Adventures:** Experience a complete interactive story with a conclusion.
- **Save & Resume:** Continue your adventure across browser sessions.
- **Scene Exploration:** Click objects to reveal clues that influence the next scene.
- **Interactive Visuals:** Atmospheric artwork, optional on-demand OpenAI illustrations, and the original train demo.

## Getting Started

Clone the feature branch, create your local configuration, and start the app:

```bash
git clone --branch feature/openai-scene-objects https://github.com/Curious-Entity/Cal-Hacks-13.git
cd Cal-Hacks-13
cp last-light/.env.example last-light/.env
# Open last-light/.env in your editor and add your own API keys.
python3 last-light/run.py
```

Open the local URL printed in your terminal.

Set `GEMINI_API_KEY` for story generation and `OPENAI_API_KEY` for OpenAI illustrations. OpenAI images require API credits and model access. Keys stay in your ignored `.env`; the committed `.env.example` is blank. The launcher creates `.env` automatically if you skip the copy step. No npm install or production build is needed for local play. Python 3.12+ is recommended; alternatively use Node.js 22.13+ with `cd last-light && node server.mjs`.

## Documentation

**[View the full README](last-light/README.md)**

The full documentation covers setup, gameplay, story generation, memory, testing, and implementation details.

## Built at Cal Hacks 13.0

October 23–25, 2026 · San Francisco, California

*Every choice becomes part of your story.*
