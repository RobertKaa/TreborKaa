export type FlagLayout =
  | 'vertical-tricolor'
  | 'horizontal-tricolor'
  | 'horizontal-bicolor'
  | 'vertical-bicolor'
  | 'nordic-cross'
  | 'plain'
  | 'triangle'
  | 'cross'
  | 'stars-canton'
  | 'center-emblem'
  | 'sun-emblem'
  | 'diagonal'
  | 'other';

export type FlagProfile = {
  colors: string[];
  layout: FlagLayout;
  symbols?: string[];
  traits?: string[];
};

export const FLAG_PROFILES: Record<string, FlagProfile> = {
  ad: { colors: ['blue', 'yellow', 'red'], layout: 'vertical-tricolor', symbols: ['coat-of-arms'] },
  ae: { colors: ['green', 'white', 'black', 'red'], layout: 'horizontal-tricolor', traits: ['left-band'] },
  ar: { colors: ['blue', 'white', 'yellow'], layout: 'horizontal-tricolor', symbols: ['sun'] },
  at: { colors: ['red', 'white'], layout: 'horizontal-tricolor' },
  au: { colors: ['blue', 'white', 'red'], layout: 'stars-canton', symbols: ['stars', 'union-jack'] },
  bd: { colors: ['green', 'red'], layout: 'center-emblem', symbols: ['disc'] },
  be: { colors: ['black', 'yellow', 'red'], layout: 'vertical-tricolor' },
  bg: { colors: ['white', 'green', 'red'], layout: 'horizontal-tricolor' },
  bo: { colors: ['red', 'yellow', 'green'], layout: 'horizontal-tricolor' },
  br: { colors: ['green', 'yellow', 'blue', 'white'], layout: 'center-emblem', symbols: ['diamond', 'stars'] },
  ca: { colors: ['red', 'white'], layout: 'vertical-tricolor', symbols: ['leaf'] },
  ch: { colors: ['red', 'white'], layout: 'cross', symbols: ['cross'] },
  cl: { colors: ['red', 'white', 'blue'], layout: 'triangle', symbols: ['star'] },
  cm: { colors: ['green', 'red', 'yellow'], layout: 'vertical-tricolor', symbols: ['star'] },
  co: { colors: ['yellow', 'blue', 'red'], layout: 'horizontal-tricolor', traits: ['wide-top-band'] },
  ci: { colors: ['orange', 'white', 'green'], layout: 'vertical-tricolor' },
  cz: { colors: ['white', 'red', 'blue'], layout: 'triangle', traits: ['left-triangle'] },
  de: { colors: ['black', 'red', 'yellow'], layout: 'horizontal-tricolor' },
  dk: { colors: ['red', 'white'], layout: 'nordic-cross', symbols: ['cross'] },
  ec: { colors: ['yellow', 'blue', 'red'], layout: 'horizontal-tricolor', traits: ['wide-top-band'], symbols: ['coat-of-arms'] },
  ee: { colors: ['blue', 'black', 'white'], layout: 'horizontal-tricolor' },
  eg: { colors: ['red', 'white', 'black', 'yellow'], layout: 'horizontal-tricolor', symbols: ['eagle'] },
  es: { colors: ['red', 'yellow'], layout: 'horizontal-tricolor', traits: ['wide-middle-band'], symbols: ['coat-of-arms'] },
  fi: { colors: ['white', 'blue'], layout: 'nordic-cross', symbols: ['cross'] },
  fj: { colors: ['blue', 'white', 'red'], layout: 'stars-canton', symbols: ['union-jack', 'coat-of-arms'] },
  fr: { colors: ['blue', 'white', 'red'], layout: 'vertical-tricolor' },
  ga: { colors: ['green', 'yellow', 'blue'], layout: 'horizontal-tricolor' },
  gb: { colors: ['blue', 'red', 'white'], layout: 'cross', symbols: ['union-jack'] },
  gn: { colors: ['red', 'yellow', 'green'], layout: 'vertical-tricolor' },
  gr: { colors: ['blue', 'white'], layout: 'cross', symbols: ['cross'], traits: ['stripes'] },
  hr: { colors: ['red', 'white', 'blue'], layout: 'horizontal-tricolor', symbols: ['coat-of-arms'] },
  hu: { colors: ['red', 'white', 'green'], layout: 'horizontal-tricolor' },
  id: { colors: ['red', 'white'], layout: 'horizontal-bicolor' },
  ie: { colors: ['green', 'white', 'orange'], layout: 'vertical-tricolor' },
  il: { colors: ['white', 'blue'], layout: 'other', symbols: ['star-of-david'], traits: ['stripes'] },
  in: { colors: ['orange', 'white', 'green', 'blue'], layout: 'horizontal-tricolor', symbols: ['wheel'] },
  iq: { colors: ['red', 'white', 'black', 'green'], layout: 'horizontal-tricolor', symbols: ['script'] },
  is: { colors: ['blue', 'white', 'red'], layout: 'nordic-cross', symbols: ['cross'] },
  it: { colors: ['green', 'white', 'red'], layout: 'vertical-tricolor' },
  jm: { colors: ['green', 'yellow', 'black'], layout: 'diagonal', symbols: ['saltire'] },
  jo: { colors: ['black', 'white', 'green', 'red'], layout: 'horizontal-tricolor', symbols: ['star'], traits: ['left-triangle'] },
  jp: { colors: ['white', 'red'], layout: 'center-emblem', symbols: ['disc'] },
  kw: { colors: ['green', 'white', 'red', 'black'], layout: 'horizontal-tricolor', traits: ['left-trapezoid'] },
  lv: { colors: ['maroon', 'white'], layout: 'horizontal-tricolor', traits: ['thin-middle-band'] },
  lt: { colors: ['yellow', 'green', 'red'], layout: 'horizontal-tricolor' },
  lu: { colors: ['red', 'white', 'blue'], layout: 'horizontal-tricolor', traits: ['light-blue'] },
  ly: { colors: ['red', 'black', 'green', 'white'], layout: 'horizontal-tricolor', symbols: ['crescent', 'star'] },
  ma: { colors: ['red', 'green'], layout: 'center-emblem', symbols: ['star'] },
  mc: { colors: ['red', 'white'], layout: 'horizontal-bicolor' },
  md: { colors: ['blue', 'yellow', 'red'], layout: 'vertical-tricolor', symbols: ['coat-of-arms'] },
  me: { colors: ['red', 'yellow'], layout: 'center-emblem', symbols: ['coat-of-arms'], traits: ['gold-border'] },
  ml: { colors: ['green', 'yellow', 'red'], layout: 'vertical-tricolor' },
  mr: { colors: ['green', 'yellow', 'red'], layout: 'horizontal-tricolor', symbols: ['crescent', 'star'] },
  mx: { colors: ['green', 'white', 'red'], layout: 'vertical-tricolor', symbols: ['coat-of-arms'] },
  my: { colors: ['red', 'white', 'blue', 'yellow'], layout: 'stars-canton', symbols: ['crescent', 'star'], traits: ['stripes'] },
  ng: { colors: ['green', 'white'], layout: 'vertical-tricolor' },
  nl: { colors: ['red', 'white', 'blue'], layout: 'horizontal-tricolor' },
  no: { colors: ['red', 'white', 'blue'], layout: 'nordic-cross', symbols: ['cross'] },
  nz: { colors: ['blue', 'white', 'red'], layout: 'stars-canton', symbols: ['stars', 'union-jack'] },
  pe: { colors: ['red', 'white'], layout: 'vertical-tricolor' },
  ph: { colors: ['blue', 'red', 'white', 'yellow'], layout: 'triangle', symbols: ['sun', 'stars'], traits: ['left-triangle'] },
  pk: { colors: ['green', 'white'], layout: 'vertical-bicolor', symbols: ['crescent', 'star'] },
  pl: { colors: ['white', 'red'], layout: 'horizontal-bicolor' },
  pt: { colors: ['green', 'red', 'yellow'], layout: 'vertical-bicolor', symbols: ['coat-of-arms'] },
  ro: { colors: ['blue', 'yellow', 'red'], layout: 'vertical-tricolor' },
  rs: { colors: ['red', 'blue', 'white'], layout: 'horizontal-tricolor', symbols: ['coat-of-arms'] },
  ru: { colors: ['white', 'blue', 'red'], layout: 'horizontal-tricolor' },
  se: { colors: ['blue', 'yellow'], layout: 'nordic-cross', symbols: ['cross'] },
  sg: { colors: ['red', 'white'], layout: 'horizontal-bicolor', symbols: ['crescent', 'stars'] },
  si: { colors: ['white', 'blue', 'red'], layout: 'horizontal-tricolor', symbols: ['coat-of-arms'] },
  sk: { colors: ['white', 'blue', 'red'], layout: 'horizontal-tricolor', symbols: ['coat-of-arms'] },
  sn: { colors: ['green', 'yellow', 'red'], layout: 'vertical-tricolor', symbols: ['star'] },
  sy: { colors: ['red', 'white', 'black', 'green'], layout: 'horizontal-tricolor', symbols: ['stars'] },
  td: { colors: ['blue', 'yellow', 'red'], layout: 'vertical-tricolor' },
  th: { colors: ['red', 'white', 'blue'], layout: 'horizontal-tricolor', traits: ['wide-middle-band'] },
  tr: { colors: ['red', 'white'], layout: 'center-emblem', symbols: ['crescent', 'star'] },
  tv: { colors: ['blue', 'white', 'red', 'yellow'], layout: 'stars-canton', symbols: ['union-jack', 'stars'] },
  ua: { colors: ['blue', 'yellow'], layout: 'horizontal-bicolor' },
  ug: { colors: ['black', 'yellow', 'red', 'white'], layout: 'horizontal-tricolor', symbols: ['crane'], traits: ['many-stripes'] },
  us: { colors: ['red', 'white', 'blue'], layout: 'stars-canton', symbols: ['stars'], traits: ['stripes'] },
  uy: { colors: ['white', 'blue', 'yellow'], layout: 'sun-emblem', symbols: ['sun'], traits: ['stripes'] },
  ve: { colors: ['yellow', 'blue', 'red', 'white'], layout: 'horizontal-tricolor', symbols: ['stars'] },
  ye: { colors: ['red', 'white', 'black'], layout: 'horizontal-tricolor' }
};
