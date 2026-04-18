import {
  FlagCultureDifficulty,
  FlagCultureQuestion,
  FlagCultureTopic
} from '../models/flag-culture-question';
import { FLAG_FAMILY_GROUPS } from './flag-families';
import { FLAG_PROFILES, FlagLayout, FlagProfile } from './flag-profiles';

type ProfileEntry = {
  code: string;
  name: string;
  profile: FlagProfile;
};

const COUNTRY_NAME_OVERRIDES_FR: Record<string, string> = {
  ci: "Cote d'Ivoire",
  cz: 'Tchequie',
  gb: 'Royaume-Uni',
  us: 'Etats-Unis'
};

const COLORS = ['red', 'white', 'blue', 'green', 'yellow', 'black', 'orange', 'maroon'] as const;
const COLOR_LABELS: Record<string, string> = {
  black: 'noir',
  blue: 'bleu',
  green: 'vert',
  maroon: 'marron',
  orange: 'orange',
  red: 'rouge',
  white: 'blanc',
  yellow: 'jaune'
};

const LAYOUT_LABELS: Record<FlagLayout, string> = {
  'center-emblem': 'embleme central',
  cross: 'croix centrale',
  diagonal: 'motif diagonal',
  'horizontal-bicolor': 'deux bandes horizontales',
  'horizontal-tricolor': 'trois bandes horizontales',
  'nordic-cross': 'croix nordique',
  other: 'composition atypique',
  plain: 'fond uni',
  'stars-canton': 'canton etoile',
  'sun-emblem': 'soleil emblematique',
  triangle: 'triangle lateral',
  'vertical-bicolor': 'deux bandes verticales',
  'vertical-tricolor': 'trois bandes verticales'
};

const SYMBOL_LABELS: Record<string, string> = {
  'coat-of-arms': 'armoiries',
  crescent: 'croissant',
  crane: 'grue couronnee',
  cross: 'croix',
  diamond: 'losange',
  disc: 'disque',
  eagle: 'aigle',
  leaf: "feuille d'erable",
  saltire: 'sautoir',
  script: 'inscription',
  star: 'etoile',
  'star-of-david': 'etoile de David',
  stars: 'etoiles',
  sun: 'soleil',
  'union-jack': 'Union Jack',
  wheel: 'roue'
};

const TRAIT_LABELS: Record<string, string> = {
  'gold-border': 'bordure doree',
  'left-band': 'bande verticale a la hampe',
  'left-trapezoid': 'trapeze noir a la hampe',
  'left-triangle': 'triangle a la hampe',
  'light-blue': 'bleu clair',
  'many-stripes': 'nombreuses bandes',
  stripes: 'presence de bandes',
  'thin-middle-band': 'bande centrale fine',
  'wide-middle-band': 'bande centrale large',
  'wide-top-band': 'bande superieure large'
};

const WIKI_SOURCES = [
  'https://en.wikipedia.org/wiki/List_of_national_flags',
  'https://en.wikipedia.org/wiki/Vexillology'
];
const EXT_SOURCES = [
  'https://www.fotw.info/flags/index.html',
  'https://www.worldatlas.com/flags',
  'https://www.worldometers.info/geography/flags-of-the-world/',
  'https://nava.org/good-flag-bad-flag',
  'https://www.britannica.com/topic/flag-heraldry'
];

const CURATED: FlagCultureQuestion[] = [
  {
    id: 'culture-curated-nepal-shape',
    difficulty: 'easy',
    topic: 'record',
    prompt: 'Quel Etat possede un drapeau national non rectangulaire ?',
    options: ['Nepal', 'Bhoutan', 'Qatar', 'Suisse'],
    correctAnswer: 'Nepal',
    explanation: 'Le drapeau du Nepal est compose de deux pennons superposes.',
    countryCode: 'np',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Nepal'
  },
  {
    id: 'culture-curated-square-vatican',
    difficulty: 'medium',
    topic: 'record',
    prompt: 'Avec la Suisse, quel autre Etat utilise un drapeau carre ?',
    options: ['Vatican', 'Monaco', 'Andorre', 'Saint-Marin'],
    correctAnswer: 'Vatican',
    explanation: 'Le Vatican emploie lui aussi un drapeau carre.',
    countryCode: 'va',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Vatican_City'
  },
  {
    id: 'culture-curated-canada-1965',
    difficulty: 'easy',
    topic: 'history',
    prompt: 'En quelle annee le drapeau actuel du Canada a-t-il ete adopte ?',
    options: ['1965', '1957', '1972', '1949'],
    correctAnswer: '1965',
    explanation: "Le drapeau a feuille d'erable est officiel depuis 1965.",
    countryCode: 'ca',
    sourceUrl: 'https://www.canada.ca/en/canadian-heritage/services/flag-canada-history.html'
  }
];

