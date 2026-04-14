import { Injectable } from '@angular/core';
import { FLAG_CULTURE_STATIC_QUESTIONS } from '../data/flag-culture-questions';
import {
  FlagCultureDifficulty,
  FlagCultureDifficultyMode,
  FlagCultureRoundQuestion
} from '../models/flag-culture-question';

@Injectable({ providedIn: 'root' })
export class FlagCultureQuizService {
  buildRound(
    difficultyMode: FlagCultureDifficultyMode,
    questionCount: number
  ): FlagCultureRoundQuestion[] {
    const requestedCount = Math.max(1, questionCount);
    const focusedPool = FLAG_CULTURE_STATIC_QUESTIONS.filter((question) =>
      this.matchesDifficulty(question.difficulty, difficultyMode)
    );
    const completePool = this.shuffle(FLAG_CULTURE_STATIC_QUESTIONS);
    const selected = this.pickWithFallback(this.shuffle(focusedPool), completePool, requestedCount);

    return selected.map((question) => ({
      ...question,
      shuffledOptions: this.shuffle(question.options)
    }));
  }

  private pickWithFallback<T>(
    primary: T[],
    fallback: T[],
    count: number
  ): T[] {
    if (primary.length >= count) {
      return primary.slice(0, count);
    }

    const merged = [...primary];
    for (const item of fallback) {
      if (merged.includes(item)) {
        continue;
      }
      merged.push(item);
      if (merged.length >= count) {
        break;
      }
    }

    return merged.slice(0, count);
  }

  private matchesDifficulty(
    difficulty: FlagCultureDifficulty,
    mode: FlagCultureDifficultyMode
  ): boolean {
    return mode === 'mixed' || difficulty === mode;
  }

  private shuffle<T>(values: T[]): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }
}
