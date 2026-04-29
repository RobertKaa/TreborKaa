export type FlagRebuildPattern =
  | 'horizontal-stripes'
  | 'vertical-stripes'
  | 'triangle-left-bands-2'
  | 'triangle-left-bands-3'
  | 'left-band-horizontal'
  | 'nordic-cross'
  | 'center-disc'
  | 'horizontal-stripes-center-disc'
  | 'saltire'
  | 'diagonal-rays'
  | 'canton-horizontal-bands';

export type FlagRebuildPuzzle = {
  code: string;
  nameFrench: string;
  targetPattern: FlagRebuildPattern;
  patternOptions: FlagRebuildPattern[];
  targetColors: string[];
  palette: string[];
  flagUrl: string;
};