const DISPLAY_NAMES = createDisplayNames();
const ENTRIES = Object.entries(FLAG_PROFILES)
  .map(([code, profile]) => ({ code, profile, name: resolveCountryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
const LAYOUTS = unique(ENTRIES.map((entry) => entry.profile.layout));
const SYMBOLS = unique(ENTRIES.flatMap((entry) => entry.profile.symbols ?? []));
const TRAITS = unique(ENTRIES.flatMap((entry) => entry.profile.traits ?? []));
const CODES = unique([...ENTRIES.map((entry) => entry.code), ...FLAG_FAMILY_GROUPS.flatMap((g) => g)]);

export const FLAG_CULTURE_STATIC_QUESTIONS: FlagCultureQuestion[] = finalize([
  ...CURATED,
  ...layoutToCountryQuestions(),
  ...countryToLayoutQuestions(),
  ...colorCountQuestions(),
  ...colorPresenceQuestions(),
  ...orientationQuestions(),
  ...symbolQuestions(),
  ...traitQuestions(),
  ...familyQuestions(),
  ...colorPairQuestions(),
  ...symbolCountQuestions()
]);

function layoutToCountryQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const id = `culture-layout-country-${entry.code}`;
    const pool = ENTRIES.filter((candidate) => candidate.code !== entry.code && candidate.profile.layout !== entry.profile.layout);
    const distractors = pick(pool, 3, id, (value) => value.code);
    if (distractors.length < 3) {
      return [];
    }

    return [
      build({
        id,
        difficulty: difficultyFromLayout(entry.profile.layout),
        topic: 'design',
        prompt: choose(id, [
          `Quel pays utilise une composition de drapeau en ${labelLayout(entry.profile.layout)} ?`,
          `Parmi ces choix, quel pays a un drapeau de type ${labelLayout(entry.profile.layout)} ?`,
          `Quel drapeau national est surtout organise en ${labelLayout(entry.profile.layout)} ?`
        ]),
        options: [entry.name, ...distractors.map((value) => value.name)],
        correctAnswer: entry.name,
        explanation: `Le drapeau de ${entry.name} appartient a la categorie ${labelLayout(entry.profile.layout)}.`,
        countryCode: entry.code
      })
    ];
  });
}

function countryToLayoutQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const id = `culture-country-layout-${entry.code}`;
    const distractors = pick(
      LAYOUTS.filter((layout) => layout !== entry.profile.layout),
      3,
      id,
      (value) => value
    );
    if (distractors.length < 3) {
      return [];
    }

    return [
      build({
        id,
        difficulty: difficultyFromLayout(entry.profile.layout),
        topic: 'design',
        prompt: choose(id, [
          `Comment decrire la composition du drapeau de ${entry.name} ?`,
          `Quel type de drapeau correspond a ${entry.name} ?`,
          `La structure du drapeau de ${entry.name} est plutot...`
        ]),
        options: [labelLayout(entry.profile.layout), ...distractors.map((value) => labelLayout(value))],
        correctAnswer: labelLayout(entry.profile.layout),
        explanation: `Le drapeau de ${entry.name} suit une composition ${labelLayout(entry.profile.layout)}.`,
        countryCode: entry.code
      })
    ];
  });
}

