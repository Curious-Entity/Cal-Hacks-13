[简体中文](README_ZH.md) | English

# Unwritten — The next chapter is yours.

**Turn an idea into an adventure. Choose what happens next.**

An AI-powered interactive storytelling game built for **Cal Hacks 13.0**.

Unwritten turns your ideas into interactive stories and playable 3D worlds. Explore, make choices, and shape what happens next. The next chapter is yours.

## Features

- **Explorable 3D Worlds:** Describe a setting, then explore with WASD, inspect landmarks, and change the world through actions.
- **Custom World Creation:** Describe a setting, character, and story premise; choose presets or type your own mood and art direction.
- **AI-Powered Storytelling:** Generate new scenes dynamically using Gemini.
- **Meaningful Choices:** Each decision shapes what happens next.
- **Story Memory:** Carry important events, character relationships, and decisions into future scenes.
- **Five-Scene Adventures:** Experience a complete interactive story with a conclusion.
- **Save & Resume:** Continue your adventure across browser sessions.
- **Scene Exploration:** Click objects to reveal clues that influence the next scene.
- **Interactive Visuals:** Atmospheric artwork, Cloudflare scene illustrations with optional OpenAI/Gemini providers, and the original train demo.

## Try Unwritten

[Open Unwritten](https://last-light-calhacks-thirteen.awaregoat514.chatgpt.site/adventure.html?create=1). Generate an adventure from your own idea, or explore the clearly labeled prepared train and forest examples.

## Repository layout

The app is named **Unwritten**. The `last-light/` source directory, existing browser-save identifiers, and hosted URL are retained for compatibility with existing checkouts and saved adventures.

## Getting Started

Clone the repository, create your local configuration, and start the app:

```bash
git clone https://github.com/Curious-Entity/Cal-Hacks-13.git
cd Cal-Hacks-13
cp last-light/.env.example last-light/.env
# Open last-light/.env in your editor and add your own API keys.
python3 last-light/run.py
```

Open the local URL printed in your terminal.

Set `GEMINI_API_KEY` for story generation. For free-tier images, set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; the template selects `IMAGE_PROVIDER=cloudflare`. Use Cloudflare’s Workers Free plan so the daily limit stops requests without paid overage. Keys stay in your ignored `.env`; the committed `.env.example` is blank. The launcher creates `.env` automatically if you skip the copy step. No npm install or production build is needed for local play. Python 3.12+ is recommended; alternatively use Node.js 22.13+ with `cd last-light && node server.mjs`.

## Story providers and language

Illustrated adventures support Gemini or Cloudflare Workers AI for text generation and an English / 简体中文 language selector. Set `TEXT_PROVIDER=gemini` with your Gemini key, or `TEXT_PROVIDER=cloudflare` with your Cloudflare credentials. Custom 3D worlds currently use Gemini. See the full README for provider setup and language behavior.

## Documentation

**[View the full README](last-light/README.md)**

The full documentation covers setup, gameplay, story generation, memory, testing, and implementation details.

## Built at Cal Hacks 13.0

October 23–25, 2026 · San Francisco, California

*The next chapter is yours.*
