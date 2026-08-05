export type RepositoryPriority = 'core' | 'active' | 'preserve';

export type RepositoryInventoryItem = {
  name: string;
  fullName: string;
  url: string;
  realm: string;
  realmId: string;
  priority: RepositoryPriority;
  summary: string;
};

type RepositoryRealmGroup = {
  id: string;
  label: string;
  description: string;
  priority: RepositoryPriority;
  repositories: string[];
};

export const repositoryRealmGroups: RepositoryRealmGroup[] = [
  {
    id: 'core-infinity-platform',
    label: "Core Infinity Platform",
    description: "Core operating systems, portal concepts, unification layers, and primary Infinity platform records.",
    priority: 'core',
    repositories: [
      "C13b0",
      "INFINITY",
      "501",
      "Infinity-Flow",
      "Infinity-Synapses",
      "Unifier",
      "Future-Now",
      "Utopia",
      "Situations",
      "Aces",
      "GP",
    ],
  },
  {
    id: 'git-family-and-repository-infrastructure',
    label: "Git Family and Repository Infrastructure",
    description: "Repository navigation, publishing, mapping, flow, identity, and project-management tools.",
    priority: 'core',
    repositories: [
      "git",
      "Gitpub",
      "Gitpal",
      "Gitpal-",
      "Clone-of-Gitpal",
      "Gitpro",
      "Gitpin",
      "Gitdad",
      "Gitflow",
      "Git-Stream",
      "Gitmap",
      "Gitcoin",
    ],
  },
  {
    id: 'ai-zone-and-knowledge-tools',
    label: "AI Zone and Knowledge Tools",
    description: "AI agents, editing, model experiments, document intelligence, and knowledge-base systems.",
    priority: 'active',
    repositories: [
      "AI-Agent-Knowledge-Base-",
      "AI-Editing-Software",
      "Gemma4-AI-",
      "Gemma-4",
      "Intelligent-Doc",
      "GPT-Vector-Design",
      "C-",
    ],
  },
  {
    id: 'hosting-signals-and-communications',
    label: "Hosting, Signals, and Communications",
    description: "Hosting, hydrogen signal, radio, television, shortwave, and network communication projects.",
    priority: 'active',
    repositories: [
      "Hydrhost",
      "Hosting-service",
      "Hydrogen-Radio",
      "Hydrogen-Digital-TV",
      "Worldwide-Radio",
      "Alien-Radio",
      "Shortwave",
      "Waves-stipulations",
    ],
  },
  {
    id: 'graphics-image-media-and-publishing',
    label: "Graphics, Image, Media, and Publishing",
    description: "Image generation, graphics, cartoons, television data, theater, camera, and document publishing.",
    priority: 'active',
    repositories: [
      "Infinity-Graphics",
      "Image-Generator",
      "Cartoon-Generator",
      "Digitoon",
      "TV-Database",
      "Theater",
      "Camera-app",
      "Docu",
      "Docum",
    ],
  },
  {
    id: 'games-emulation-and-3d-worlds',
    label: "Games, Emulation, and 3D Worlds",
    description: "3D world, arcade, console, emulator, television-inspired, and interactive game projects.",
    priority: 'active',
    repositories: [
      "3d-world",
      "Mario-spin",
      "Zelda-NES",
      "Michael-Jackson-thriller-8-Bit-NES-Emulator-game",
      "Escape-From-LA-Game",
      "ESCAPE-FROM-NEW-YORK",
      "Pirates-Of-Silicon-Valley-Game",
      "Emulation-Station",
      "Atari",
      "Atari-Clone",
      "-Lynx",
      "Tetris",
      "Warehouse13",
    ],
  },
  {
    id: 'coins-tokens-and-economy',
    label: "Coins, Tokens, and Economy",
    description: "Token, coin, mint, verification, valuation, and research-token assembly projects.",
    priority: 'active',
    repositories: [
      "Bitcoin-Crusher",
      "4-hash-token-system",
      "Mint-For-Infinity",
      "Beyond-Tokens",
      "Bitcoin-Tonight-Coin",
      "Alien-Coin",
      "research-token-assem",
    ],
  },
  {
    id: 'science-and-research',
    label: "Science and Research",
    description: "Element, energy, inertia, magnetism, radiation, earth, time, and materials research records.",
    priority: 'active',
    repositories: [
      "56-16-13-61-15-33-19-23-10-20-30-40-73-elements-",
      "Open-Flaw",
      "Moltnook",
      "Flux-Capacitor",
      "No-Inertia",
      "Zero-Inertia",
      "Time-Machine",
      "Thermite-Earth-Core",
      "Fission",
      "Unthinkable",
      "Ion",
      "Natural-Soil-Radon-EMF",
      "Radiation",
      "Electromagnetism",
      "Memory-Metal",
      "Astrolyzer",
    ],
  },
  {
    id: 'engineering-robotics-and-field-systems',
    label: "Engineering, Robotics, and Field Systems",
    description: "Robotics, actuation, machines, agricultural controls, field systems, and applied engineering.",
    priority: 'active',
    repositories: [
      "R2D2",
      "Actuator",
      "Osprey",
      "Digital-Signal-Weed-Control",
      "Pole-Flipping-Gas-Shells",
      "Rooting-Hormone",
      "Revenge-Of-The-Pith",
      "spawn",
    ],
  },
  {
    id: 'medical-concepts',
    label: "Medical Concepts",
    description: "Medical research and hope-oriented concept records requiring careful evidence labeling.",
    priority: 'active',
    repositories: [
      "Medical-hope",
    ],
  },
  {
    id: 'archive-investigation-and-concept-records',
    label: "Archive, Investigation, and Concept Records",
    description: "Narrative, investigation, social, archive, and early concept repositories preserved without deletion.",
    priority: 'preserve',
    repositories: [
      "Suleman",
      "Giro",
      "Some-Spook",
      "Communist-Cats",
      "Twitter-Users-Turned-Into-Food-Vegetables",
      "Investigate-Bill-Gates-being-Iran-and-under-attack-by-trump-and-I-",
    ],
  },
  {
    id: 'astra-and-audio-systems',
    label: "Astra and Audio Systems",
    description: "Sound-machine, music, frequency, and audio-system projects.",
    priority: 'active',
    repositories: [
      "Astra-Ring-Sound-Machine",
      "Octave",
    ],
  },
];

export const repositoryInventory: RepositoryInventoryItem[] =
  repositoryRealmGroups.flatMap(group =>
    group.repositories.map(name => ({
      name,
      fullName: `www-infinity4/${name}`,
      url: `https://github.com/www-infinity4/${name}`,
      realm: group.label,
      realmId: group.id,
      priority: group.priority,
      summary: `${name} is preserved in the ${group.label} realm. ${group.description}`,
    }))
  );

export const repositoryInventoryCount = repositoryInventory.length;