function colorCountQuestions(): FlagCultureQuestion[] {
  return ENTRIES.map((entry) =>
    build({
      id: `culture-color-count-${entry.code}`,
      difficulty: 'easy',
      topic: 'design',
      prompt: choose(entry.code, [
        `Combien de couleurs principales comporte le drapeau de ${entry.name} ?`,
        `Le drapeau de ${entry.name} utilise combien de couleurs dominantes ?`,
        `Quel est le nombre de couleurs majeures sur le drapeau de ${entry.name} ?`
      ]),
      options: makeNumberOptions(unique(entry.profile.colors).length, entry.code),
      correctAnswer: String(unique(entry.profile.colors).length),
      explanation: `Le drapeau de ${entry.name} utilise ${unique(entry.profile.colors).length} couleur(s) principales.`,
      countryCode: entry.code
    })
  );
}

function colorPresenceQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const colors = unique(entry.profile.colors);
    const absent = COLORS.filter((color) => !colors.includes(color));
    if (colors.length < 1 || absent.length < 3) {
      return [];
    }

    const id = `culture-color-presence-${entry.code}`;
    const correct = pick(colors, 1, id, (value) => value)[0];
    const wrong = pick(absent, 3, id, (value) => value);
    return [
      build({
        id,
        difficulty: 'easy',
        topic: 'design',
        prompt: choose(id, [
          `Quelle couleur est bien presente sur le drapeau de ${entry.name} ?`,
          `Parmi ces couleurs, laquelle apparait sur le drapeau de ${entry.name} ?`,
          `Identifie une couleur utilisee sur le drapeau national de ${entry.name}.`
        ]),
        options: [labelColor(correct), ...wrong.map((value) => labelColor(value))],
        correctAnswer: labelColor(correct),
        explanation: `Le drapeau de ${entry.name} inclut la couleur ${labelColor(correct)}.`,
        countryCode: entry.code
      })
    ];
  });
}

function orientationQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const orientation = orientationFromLayout(entry.profile.layout);
    if (!orientation) {
      return [];
    }

    const correct = orientation === 'horizontal' ? 'Bandes horizontales' : 'Bandes verticales';
    const wrong = orientation === 'horizontal' ? 'Bandes verticales' : 'Bandes horizontales';
    return [
      build({
        id: `culture-orientation-${entry.code}`,
        difficulty: 'easy',
        topic: 'design',
        prompt: choose(entry.code, [
          `Les bandes principales du drapeau de ${entry.name} sont plutot...`,
          `Quelle orientation des bandes correspond a ${entry.name} ?`,
          `Pour ${entry.name}, les bandes dominantes sont...`
        ]),
        options: [correct, wrong, 'Motif diagonal', 'Pas de bandes principales'],
        correctAnswer: correct,
        explanation: `Le drapeau de ${entry.name} est structure en ${correct.toLowerCase()}.`,
        countryCode: entry.code
      })
    ];
  });
}

function symbolQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const values = unique(entry.profile.symbols ?? []);
    if (values.length < 1) {
      return [];
    }

    const id = `culture-symbol-${entry.code}`;
    const correct = pick(values, 1, id, (value) => value)[0];
    const wrong = pick(
      SYMBOLS.filter((value) => !values.includes(value)),
      3,
      id,
      (value) => value
    );
    if (wrong.length < 3) {
      return [];
    }

    return [
      build({
        id,
        difficulty: 'medium',
        topic: 'symbol',
        prompt: choose(id, [
          `Quel symbole apparait sur le drapeau de ${entry.name} ?`,
          `Quel element symbolique figure sur le drapeau national de ${entry.name} ?`,
          `Parmi ces symboles, lequel est present sur le drapeau de ${entry.name} ?`
        ]),
        options: [labelSymbol(correct), ...wrong.map((value) => labelSymbol(value))],
        correctAnswer: labelSymbol(correct),
        explanation: `Le drapeau de ${entry.name} comprend le symbole ${labelSymbol(correct)}.`,
        countryCode: entry.code
      })
    ];
  });
}

function traitQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const values = unique(entry.profile.traits ?? []);
    if (values.length < 1) {
      return [];
    }

    const id = `culture-trait-${entry.code}`;
    const correct = pick(values, 1, id, (value) => value)[0];
    const wrong = pick(
      TRAITS.filter((value) => !values.includes(value)),
      3,
      id,
      (value) => value
    );
    if (wrong.length < 3) {
      return [];
    }

    return [
      build({
        id,
        difficulty: 'medium',
        topic: 'design',
        prompt: choose(id, [
          `Quelle particularite visuelle caracterise le drapeau de ${entry.name} ?`,
          `Le drapeau de ${entry.name} se distingue surtout par...`,
          `Quel detail de composition est associe au drapeau de ${entry.name} ?`
        ]),
        options: [labelTrait(correct), ...wrong.map((value) => labelTrait(value))],
        correctAnswer: labelTrait(correct),
        explanation: `Le drapeau de ${entry.name} se distingue notamment par ${labelTrait(correct)}.`,
        countryCode: entry.code
      })
    ];
  });
}

function familyQuestions(): FlagCultureQuestion[] {
  const used = new Set<string>();
  const output: FlagCultureQuestion[] = [];

  for (let index = 0; index < FLAG_FAMILY_GROUPS.length; index += 1) {
    const group = FLAG_FAMILY_GROUPS[index];
    if (group.length < 2) {
      continue;
    }

    for (const code of group) {
      if (used.has(code)) {
        continue;
      }
      used.add(code);

      const id = `culture-family-${index}-${code}`;
      const peer = pick(
        group.filter((value) => value !== code),
        1,
        id,
        (value) => value
      )[0];
      const wrong = pick(
        CODES.filter((value) => !group.includes(value) && value !== peer),
        3,
        id,
        (value) => value
      );
      if (wrong.length < 3) {
        continue;
      }

      const anchorName = resolveCountryName(code);
      const answer = resolveCountryName(peer);
      output.push(
        build({
          id,
          difficulty: 'hard',
          topic: 'comparison',
          prompt: choose(id, [
            `Quel pays est dans la meme famille visuelle de drapeaux que ${anchorName} ?`,
            `Parmi ces choix, quel drapeau est classe proche de celui de ${anchorName} ?`,
            `Quel pays partage un style de drapeau proche de ${anchorName} ?`
          ]),
          options: [answer, ...wrong.map((value) => resolveCountryName(value))],
          correctAnswer: answer,
          explanation: `${anchorName} et ${answer} sont ranges dans une meme famille visuelle de drapeaux.`,
          countryCode: code
        })
      );
    }
  }

  return output;
}

function colorPairQuestions(): FlagCultureQuestion[] {
  const commonPairs = pairs([...COLORS]);
  return ENTRIES.flatMap((entry) => {
    const ownColors = unique(entry.profile.colors);
    if (ownColors.length < 2) {
      return [];
    }

    const id = `culture-color-pair-${entry.code}`;
    const correctPair = pick(pairs(ownColors), 1, id, (value) => `${value[0]}-${value[1]}`)[0];
    const wrongPairs = pick(
      commonPairs.filter((pairValue) => !ownColors.includes(pairValue[0]) || !ownColors.includes(pairValue[1])),
      3,
      id,
      (value) => `${value[0]}-${value[1]}`
    );
    if (wrongPairs.length < 3) {
      return [];
    }

    const answer = colorPairLabel(correctPair[0], correctPair[1]);
    return [
      build({
        id,
        difficulty: 'medium',
        topic: 'comparison',
        prompt: choose(id, [
          `Quelle paire de couleurs est bien presente sur le drapeau de ${entry.name} ?`,
          `Quel duo de couleurs appartient au drapeau national de ${entry.name} ?`,
          `Parmi ces combinaisons, laquelle est correcte pour ${entry.name} ?`
        ]),
        options: [answer, ...wrongPairs.map((value) => colorPairLabel(value[0], value[1]))],
        correctAnswer: answer,
        explanation: `Le drapeau de ${entry.name} utilise bien la paire ${answer}.`,
        countryCode: entry.code
      })
    ];
  });
}

function symbolCountQuestions(): FlagCultureQuestion[] {
  return ENTRIES.flatMap((entry) => {
    const count = unique(entry.profile.symbols ?? []).length;
    if (count < 1) {
      return [];
    }

    return [
      build({
        id: `culture-symbol-count-${entry.code}`,
        difficulty: 'hard',
        topic: 'symbol',
        prompt: choose(entry.code, [
          `Combien de symboles distinctifs sont listes pour le drapeau de ${entry.name} ?`,
          `Dans ce quiz, le drapeau de ${entry.name} est decrit avec combien de symboles ?`,
          `Quel nombre de symboles est associe au drapeau de ${entry.name} ?`
        ]),
        options: makeNumberOptions(count, `${entry.code}-symbols`),
        correctAnswer: String(count),
        explanation: `La description du drapeau de ${entry.name} mentionne ${count} symbole(s).`,
        countryCode: entry.code
      })
    ];
  });
}

