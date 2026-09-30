# Avatar Forge

Avatar Forge is a private, webcam-tracked 2D avatar studio for Windows, Android, and iOS. Upload an avatar image, automatically remove its background, map head movement, blinking, and mouth movement, and use the desktop edition to export a transparent HTML overlay for OBS or Streamlabs.

## Download

Use the latest release on this repository to download the portable Windows tester. Extract the ZIP and run `Avatar Forge.exe`.

Windows may show a SmartScreen warning because this community tester build is not code-signed.

## Features

- Local webcam face tracking
- Automatic conversion to transparent PNG on upload
- Free local AI Avatar Creator that generates rig-ready transparent PNGs
- No API key, account, subscription, or per-image fee
- Adjustable background-removal strength with feathered edges
- Head movement, blink, mouth, and smoothing controls
- Local avatar settings
- Transparent OBS and Streamlabs browser-source export
- No account required inside the desktop app
- Native Android and iOS projects with on-device processing
- Store privacy policy, permission disclosures, app icon, listing copy, and release checklist

## Development

Install dependencies with pnpm, then run:

```text
pnpm start
```

Create a Windows package with:

```text
pnpm package
```

Create a Microsoft Store MSIX candidate with the Windows SDK installed:

```text
pnpm package:msix
```

Sync the native Android and iOS projects after web changes:

```text
pnpm mobile:sync
```

Open the Android project with `pnpm mobile:android` or the iOS project on macOS with `pnpm mobile:ios`.

The Android project targets API 36. A signed Google Play App Bundle requires a private upload key. The iOS project requires macOS, Xcode, an Apple Developer team, and signing before TestFlight or App Store submission.

The desktop studio bundles its tracking model locally. Exported OBS overlays load the tracking runtime from the internet.

The AI Avatar Creator runs locally on Windows and 64-bit Android. Its approximately 1.6 GB Stable Diffusion model downloads once on demand and is stored in the app's private data. Windows automatically tries Vulkan acceleration and falls back to CPU; Android uses an ARM64 CPU build for broad compatibility. Prompts, webcam frames, artwork, and generated images stay on the device. AI creation is not included in the iOS edition yet.

See [STORE_RELEASE_CHECKLIST.md](STORE_RELEASE_CHECKLIST.md), [PRIVACY.md](PRIVACY.md), and [EULA.md](EULA.md) before publication.
