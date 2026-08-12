export type MachineCategory =
  | 'core' | 'terminal' | 'brain' | 'vector' | 'visualizer'
  | 'storage' | 'portal' | 'agent' | 'archive' | 'nursery';

export type MachineLayer = 'base' | 'octave2' | 'archive' | 'nursery' | 'experimental';
export type MachineStatus = 'active' | 'partial' | 'archived' | 'recovery-pending';

export type MachineManifest = {
  machineId: string;
  title: string;
  role: string;
  category: MachineCategory;
  octave: MachineLayer;
  status: MachineStatus;
  capabilities: string[];
  mounts: string[];
  provenance: string[];
  confidence: number;
};

const pendingLetter = (letter: string): MachineManifest => ({
  machineId: letter,
  title: `${letter.toUpperCase()} Machine`,
  role: 'Alphabet-chain role requires repository and conversation recovery',
  category: 'nursery',
  octave: 'base',
  status: 'recovery-pending',
  capabilities: [],
  mounts: ['crown-index'],
  provenance: ['A–Z Termux repository chain'],
  confidence: 0.25,
});

export const alphabetMachines: MachineManifest[] = 'abcdefghijklmnopqrstuvwxyz'
  .split('')
  .map(pendingLetter)
  .map(machine => {
    const recovered: Record<string, Partial<MachineManifest>> = {
      i: {
        title: 'Input Terminal', role: 'Receives operator input and machine commands',
        category: 'terminal', status: 'partial', confidence: .95,
        capabilities: ['input', 'command-routing'],
      },
      j: {
        title: 'Output / Octave UI Spine', role: 'Presents machine output and shared Octave identity UI',
        category: 'terminal', status: 'partial', confidence: .95,
        capabilities: ['output', 'interface', 'identity', 'octave-ui'],
      },
      k: {
        title: 'Quantum Portal', role: 'Routes quantum, geometry, vector, and visualizer experiences',
        category: 'portal', status: 'partial', confidence: .95,
        capabilities: ['quantum-portal', 'visualizer-routing', 'geometry'],
      },
      o: {
        title: 'ResearchBand / Token Builder', role: 'Research and token-building module mounted into the UI spine',
        category: 'agent', status: 'partial', confidence: .72,
        capabilities: ['research', 'token-builder'],
      },
      v: {
        title: 'V Machine', role: 'Existing alphabet repository; exact role still requires inspection',
        category: 'vector', status: 'recovery-pending', confidence: .45,
      },
      y: {
        title: 'Y Machine', role: 'Existing alphabet repository; exact role still requires inspection',
        status: 'recovery-pending', confidence: .45,
      },
      z: {
        title: 'Storage Machine', role: 'Durable tokens, raw records, pages, users, logs, zipcoins, vectors, and history',
        category: 'storage', status: 'partial', confidence: .98,
        capabilities: ['storage', 'history', 'logs', 'vectors', 'tokens', 'pages'],
      },
    };
    return { ...machine, ...(recovered[machine.machineId] || {}) };
  });

export const coreMachines: MachineManifest[] = [
  {
    machineId: 'mongoose.os', title: 'Mongoose.OS', role: 'Hub, spine, carts, workers, and orchestration',
    category: 'core', octave: 'base', status: 'partial', confidence: 1,
    capabilities: ['orchestration','carts','workers','agents','command-routing'],
    mounts: ['crown-index','infinity-treasury','infinity-portal'],
    provenance: ['MACHINE_OS_ARCHITECTURE','Mongoose cart inventory'],
  },
  {
    machineId: 'osprey-5.1', title: 'Osprey 5.1', role: 'Infinity Portal and brain interface lineage',
    category: 'portal', octave: 'base', status: 'partial', confidence: .9,
    capabilities: ['portal','brain.js','memory-flow','response-flow','memory-visualization'],
    mounts: ['mongoose.os','infinity-portal'],
    provenance: ['Osprey 5.1 conversation checkpoint'],
  },
  {
    machineId: 'crown-index', title: 'Crown Index', role: 'Discovery, identity, ranking, provenance, and routing registry',
    category: 'core', octave: 'base', status: 'partial', confidence: 1,
    capabilities: ['search','ranking','provenance','site-builder-input','machine-discovery'],
    mounts: ['mongoose.os','infinity-treasury','starquest'],
    provenance: ['Crown Index conversation recovery'],
  },
  {
    machineId: 'vector-api', title: 'Vector API', role: 'Vector, graph, map, and field exchange layer',
    category: 'vector', octave: 'base', status: 'recovery-pending', confidence: .75,
    capabilities: ['vectors','graphs','maps','field-data'],
    mounts: ['k','crown-index'],
    provenance: ['Repository list conversation'],
  },
];

export const agents: MachineManifest[] = [
  ['orchestrator','Coordinates jobs and machines'],
  ['research-agent','Searches sources and generates evidence records'],
  ['builder-agent','Constructs pages, tools, and experiences'],
  ['token-manager','Builds token and sale records'],
  ['code-review-agent','Audits security and implementation standards'],
].map(([machineId, role]) => ({
  machineId, title: machineId.split('-').map(v => v[0].toUpperCase()+v.slice(1)).join(' '), role,
  category: 'agent' as const, octave: 'base' as const, status: 'partial' as const, confidence: .92,
  capabilities: [machineId], mounts: ['mongoose.os','crown-index'], provenance: ['MULTI_AGENT_README'],
}));

export const visualizerMachines: MachineManifest[] = [
  ['quantum-exchange','Quantum Exchange Visualizer'],
  ['atomic-stack','Atomic Stack Visualizer'],
  ['vector-field','Vector and Field Visualizer'],
  ['space-map','Space and Orbital Visualizer'],
  ['site-world-3d','3D World of Internet Sites'],
  ['brain-graph','Brain Node Graph'],
  ['memory-visualizer','Memory Flow Visualizer'],
  ['geometry-navigator','Alpha–Beta–Gamma Geometry Navigator'],
  ['sensor-dashboard','Sensor and Signal Dashboard'],
].map(([machineId, title]) => ({
  machineId, title, role: title,
  category: 'visualizer' as const, octave: 'base' as const, status: 'recovery-pending' as const,
  confidence: .68, capabilities: [machineId,'visualization'], mounts: ['k','crown-index'],
  provenance: ['Conversation recovery','Resonant OS roadmap'],
}));

export const machineRegistry = [...coreMachines, ...alphabetMachines, ...agents, ...visualizerMachines];
