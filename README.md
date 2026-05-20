# Vexiio

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Supabase config

The frontend Supabase URL and publishable key are public browser config, not server secrets. They
are still generated from environment variables so values are not hardcoded in the repository.

Local PowerShell example:

```powershell
$env:SUPABASE_URL = "https://your-project-ref.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "your-publishable-key"
npm start
```

Alternatively, create an ignored `.env.local` file:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The npm scripts generate `src/app/config/supabase.generated.ts` automatically before `start`,
`test` and `build`. This generated file is ignored by Git.

For GitHub Actions:

- create a repository variable named `SUPABASE_URL`
- create a repository secret named `SUPABASE_PUBLISHABLE_KEY`

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Design System

Le Design System de l'application est documente ici:

- [docs/design-system.md](docs/design-system.md)
- [docs/security-architecture.md](docs/security-architecture.md)
- [docs/local-secrets.md](docs/local-secrets.md)

## Deploy to GitHub Pages

This repository includes a ready-to-use workflow:

- `.github/workflows/deploy-github-pages.yml`

It will:

1. install dependencies with `npm ci`
2. build with `--base-href /TreborKaa/`
3. create `404.html` from `index.html` for Angular routing fallback
4. deploy automatically to GitHub Pages on each push to `main`

### One-time setup in GitHub

1. Open repository **Settings -> Pages**
2. In **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` (or run the workflow manually from **Actions**)

After the first successful run, the site will be available at:

- `https://robertkaa.github.io/TreborKaa/`
