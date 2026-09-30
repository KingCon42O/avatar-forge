# Avatar Forge Privacy Policy

Effective date: 30 September 2026

Avatar Forge is designed to process webcam video and avatar artwork on your device.

## Data the app uses

- **Camera video:** used in real time to estimate head, eye, and mouth movement. Camera frames are not uploaded, recorded, sold, or shared by Avatar Forge.
- **Avatar artwork:** images you select are processed locally to create a transparent avatar and are stored only in the app's local storage unless you export or share them.
- **Settings:** avatar names and rig settings may be saved locally on your device.
- **Optional AI avatar creation:** when you press **Create PNG**, the text description, selected style, and quality setting are sent to OpenAI's Image API. Camera frames, face-tracking data, and uploaded artwork are not included. OpenAI returns a generated transparent PNG to the app. OpenAI's own privacy terms apply to that request.
- **OpenAI API key:** the Windows and Android editions let you supply your own key. It is encrypted through Windows secure storage or Android Keystore before being saved locally. It is sent to OpenAI only to authenticate an AI image request and is not sent to the Avatar Forge developer.

Avatar Forge does not require an Avatar Forge account and does not include advertising, analytics, tracking SDKs, or a developer-operated cloud service in this release. Optional AI generation requires an OpenAI API account and may incur charges from OpenAI.

## Permissions

Camera access is optional and begins only after you press **Start camera tracking**. You can revoke camera access in your device settings. File or photo access is used only when you choose avatar artwork.

## Exports and third parties

Files you export are under your control. The desktop OBS overlay may download the MediaPipe tracking runtime from Google-hosted and jsDelivr-hosted resources when you open that exported overlay. Optional AI generation sends the information described above directly to OpenAI. Those providers' own privacy terms apply to their network requests. The installed Avatar Forge app bundles its face-tracking runtime locally.

## Children

Avatar Forge is not directed to children under 13 and does not knowingly collect personal information.

## Changes and contact

Material changes will be published with a new effective date. For privacy questions or deletion help, open a support request at <https://github.com/KingCon42O/avatar-forge/issues>.
