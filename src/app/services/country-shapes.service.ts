import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { CountryShape } from '../models/country-shape';

const SHAPES_ASSET_URL = 'data/country-shapes.json';

@Injectable({ providedIn: 'root' })
export class CountryShapesService {
  private readonly http = inject(HttpClient);
  private readonly shapes$ = this.http.get<CountryShape[]>(SHAPES_ASSET_URL).pipe(
    map((shapes) =>
      shapes.filter((shape) => /^[a-z]{2}$/.test(shape.code) && typeof shape.path === 'string' && shape.path)
    ),
    catchError(() => of([])),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  getCountryShapes(): Observable<CountryShape[]> {
    return this.shapes$;
  }
}
