export type PhiSearchCapability = {
  filter: string;
  repo: string;
  purpose: string;
  branch: string;
  inspect: string[];
  browserFirst: boolean;
};

/**
 * Dedicated free/open-source engines selected for the 15 Phi semantic gates.
 * This registry is intentionally separate from visual, game, document, and
 * media capabilities. Search should not pretend an unrelated fork improves
 * relevance simply because it is available.
 */
export const PHI_SEARCH_CAPABILITIES: PhiSearchCapability[] = [
  {
    filter: "entity-lock",
    repo: "winkjs/wink-nlp",
    purpose: "tokenization, entities, part-of-speech and linguistic structure",
    branch: "master",
    inspect: ["README.md", "package.json"],
    browserFirst: true,
  },
  {
    filter: "normalize",
    repo: "winkjs/wink-nlp-utils",
    purpose: "text normalization and token-level NLP utilities",
    branch: "master",
    inspect: ["README.md", "package.json"],
    browserFirst: true,
  },
  {
    filter: "phrase-lock",
    repo: "spencermountain/compromise",
    purpose: "phrase, noun, topic and entity extraction in JavaScript",
    branch: "master",
    inspect: ["README.md", "package.json"],
    browserFirst: true,
  },
  {
    filter: "domain-lock",
    repo: "NaturalNode/natural",
    purpose: "classification, stemming, tokenization and NLP scoring",
    branch: "master",
    inspect: ["README.md", "package.json"],
    browserFirst: false,
  },
  {
    filter: "lexical-coverage",
    repo: "lucaong/minisearch",
    purpose: "small browser-side full-text index with field boosting and relevance ranking",
    branch: "master",
    inspect: ["README.md", "package.json", "src"],
    browserFirst: true,
  },
  {
    filter: "title-anchor",
    repo: "nextapps-de/flexsearch",
    purpose: "fast field-aware browser search and weighted document indexing",
    branch: "master",
    inspect: ["README.md", "package.json", "src"],
    browserFirst: true,
  },
  {
    filter: "fuzzy-repair",
    repo: "krisk/Fuse",
    purpose: "fuzzy matching for misspellings and approximate user terms",
    branch: "main",
    inspect: ["README.md", "package.json", "src"],
    browserFirst: true,
  },
  {
    filter: "negative-gate",
    repo: "leeoniya/uFuzzy",
    purpose: "tight fuzzy matching useful as a reject/accept boundary rather than broad autocomplete",
    branch: "main",
    inspect: ["README.md", "package.json", "src"],
    browserFirst: true,
  },
  {
    filter: "passage-anchor",
    repo: "olivernn/lunr.js",
    purpose: "lexical document ranking, token pipeline and stemming",
    branch: "master",
    inspect: ["README.md", "package.json", "lib"],
    browserFirst: true,
  },
  {
    filter: "task-words",
    repo: "fergiemcdowall/stopword",
    purpose: "stop-word removal extended by Phi with task words such as research, explain and find",
    branch: "main",
    inspect: ["README.md", "package.json", "src"],
    browserFirst: true,
  },
  {
    filter: "spelling-repair",
    repo: "wooorm/nspell",
    purpose: "dictionary-backed spelling correction before entity and phrase resolution",
    branch: "main",
    inspect: ["readme.md", "package.json", "index.js"],
    browserFirst: true,
  },
  {
    filter: "context-gate",
    repo: "retextjs/retext",
    purpose: "composable natural-language processing pipeline for query and context passes",
    branch: "main",
    inspect: ["readme.md", "package.json"],
    browserFirst: true,
  },
  {
    filter: "authority-weight",
    repo: "winkjs/wink-bm25-text-search",
    purpose: "BM25 relevance ranking for source titles and passages",
    branch: "master",
    inspect: ["README.md", "package.json"],
    browserFirst: true,
  },
  {
    filter: "semantic-similarity",
    repo: "huggingface/transformers.js",
    purpose: "browser-side embeddings, classification and transformer inference for semantic reranking",
    branch: "main",
    inspect: ["README.md", "package.json", "src"],
    browserFirst: true,
  },
  {
    filter: "final-threshold",
    repo: "tensorflow/tfjs-models",
    purpose: "browser ML models including sentence-level semantic similarity components",
    branch: "master",
    inspect: ["README.md", "package.json", "universal-sentence-encoder"],
    browserFirst: true,
  },
];
