# Build Avatar Forge for iPhone

The iPhone project uses the permanent bundle identifier `com.kingcon42o.avatarforge` and targets iOS 15 or later.

## Requirements

- A Mac capable of running the current App Store-supported Xcode release
- Xcode 26 or later for App Store submission in 2026
- An Apple Account; Apple Developer Program membership is required for TestFlight and App Store distribution
- A physical iPhone for final camera and touch testing

## Build and test

1. Clone the repository with submodules and run `pnpm install`.
2. Run `pnpm exec cap sync ios` from the repository root.
3. Open `ios/App/App.xcodeproj` in Xcode.
4. Select the **App** target, open **Signing & Capabilities**, and choose your Apple Developer team.
5. Keep the bundle identifier as `com.kingcon42o.avatarforge`.
6. Connect an iPhone, select it as the run destination, and press **Run**.
7. Allow camera access when asked. Camera frames stay on the device and only drive the avatar.

## TestFlight or App Store

1. In Xcode, select **Any iOS Device (arm64)**.
2. Choose **Product → Archive**.
3. In Organizer, choose **Distribute App → App Store Connect → Upload**.
4. Complete privacy, age-rating, screenshots, support URL, and review details in App Store Connect.

The iPhone edition supports image import, automatic background cleanup, touch-based eye and mouth placement, saved profiles, and live head/eye/mouth camera tracking. The local Stable Diffusion generator is currently Windows/Android only because the downloadable model and native runtime have not yet been optimized and validated for iOS memory limits.
