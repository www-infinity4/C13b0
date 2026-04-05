/**
 * Cartoon Prompt Engine — Character Registry
 *
 * Hard-coded visual DNA for every character.  No AI is queried for
 * appearance; every descriptor is a deterministic constant defined here.
 *
 * Usage:
 *   import { characterStyles, INVESTOR_GADGET_DNA, getDNA } from './characters';
 *
 *   const styleString = characterStyles('investor_gadget');
 *   // → '2D hand-drawn cel-shaded animation, sharp angular chin, …'
 */

import { CharacterDNA, Character } from './types';

// ---------------------------------------------------------------------------
// Investor Gadget — Visual DNA (all fields required)
// ---------------------------------------------------------------------------

/**
 * INVESTOR_GADGET_DNA
 *
 * Every hex code, geometry value, and style token is fixed here.
 * The `prompt_descriptor` string is auto-injected into every
 * generated frame prompt so no downstream tool ever needs to "guess"
 * what Investor Gadget looks like.
 */
export const INVESTOR_GADGET_DNA: CharacterDNA = {
  character_id: 'investor_gadget',
  archetype: 'character.investor_gadget.cartoon.v1',
  prompt_descriptor:
    '2D hand-drawn cel-shaded animation, sharp angular chin, ' +
    'gray trench coat (#808080) with metallic buttons, ' +
    'fedora with retractable antenna (cylindrical, chrome, 45-degree taper), ' +
    'yellow gloves (#FFD700), black outline 2px, 2-tone cel shading, ' +
    'consistent silhouette across all frames.',
  coat_hex: '#808080',
  hat_antenna_geometry:
    'cylindrical shaft radius=0.02 height=0.15 normalised-units, ' +
    'chrome finish (#C0C0C0), 45-degree taper tip, ' +
    'retractable telescoping sections=3, collapsed-length=0.05',
  glove_hex: '#FFD700',
  outline_hex: '#000000',
  shading_mode: '2-tone cel',
};

// ---------------------------------------------------------------------------
// Mouse (default archetype — kept for backward compatibility)
// ---------------------------------------------------------------------------

export const MOUSE_DNA: CharacterDNA = {
  character_id: 'mouse_01',
  archetype: 'character.mouse.cartoon.v1',
  prompt_descriptor:
    '2D hand-drawn cel-shaded animation, round ears, long thin tail, ' +
    'light gray fur (#D3D3D3), black outline 2px, 2-tone cel shading.',
  coat_hex: '#D3D3D3',
  hat_antenna_geometry: 'none',
  glove_hex: '#FFFFFF',
  outline_hex: '#000000',
  shading_mode: '2-tone cel',
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const DNA_REGISTRY: Record<string, CharacterDNA> = {
  investor_gadget: INVESTOR_GADGET_DNA,
  mouse_01: MOUSE_DNA,
};

/**
 * Retrieve the CharacterDNA for a character ID.
 * Throws if the character is not registered (fail-fast — no silent fallbacks).
 */
export function getDNA(characterId: string): CharacterDNA {
  const dna = DNA_REGISTRY[characterId];
  if (!dna) {
    throw new Error(
      `CharacterDNA not found for "${characterId}". ` +
        `Register it in cartoon-engine/characters.ts first.`
    );
  }
  return dna;
}

/**
 * characterStyles()
 *
 * Returns the fixed visual descriptor string for a character.
 * This string must be appended to every animation frame prompt —
 * the engine does this automatically via `buildFramePrompt()`.
 *
 * @param characterId  Key from the DNA registry.
 * @returns            Full ComfyUI-ready style descriptor string.
 */
export function characterStyles(characterId: string): string {
  return getDNA(characterId).prompt_descriptor;
}

// ---------------------------------------------------------------------------
// Character archetypes (for use in TileBlueprint.characters)
// ---------------------------------------------------------------------------

export const INVESTOR_GADGET_CHARACTER: Character = {
  id: 'investor_gadget',
  archetype: INVESTOR_GADGET_DNA.archetype,
  consistency_checksum: INVESTOR_GADGET_DNA.prompt_descriptor,
};

export const MOUSE_CHARACTER: Character = {
  id: 'mouse_01',
  archetype: MOUSE_DNA.archetype,
  consistency_checksum: MOUSE_DNA.prompt_descriptor,
};
