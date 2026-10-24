
# Last Light — AI Interactive Storytelling

**Create a world. Make a choice. Change the story.**

Last Light is an AI-powered interactive storytelling project built for Cal Hacks 13.0.

Our goal is to let users create their own fictional worlds, become characters within those worlds, and experience stories that evolve dynamically based on their decisions.

Unlike traditional interactive fiction with predefined story branches, Last Light aims to combine generative AI, persistent story memory, and player-driven actions to create personalized narratives with meaningful consequences.

## Demo

### Current Playable Prototype

The current prototype is a playable, scripted interactive story set aboard a mysterious night train.

To run it locally, navigate to the repository root:

```bash
python3 -m http.server 8000 --directory last-light/dist
```

Open http://localhost:8000 in your browser.

No API key or additional installation is required for the current prototype.

### Public Demo

Public demo URL: Coming soon.

The existing prototype will remain available as a baseline while AI-powered storytelling features are developed.

## Core Concept

Last Light transforms a simple user prompt into an interactive fictional world.

The intended experience follows five steps:

1. **World Generation** — Users describe the world they want to explore.
2. **Character Creation** — AI generates characters, relationships, and a central conflict.
3. **Interactive Storytelling** — Players influence the narrative through choices and free-text actions.
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

## Planned AI Architecture

The intended AI storytelling pipeline is:

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
Player Choice / Free-Text Action
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

The existing playable prototype includes:

- A custom illustrated 2D train environment
- Three scripted story chapters
- Interactive characters and objects
- Twelve main decision paths
- Three predefined endings
- Character trust and relationship tracking
- Persistent event memory
- Browser-based save and resume
- Responsive layout and keyboard-accessible controls
- Optional locally generated ambient audio

The current story is authored in JavaScript and does not yet use a language model.

The scripted implementation provides a working baseline for developing and testing the AI-powered version.

## Planned MVP Features

The following features are development goals and are not yet part of the current scripted prototype:

- User-defined world prompts
- AI-generated world settings and characters
- AI-generated story chapters
- Free-text player actions
- Dynamic narrative progression
- Consistency checks against world rules
- AI-generated endings based on accumulated decisions

The team will prioritize a complete, reliable end-to-end experience over additional visual effects or unnecessary complexity.

## Project Structure

```text
Cal-Hacks-13/
├── README.md
└── last-light/
    ├── README.md
    ├── package.json
    ├── dist/
    │   ├── index.html
    │   ├── styles.css
    │   ├── app.js
    │   ├── story.js
    │   └── carriage.svg
    └── tests/
        └── story.test.js
```

This structure describes the existing scripted prototype. Additional server and AI integration files may be introduced during development.

## Getting Started

### Run the Prototype

From the repository root:

```bash
python3 -m http.server 8000 --directory last-light/dist
```

Then open:

http://localhost:8000

Press `Ctrl+C` to stop the local server.

### Run Tests

Navigate to the application directory:

```bash
cd last-light
npm test
```

The existing automated tests cover:

- Main story paths and endings
- Memory persistence
- Radio interactions
- Character relationships
- Invalid actions and saved states

These tests cover the scripted prototype, not future AI-generated content.

## Technology Stack

### Current Prototype

- HTML
- CSS
- JavaScript
- Node.js built-in test runner
- Browser localStorage
- SVG illustrations

### Planned AI Integration

- LLM API (Gemini, Claude, or another available provider)
- Server-side model integration
- Structured JSON responses
- Persistent world and story state
- AI narrative generation and validation

API keys must remain on the server and must never be embedded in frontend JavaScript.

## Development Priorities

1. Preserve a working interactive prototype.
2. Integrate dynamic AI story generation.
3. Support user-created worlds.
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
