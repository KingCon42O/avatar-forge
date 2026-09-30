# Avatar Forge

Avatar Forge is a Windows desktop tester for webcam-tracked 2D avatars. Upload an avatar image, map head movement, blinking, and mouth movement, then export a transparent HTML overlay for OBS or Streamlabs.

## Download

Use the latest release on this repository to download the portable Windows tester. Extract the ZIP and run `Avatar Forge.exe`.

Windows may show a SmartScreen warning because this community tester build is not code-signed.

## Features

- Local webcam face tracking
- Automatic conversion to transparent PNG on upload
- Adjustable background-removal strength with feathered edges
- Head movement, blink, mouth, and smoothing controls
- Local avatar settings
- Transparent OBS and Streamlabs browser-source export
- No account required inside the desktop app

## Development

Install dependencies with pnpm, then run:

```text
pnpm start
```

Create a Windows package with:

```text
pnpm package
```

The desktop studio bundles its tracking model locally. Exported OBS overlays load the tracking runtime from the internet.
