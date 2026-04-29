import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CountrySummary } from '../models/country-summary';
import { I18nService } from '../services/i18n.service';
import { CountriesService } from '../services/countries.service';

type SortKey = 'name' | 'capital';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 24;

@Component({
  selector: 'app-countries-page',
  templateUrl: './countries-page.component.html',
  styleUrl: './countries-page.component.scss'
})
export class CountriesPageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly countriesService = inject(CountriesService);
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDirection = signal<SortDirection>('asc');
  protected readonly searchTerm = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly countries = toSignal(this.countriesService.getCountries(), { initialValue: [] });

  protected readonly filteredCountries = computed(() => {
    const query = this.normalize(this.searchTerm());
    const sorted = this.sortCountries(this.countries());

    if (!query) {
      return sorted;
    }

    return sorted.filter((country) => {
      const countryFrench = this.normalize(country.nameFrench);
      const countryEnglish = this.normalize(country.nameEnglish);
      const capitalFrench = this.normalize(country.capitalFrench);
      const capitalEnglish = this.normalize(country.capitalEnglish);
      const code = this.normalize(country.code);

      return (
        countryFrench.includes(query) ||
        countryEnglish.includes(query) ||
        capitalFrench.includes(query) ||
        capitalEnglish.includes(query) ||
        code.includes(query)
      );
    });
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCountries().length / this.pageSize))
  );
  protected readonly hasPagination = computed(() => this.filteredCountries().length > this.pageSize);
  protected readonly hasPreviousPage = computed(() => this.pageIndex() > 0);
  protected readonly hasNextPage = computed(() => this.pageIndex() < this.totalPages() - 1);
  protected readonly pagedCountries = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredCountries().slice(start, start + this.pageSize);
  });
  protected readonly pageLabel = computed(() =>
    this.i18n.t('countries.pageLabel', { page: this.pageIndex() + 1, total: this.totalPages() })
  );
  protected readonly resultsLabel = computed(() =>
    this.i18n.t('countries.resultsCount', { count: this.filteredCountries().length })
  );

  constructor() {
    effect(() => {
      const maxPageIndex = this.totalPages() - 1;
      if (this.pageIndex() > maxPageIndex) {
        this.pageIndex.set(maxPageIndex);
      }
    });
  }

  protected toggleSort(sortKey: SortKey): void {
    if (this.sortKey() === sortKey) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      this.pageIndex.set(0);
      return;
    }

    this.sortKey.set(sortKey);
    this.sortDirection.set('asc');
    this.pageIndex.set(0);
  }

  protected setSearchTerm(term: string): void {
    this.searchTerm.set(term);
    this.pageIndex.set(0);
  }

  protected clearSearchTerm(): void {
    this.setSearchTerm('');
  }

  protected goToPreviousPage(): void {
    if (!this.hasPreviousPage()) {
      return;
    }

    this.pageIndex.update((value) => Math.max(0, value - 1));
  }

  protected goToNextPage(): void {
    if (!this.hasNextPage()) {
      return;
    }

    this.pageIndex.update((value) => Math.min(this.totalPages() - 1, value + 1));
  }

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected capitalName(country: CountrySummary): string {
    return this.i18n.capitalName(country);
  }

  protected isSortedBy(sortKey: SortKey): boolean {
    return this.sortKey() === sortKey;
  }

  protected sortIndicator(sortKey: SortKey): string {
    if (this.sortKey() !== sortKey) {
      return '<>';
    }

    return this.sortDirection() === 'asc' ? '^' : 'v';
  }

  protected ariaSort(sortKey: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== sortKey) {
      return 'none';
    }

    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  private sortCountries(countries: CountrySummary[]): CountrySummary[] {
    return [...countries].sort((left, right) => {
      const leftValue =
        this.sortKey() === 'capital' ? this.capitalName(left) : this.countryName(left);
      const rightValue =
        this.sortKey() === 'capital' ? this.capitalName(right) : this.countryName(right);
      const locale = this.i18n.locale();
      const comparison = leftValue.localeCompare(rightValue, locale);

      return this.sortDirection() === 'asc' ? comparison : -comparison;
    });
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
