# Quran Hifz Helper - powered by Astro

## Todo

- [x] Cache previously loaded Surahs
- [x] Update web app when it updates
- [x] Show icons on what is downloaded/cached
- [~] FIX: On initial load shows the first ayat
  - The problem is in Brave, not in Chrome.
- [ ] FIX: The audio stops on the next ayat
  - Could not replicate. Maybe the problem is in Brave only
- [ ] FIX: Click on 'Play' does not Play and have to click 'play' button on player to play
  - Could not replicate. Maybe the problem is in Brave only

Additional Features

- [ ] Add all 15 page quran pages.
- [ ] Make a playlist feature
- [ ] User account
- [ ] Save preferences in user account

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

```sh
npm create astro@latest -- --template basics
```

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
