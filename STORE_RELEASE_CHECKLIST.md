# Store release checklist

The permanent Android package ID and Apple bundle ID are confirmed as `com.kingcon42o.avatarforge`.

## Already prepared

- Local-only camera tracking and bundled model
- Android and iOS Capacitor projects with the permanent ID `com.kingcon42o.avatarforge`
- Camera and photo-library permission descriptions
- Android target SDK 36 configuration
- Store icon master and generated platform icon sets
- Windows MSIX packaging target with webcam capability and replaceable Partner Center identity
- Privacy policy, EULA, proprietary licence, support URL, and listing copy
- No analytics, advertisements, Avatar Forge accounts, or developer-operated cloud collection
- Local AI disclosure: the optional model downloads from Hugging Face; prompts, camera frames, imported artwork, and generated images stay on device

## Publisher must complete

1. Confirm that `KingCon42O` is the desired public seller/copyright name.
2. Create or use Apple Developer and Google Play Console accounts and complete their identity, tax, banking, and trader-status forms.
3. Host the privacy policy at a stable public URL (the GitHub URL can be used initially).
4. Securely back up the generated Google Play upload keystore and recovery credentials in two private locations, then upload the signed Android App Bundle to Play internal testing.
5. On macOS with Xcode, select the Apple team, configure signing, archive the iOS project, and upload it to TestFlight.
6. Capture current phone/tablet screenshots and complete content rating, age rating, accessibility, and export-compliance questionnaires.
7. Test on several real devices, including camera denial, camera re-grant, imported transparent and non-transparent artwork, rotation, interruptions, and low-memory recovery.
8. Set a paid price in each store. Do not add external purchase links inside the mobile app.
9. In Microsoft Partner Center, reserve **Avatar Forge**, then replace the temporary MSIX `identityName` and publisher values with the exact values shown under **Product identity** before the Store submission build.

Before every submission, re-check current target-SDK, privacy-manifest, and review-policy requirements.
