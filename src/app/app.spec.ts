import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { CountriesService } from './services/countries.service';
import { SupabaseAuthService } from './services/supabase-auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: CountriesService,
          useValue: {
            getCountries: () => of([]),
          },
        },
        {
          provide: SupabaseAuthService,
          useValue: {
            user: signal(null),
            profile: signal(null),
            isAuthenticated: signal(false),
            isLoading: signal(false),
            lastError: signal(null),
            signInWithGoogle: async () => undefined,
            signOut: async () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Vexiio');
  });

  it('should render the main navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.menu-trigger')).toBeTruthy();
    expect(compiled.querySelector('.auth-button')).toBeTruthy();
  });
});
