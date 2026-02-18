# SeedOfLife

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.11.

## Development server

Run `npm start` to start both Angular + API together.
If needed, you can also run them separately with `npm run start:web` and `npm run start:api`.
Navigate to `http://localhost:4200/`. The application will automatically reload if you change any source files.

### YouTube API key setup (server-side)
1. Copy `.env.example` to `.env`.
2. Set `YOUTUBE_API_KEY` in `.env`.
3. Keep `.env` out of git (already ignored).

### GitHub Pages deployment safety
- GitHub Pages is static, so `/api` endpoints are not hosted there.
- The app now uses fallback order: `Backend API -> direct YouTube API (assets/env.js) -> built-in fallback videos`.
- For full live + full sermons list on GitHub Pages, set a **restricted browser key** in `src/assets/env.js`:
  - Restrict by HTTP referrer to `https://www.seedoflifeinternational.org/*` and `https://newtondevarapalli.github.io/*`.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Deploy npm run deploy
ng build --configuration production --base-href "https://newtondevarapalli.github.io/seed-of-life/"
copy dist\seed-of-life\browser\index.html dist\seed-of-life\browser\404.html
npx angular-cli-ghpages --dir=dist/seed-of-life/browser --cname=www.seedoflifeinternational.org
https://newtondevarapalli.github.io/seed-of-life/