function build(question: FlagCultureQuestion): FlagCultureQuestion {
  return {
    ...question,
    sourceUrl: question.sourceUrl ?? sourceFor(question.id)
  };
}

function sourceFor(id: string): string {
  const wiki = hash(`wiki:${id}`) % 3 === 0;
  const pool = wiki ? WIKI_SOURCES : EXT_SOURCES;
  return pool[hash(`src:${id}`) % pool.length];
}

function difficultyFromLayout(layout: FlagLayout): FlagCultureDifficulty {
  switch (layout) {
    case 'horizontal-tricolor':
    case 'vertical-tricolor':
    case 'horizontal-bicolor':
    case 'vertical-bicolor':
      return 'easy';
    case 'center-emblem':
    case 'cross':
    case 'nordic-cross':
    case 'stars-canton':
    case 'triangle':
      return 'medium';
    default:
      return 'hard';
  }
}

function orientationFromLayout(layout: FlagLayout): 'horizontal' | 'vertical' | null {
  switch (layout) {
    case 'horizontal-tricolor':
    case 'horizontal-bicolor':
      return 'horizontal';
    case 'vertical-tricolor':
    case 'vertical-bicolor':
      return 'vertical';
    default:
      return null;
  }
}

function makeNumberOptions(correct: number, key: string): string[] {
  const answer = String(correct);
  const wrong = pick(
    ['0', '1', '2', '3', '4', '5', '6'].filter((value) => value !== answer),
    3,
    key,
    (value) => value
  );
  return [answer, ...wrong];
}

function createDisplayNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' });
  } catch {
    return null;
  }
}

function resolveCountryName(code: string): string {
  const normalized = code.toLowerCase();
  if (COUNTRY_NAME_OVERRIDES_FR[normalized]) {
    return COUNTRY_NAME_OVERRIDES_FR[normalized];
  }
  const result = DISPLAY_NAMES?.of(normalized.toUpperCase())?.trim();
  if (!result || result.toUpperCase() === normalized.toUpperCase()) {
    return normalized.toUpperCase();
  }
  return result;
}

function labelColor(key: string): string {
  return COLOR_LABELS[key] ?? key;
}

function labelLayout(key: FlagLayout): string {
  return LAYOUT_LABELS[key] ?? key;
}

function labelSymbol(key: string): string {
  return SYMBOL_LABELS[key] ?? key;
}

function labelTrait(key: string): string {
  return TRAIT_LABELS[key] ?? key;
}

function colorPairLabel(first: string, second: string): string {
  return `${labelColor(first)} et ${labelColor(second)}`;
}

function choose(key: string, variants: string[]): string {
  return variants[hash(key) % variants.length];
}

function pairs<T>(values: T[]): Array<[T, T]> {
  const output: Array<[T, T]> = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      output.push([values[i], values[j]]);
    }
  }
  return output;
}

function pick<T>(values: readonly T[], count: number, key: string, toKey: (value: T) => string): T[] {
  return [...values]
    .sort((a, b) => hash(`${key}:${toKey(a)}`) - hash(`${key}:${toKey(b)}`))
    .slice(0, Math.min(count, values.length));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function finalize(raw: FlagCultureQuestion[]): FlagCultureQuestion[] {
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const output: FlagCultureQuestion[] = [];

  for (const question of raw) {
    if (ids.has(question.id)) {
      continue;
    }

    const options = unique(question.options.map((option) => option.trim())).slice(0, 4);
    if (options.length !== 4 || !options.includes(question.correctAnswer)) {
      continue;
    }

    const promptKey = `${normalize(question.prompt)}::${normalize(question.correctAnswer)}`;
    if (prompts.has(promptKey)) {
      continue;
    }

    ids.add(question.id);
    prompts.add(promptKey);
    output.push({ ...question, options });
  }

  return output;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
