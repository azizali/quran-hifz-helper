# Quran Hifz Helper

A Quran memorization practice player built with React, Vite, TypeScript and Tailwind CSS. It ships three ways from one codebase:

- **Web / PWA** at [quran.azizali.com](https://quran.azizali.com)
- **iOS app** (Capacitor)
- **Android app** (Capacitor)

## Features

- Audio playback of Quranic verses with multiple Qaris
- Repeat, playback speed, bookmarks, per-ayat selection
- Web: installable PWA with cached audio for offline use
- iOS/Android: native queue player that keeps playing with the screen off, lock-screen and notification controls, and a "Download for offline" button per surah

## Prerequisites

| For | You need |
| :-- | :-- |
| Everything | Node 20+ and [pnpm](https://pnpm.io) (`corepack enable` picks up the pinned version) |
| iOS | macOS, Xcode (full app, not just Command Line Tools), an iOS simulator or device |
| Android | Android Studio (SDK + an emulator or device). JDK 21 is downloaded automatically by Gradle |

Then install dependencies once:

```bash
pnpm install
```

## Running the web app

```bash
pnpm dev        # http://localhost:5173 with hot reload
pnpm build      # type-check + production build into dist/
pnpm preview    # serve the production build locally
```

The web build is what is deployed to quran.azizali.com. Nothing native is involved: on the web the app uses the original concatenated-audio player and the service worker.

## Running the iOS app

```bash
pnpm ios
```

This builds the web app, syncs it into the native project and opens Xcode. In Xcode pick a simulator (or your device) and press Run.

- The project is `ios/App/App.xcodeproj` (dependencies via Swift Package Manager, there is no workspace or Pods).
- To run on a real device, select the **App** target, then **Signing & Capabilities**, and choose your Apple team.
- If command-line builds complain about missing tools, point the command-line tools at Xcode once: `sudo xcode-select -s /Applications/Xcode.app`.

## Running the Android app

```bash
pnpm android
```

This builds the web app, syncs it into the native project and opens Android Studio. Pick an emulator or device and press Run.

To build from the command line instead, Gradle needs a JDK to launch. Android Studio's bundled one works:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleDebug     # APK in android/app/build/outputs/apk/debug/
```

## Commands

All commands run from the project root.

| Command | Action |
| :-- | :-- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Web dev server at `localhost:5173` |
| `pnpm build` | Type-check and build the web app to `dist/` |
| `pnpm preview` | Preview the production web build |
| `pnpm lint` | Run ESLint |
| `pnpm sync` | Build the web app and copy it into both native projects |
| `pnpm ios` | Build, sync, and open the iOS project in Xcode |
| `pnpm android` | Build, sync, and open the Android project in Android Studio |

**After changing any web code, run `pnpm sync` (or `pnpm ios` / `pnpm android`) before running the native app.** The native apps ship a copy of `dist/`, so they will not see your changes until you sync. Changing only native code (Swift or Kotlin) needs no sync, just rebuild in Xcode or Android Studio.

## How the project is laid out

```
src/                       React app (shared by web, iOS, Android)
  components/hooks/
    useQuranPlayer.ts        picks the web or native player at startup
    useWebQuranPlayer.ts     web: concatenates ayats into one WAV, MediaSession
    useNativeQuranPlayer.ts  native: drives the NativeQuranAudio plugin
  native-audio/              TypeScript side of the native plugin + offline downloads
  _main/platform.ts          isNativePlatform() helper
android/                   Android project (Capacitor + Kotlin audio plugin)
ios/                      iOS project (Capacitor + Swift audio plugin)
capacitor.config.ts       app ID (com.azizali.quran) and name
```

The two platforms play audio differently on purpose. The web player stitches ayats into one file so browsers keep playing in the background. The native apps instead use a real audio queue (`AVQueuePlayer` on iOS, Media3 ExoPlayer plus a foreground service on Android), which gives lock-screen controls and survives hours of background playback.

The native audio plugin is a local plugin. Its code lives in the app projects, not in `node_modules`:

- iOS: `ios/App/App/NativeQuranAudioPlugin.swift`, registered in `ios/App/App/AppBridgeViewController.swift`
- Android: `android/app/src/main/java/com/azizali/quran/NativeQuranAudioPlugin.kt` and `QuranPlaybackService.kt`, registered in `MainActivity.java`
- TypeScript contract: `src/native-audio/definitions.ts`

If you add a plugin method, update all three.

## Changing the app ID, name or icon

- **App ID** (permanent once published): `com.azizali.quran`. It appears in `capacitor.config.ts`, `android/app/build.gradle`, the Android package folder `android/app/src/main/java/com/azizali/quran`, and the iOS bundle identifier in Xcode.
- **App name**: `appName` in `capacitor.config.ts`, then `pnpm sync`.
- **Icon and splash**: put a 1024x1024 `icon-only.png` (and optional `splash.png`) in an `assets/` folder and run `npx @capacitor/assets generate`. The current icons were upscaled from the 512px web icon, so a 1024px original will look sharper.

## Releasing

- **Web**: deploy the `dist/` folder from `pnpm build`.
- **iOS**: in Xcode, Product > Archive, then upload to App Store Connect. Needs an Apple Developer account.
- **Android**: in Android Studio, Build > Generate Signed Bundle / APK. Needs a keystore and a Google Play developer account. Keep the keystore safe, Google needs the same one for every update.

## Notes and todo

- Repeat it N times and then stop
- Show full time length of each ayat and the full selection

- [x] Cache previously loaded Surahs
- [x] Update web app when it updates
- [x] Show icons on what is downloaded/cached
- [x] iOS and Android apps
- [ ] Optional "continue to next surah" toggle (the native player supports it, there is no UI yet)
- [~] FIX: On initial load shows the first ayat
  - The problem is in Brave, not in Chrome.
- [ ] FIX: The audio stops on the next ayat
  - Could not replicate. Maybe the problem is in Brave only
- [ ] FIX: Click on 'Play' does not Play and have to click 'play' button on player to play
  - Could not replicate. Maybe the problem is in Brave only
- [ ] Known lint findings in older web code (`pnpm lint` reports them)

Additional features

- [ ] Add all 15 page quran pages.
- [ ] Make a playlist feature
- [ ] User account
- [ ] Save preferences in user account

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, vite-plugin-pwa, usehooks-ts, Capacitor 8 (iOS via Swift Package Manager), AVFoundation (iOS), Media3 ExoPlayer (Android).
