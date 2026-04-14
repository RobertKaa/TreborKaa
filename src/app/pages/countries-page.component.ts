import { AsyncPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from '../services/countries.service';

type SortKey = 'name' | 'capital';

@Component({
  selector: 'app-countries-page',
  imports: [AsyncPipe],
  templateUrl: './countries-page.component.html',
  styleUrl: './countries-page.component.css'
})
export class CountriesPageComponent {
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly countries$: Observable<CountrySummary[]>;

  constructor(private readonly countriesService: CountriesService) {
    this.countries$ = this.countriesService.getCountries();
  }

  protected setSortKey(sortKey: SortKey): void {
    this.sortKey.set(sortKey);
  }

  protected sortCountries(countries: CountrySummary[]): CountrySummary[] {
    return [...countries].sort((left, right) => {
      const leftValue = this.sortKey() === 'capital' ? left.capitalFrench : left.nameFrench;
      const rightValue = this.sortKey() === 'capital' ? right.capitalFrench : right.nameFrench;

      return leftValue.localeCompare(rightValue, 'fr');
    });
  }
}
