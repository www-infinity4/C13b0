# Pixie Pink Edition and Mongoose Helper Carts

## Pixie recovery status

The exact first pink-edition source file was not located in the current conversation/library search or by repository name. The recovered requirements are:

- site identity: **Pixie**;
- restore the first pink visual direction rather than a generic corporate theme;
- app-readable text with no pinch zoom;
- an entertaining central spinner inspired by Bitcoin Crusher or Mario Spin;
- spinner themes may include soap-opera-style glamour, party themes, flowers, fashion, television, prizes, recipes, or other interests selected by the owner;
- real AI helpers for reading, writing, planning, organizing, and building pages;
- C13b0 auto-assembly and autopilot integration;
- preserve owner control, privacy, and approval before publishing or sending anything.

Until the original source is recovered, the implementation must be labeled **Pink Edition Reconstruction** rather than an exact restoration.

## Recovered AI architecture

### Existing central agents

- Orchestrator Agent
- Research Agent
- Builder Agent
- Token Manager Agent
- Code Review Agent
- Rogers AI: warm, conversational, voice/autopilot
- Infinity AI: terse, search-driven, mathematically precise

### Recovered creation flow

```text
idea or task
→ research/read
→ reason and plan
→ write/build
→ review
→ owner approval
→ publish/save/send
```

### Recovered supporting behavior

- local knowledge graph;
- search log;
- confidence/stance progression;
- file reading through browser FileReader;
- page/package export;
- memory snapshots;
- website, token, research, and tool generation;
- repository machines connected through Mongoose.OS.

## Helper-cart set

The following carts formalize the user's requested household and website assistants.

### Reader Cart

Inputs:
- uploaded document;
- web page supplied by the user;
- Crown Index results;
- local project record.

Outputs:
- structured summary;
- names, dates, tasks, and deadlines;
- questions and unclear sections;
- citations/provenance;
- private notes.

The Reader must never claim it read an unseen file.

### Logic Cart

- separates facts, assumptions, requests, and opinions;
- detects contradictions and missing information;
- labels confidence;
- routes unresolved questions back to Reader or Research.

### Reasoning Cart

- combines evidence from Reader, Logic, memory, and Crown Index;
- produces options with reasons;
- records why an option was selected;
- never treats accumulated searches as automatic proof.

### Writer Cart

Modes:
- message;
- invitation;
- announcement;
- shopping list;
- article;
- website copy;
- thank-you note;
- event schedule;
- social post.

All outbound content requires preview and approval.

### Party Planner Cart

- guest list;
- theme;
- invitations;
- food and supplies;
- timeline;
- seating/activity plan;
- reminders;
- budget worksheet;
- weather-aware backup plan when current weather is checked;
- printable and phone views.

### Calendar Cart

- turns approved plans into proposed events;
- checks conflicts before scheduling;
- never invites or modifies a calendar without explicit approval.

### Shopping Cart

- converts plans into categorized lists;
- distinguishes owned, needed, optional, and purchased;
- does not place orders automatically.

### Site Builder Cart

- receives approved copy, images, links, and theme;
- produces a preview;
- checks mobile readability, missing assets, and broken paths;
- routes through Code Review before deployment.

### Auto Assembler Cart

- selects registered components;
- validates their input/output contracts;
- assembles a preview application;
- records every component and version;
- does not overwrite production automatically.

### Autopilot Cart

Autopilot is a supervised workflow runner, not unrestricted autonomy.

Allowed:
- draft;
- organize;
- summarize;
- prepare reminders;
- generate preview builds;
- check files and links.

Requires approval:
- send messages;
- publish;
- spend money;
- change accounts;
- schedule invitations;
- delete or overwrite data.

### Memory Cart

- stores owner-approved preferences;
- keeps private and public memories separate;
- supports view, edit, export, and delete;
- records the source of every saved preference.

### Safety/Review Cart

- scans generated HTML and scripts;
- checks remote dependencies;
- blocks secrets and private keys;
- warns about impersonation, unsupported claims, or unlicensed assets;
- prevents direct public control of physical devices.

## Shared cart contract

```ts
interface CartJob<Input = unknown, Output = unknown> {
  id: string;
  cartId: string;
  requestedBy: string;
  input: Input;
  status: 'queued' | 'reading' | 'reasoning' | 'draft' | 'review' | 'approval-required' | 'complete' | 'failed';
  evidence: string[];
  output?: Output;
  approvals: string[];
  createdAt: string;
  updatedAt: string;
}
```

## Pixie page modules

```text
Pink hero and Pixie name
Spinner / daily delight
Ask Pixie AI
Reader
Writer
Party Planner
Calendar proposals
Lists and shopping
Photos and memories
Site Builder previews
Autopilot activity log
Privacy and approval center
```

## Spinner design

The spinner is a task and entertainment router, not gambling.

Possible wedges:

- Write a note
- Plan a party
- Soap-opera spotlight
- Recipe idea
- Memory of the day
- Photo story
- Call someone
- Make a list
- Surprise theme
- Build a page

The owner can rename, reorder, enable, or remove wedges.

## Implementation rule

Recover the original pink page before claiming exact restoration. The reconstruction may proceed in C13b0 as a preview while repository ownership and final destination are resolved.