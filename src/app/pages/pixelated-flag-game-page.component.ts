import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from '../services/countries.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type PixelatedError = {
  country: CountrySummary;
  answer: string;
};

const MAX_ATTEMPTS = 5;
const PIXEL_GAME_EXCLUDED_CODES = new Set(['mf']);
const REVEAL_STEPS = [
  { sampleWidth: 6, shiftRate: 0.16, jitterFactor: 0.28 },
  { sampleWidth: 10, shiftRate: 0.12, jitterFactor: 0.22 },
  { sampleWidth: 16, shiftRate: 0.09, jitterFactor: 0.17 },
  { sampleWidth: 26, shiftRate: 0.06, jitterFactor: 0.12 },
  { sampleWidth: 40, shiftRate: 0.03, jitterFactor: 0.08 }
];

@Component({
  selector: 'app-pixelated-flag-game-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pixelated-flag-game-page.component.html',
  styleUrl: './pixelated-flag-game-page.component.css'
})
export class PixelatedFlagGamePageComponent implements AfterViewInit {
  @ViewChild('pixelCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('answerInput') private answerInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('nextButton') private nextButtonRef?: ElementRef<HTMLButtonElement>;

  private readonly countriesService = inject(CountriesService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private readonly imageCache = new Map<string, HTMLImageElement>();
  private hasSavedRecord = false;

  protected readonly countryPool = signal<CountrySummary[]>([]);
  protected readonly usedCodes = signal<string[]>([]);
  protected readonly currentCountry = signal<CountrySummary | null>(null);
  protected readonly score = signal(0);
  protected readonly solvedCount = signal(0);
  protected readonly answer = signal('');
  protected readonly attemptsUsed = signal(0);
  protected readonly errors = signal<PixelatedError[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLocked = signal(false);
  protected readonly isComplete = signal(false);
  protected readonly roundResult = signal<'correct' | 'wrong' | null>(null);

  protected readonly pointsForCurrentTry = computed(() => Math.max(1, MAX_ATTEMPTS - this.attemptsUsed()));
  protected readonly resultMessage = computed(() => {
    const result = this.roundResult();
    const country = this.currentCountry();

    if (result === 'correct') {
      return 'Bonne réponse !';
    }

    if (result === 'wrong') {
      return `Mauvaise réponse : '${country?.nameFrench ?? ''}'`;
    }

    return null;
  });
  protected readonly attemptMarkers = computed(() => {
    const markers: Array<'empty' | 'wrong' | 'correct'> = [];
    const wrongCount = this.attemptsUsed();
    const result = this.roundResult();

    for (let index = 0; index < MAX_ATTEMPTS; index += 1) {
      if (index < wrongCount) {
        markers.push('wrong');
      } else if (result === 'correct' && index === wrongCount) {
        markers.push('correct');
      } else {
        markers.push('empty');
      }
    }

    return markers;
  });

  constructor() {
    effect(() => {
      this.currentCountry();
      this.attemptsUsed();
      this.roundResult();

      queueMicrotask(() => {
        this.renderCurrentFlag();
      });
    });

    effect(() => {
      this.currentCountry();
      this.isLoading();
      this.isLocked();
      this.isComplete();
      this.roundResult();

      queueMicrotask(() => {
        if (this.roundResult() === 'correct' && !this.isComplete()) {
          this.focusNextButton();
          return;
        }

        this.focusAnswerInput();
      });
    });

    this.loadGame();
  }

  ngAfterViewInit(): void {
    this.renderCurrentFlag();
    this.focusAnswerInput();
  }

  protected submitAnswer(): void {
    const country = this.currentCountry();
    if (!country || this.isLocked() || this.isLoading() || this.isComplete()) {
      return;
    }

    const rawAnswer = this.answer().trim();
    if (!rawAnswer) {
      return;
    }

    const normalizedAnswer = this.normalize(rawAnswer);
    const acceptedAnswers = new Set([this.normalize(country.nameFrench), this.normalize(country.nameEnglish)]);

    if (acceptedAnswers.has(normalizedAnswer)) {
      const gained = this.pointsForCurrentTry();
      this.score.update((score) => score + gained);
      this.solvedCount.update((count) => count + 1);
      this.usedCodes.update((codes) => [...codes, country.code]);
      this.isLocked.set(true);
      this.roundResult.set('correct');
      return;
    }

    const nextAttempt = this.attemptsUsed() + 1;
    this.answer.set('');
    this.attemptsUsed.set(nextAttempt);

    if (nextAttempt >= MAX_ATTEMPTS) {
      this.errors.update((errors) => [
        ...errors,
        {
          country,
          answer: rawAnswer
        }
      ]);
      this.isLocked.set(true);
      this.roundResult.set('wrong');
      this.finishGame();
      return;
    }

    this.focusAnswerInput();
  }

  protected restartGame(): void {
    this.loadGame();
  }

  protected goToNextRound(): void {
    if (this.roundResult() !== 'correct' || this.isComplete()) {
      return;
    }

    this.advanceRound();
  }

  private loadGame(): void {
    this.isLoading.set(true);
    this.countryPool.set([]);
    this.usedCodes.set([]);
    this.currentCountry.set(null);
    this.score.set(0);
    this.solvedCount.set(0);
    this.answer.set('');
    this.attemptsUsed.set(0);
    this.errors.set([]);
    this.isLocked.set(false);
    this.isComplete.set(false);
    this.roundResult.set(null);
    this.hasSavedRecord = false;

    this.countriesService
      .getCountries()
      .pipe(take(1))
      .subscribe((countries) => {
        const filtered = countries.filter((country) => !PIXEL_GAME_EXCLUDED_CODES.has(country.code));
        this.countryPool.set(this.keepSingleCountryByFlag(filtered));
        this.pickNextCountry();
        this.isLoading.set(false);
        this.renderCurrentFlag();
      });
  }

  private advanceRound(): void {
    this.answer.set('');
    this.attemptsUsed.set(0);
    this.roundResult.set(null);
    this.isLocked.set(false);
    this.pickNextCountry();
  }

  private pickNextCountry(): void {
    const pool = this.countryPool();
    if (pool.length === 0) {
      this.currentCountry.set(null);
      return;
    }

    const used = new Set(this.usedCodes());
    const available = pool.filter((country) => !used.has(country.code));
    const source = available.length > 0 ? available : pool;
    const currentCode = this.currentCountry()?.code ?? null;
    const choices = currentCode ? source.filter((country) => country.code !== currentCode) : source;

    this.currentCountry.set(this.pickRandom(choices.length > 0 ? choices : source));
  }

  private renderCurrentFlag(): void {
    const canvas = this.canvasRef?.nativeElement;
    const country = this.currentCountry();
    if (!canvas || !country || this.isLoading()) {
      return;
    }

    const image = this.getImage(country.flagUrl);
    if (!image.complete) {
      image.onload = () => this.drawPixelated(image);
      return;
    }

    this.drawPixelated(image);
  }

  private drawPixelated(image: HTMLImageElement): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = 540;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);

    const margin = 28;
    const ratio = image.naturalWidth / image.naturalHeight;
    let drawWidth = width - margin * 2;
    let drawHeight = drawWidth / ratio;

    if (drawHeight > height - margin * 2) {
      drawHeight = height - margin * 2;
      drawWidth = drawHeight * ratio;
    }

    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    const reveal = REVEAL_STEPS[Math.min(this.attemptsUsed(), REVEAL_STEPS.length - 1)];
    const pixelWidth = reveal.sampleWidth;
    const pixelHeight = Math.max(1, Math.round(pixelWidth / ratio));
    const buffer = document.createElement('canvas');
    buffer.width = pixelWidth;
    buffer.height = pixelHeight;

    const bufferContext = buffer.getContext('2d');
    if (!bufferContext) {
      return;
    }

    if (this.roundResult() !== null) {
      context.imageSmoothingEnabled = true;
      context.drawImage(image, x, y, drawWidth, drawHeight);
      return;
    }

    bufferContext.imageSmoothingEnabled = false;
    bufferContext.clearRect(0, 0, buffer.width, buffer.height);
    bufferContext.drawImage(image, 0, 0, buffer.width, buffer.height);
    this.drawShiftedPixels(
      context,
      bufferContext,
      x,
      y,
      drawWidth,
      drawHeight,
      reveal.shiftRate,
      reveal.jitterFactor
    );
  }

  private getImage(src: string): HTMLImageElement {
    const cached = this.imageCache.get(src);
    if (cached) {
      return cached;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    this.imageCache.set(src, image);
    return image;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private drawShiftedPixels(
    context: CanvasRenderingContext2D,
    sourceContext: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    shiftRate: number,
    jitterFactor: number
  ): void {
    const sw = sourceContext.canvas.width;
    const sh = sourceContext.canvas.height;
    const blockWidth = width / sw;
    const blockHeight = height / sh;
    const imageData = sourceContext.getImageData(0, 0, sw, sh).data;
    const maxOffsetX = blockWidth * jitterFactor;
    const maxOffsetY = blockHeight * jitterFactor;

    for (let py = 0; py < sh; py += 1) {
      for (let px = 0; px < sw; px += 1) {
        const index = (py * sw + px) * 4;
        const red = imageData[index];
        const green = imageData[index + 1];
        const blue = imageData[index + 2];
        const alpha = imageData[index + 3] / 255;

        const dx = x + px * blockWidth;
        const dy = y + py * blockHeight;
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        context.fillRect(dx, dy, Math.ceil(blockWidth + 0.5), Math.ceil(blockHeight + 0.5));

        if (Math.random() < shiftRate) {
          const offsetX = (Math.random() * 2 - 1) * maxOffsetX;
          const offsetY = (Math.random() * 2 - 1) * maxOffsetY;

          context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.max(0.55, alpha * 0.85)})`;
          context.fillRect(
            dx + offsetX,
            dy + offsetY,
            Math.ceil(blockWidth + 0.5),
            Math.ceil(blockHeight + 0.5)
          );
        }
      }
    }
  }

  private focusAnswerInput(): void {
    const input = this.answerInputRef?.nativeElement;
    if (!input || this.isLoading() || this.isLocked() || this.isComplete() || this.roundResult() !== null) {
      return;
    }

    input.focus();
    input.select();
  }

  private focusNextButton(): void {
    const button = this.nextButtonRef?.nativeElement;
    if (!button || this.isLoading() || this.isComplete() || this.roundResult() !== 'correct') {
      return;
    }

    button.focus();
  }

  private keepSingleCountryByFlag(countries: CountrySummary[]): CountrySummary[] {
    const seen = new Set<string>();
    const deduped: CountrySummary[] = [];

    for (const country of countries) {
      const key = country.flagUrl.trim().toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(country);
    }

    return deduped;
  }

  private pickRandom(countries: CountrySummary[]): CountrySummary {
    return countries[Math.floor(Math.random() * countries.length)];
  }

  private finishGame(): void {
    this.isComplete.set(true);

    if (this.hasSavedRecord) {
      return;
    }

    this.personalRecordsService.saveResult('pixel-flag', {
      score: this.solvedCount(),
      maxScore: Math.max(1, this.solvedCount()),
      streak: this.solvedCount()
    });
    this.hasSavedRecord = true;
  }
}
