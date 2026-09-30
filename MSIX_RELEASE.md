# Microsoft Store MSIX release

Install the Windows SDK, then run `pnpm package:msix` to create the Windows x64 MSIX package. Electron Builder prepares the package layout and Microsoft's MakeAppx tool produces the `.msix` container for Partner Center.

The current package uses the temporary identity `KingCon42O.AvatarForge` and the Store-build placeholder publisher. It is suitable for package validation, but Partner Center will provide the permanent identity values after the product name is reserved.

Before submission:

1. Reserve **Avatar Forge** as an MSIX app in Microsoft Partner Center.
2. Open **Product management → Product identity**.
3. Replace `build.appx.identityName` and, if provided by Partner Center, `build.appx.publisher` in `package.json` with the exact values shown there.
4. Rebuild with `pnpm package:msix` and upload the resulting `.msix` or `.msixupload` package.

The package declares `runFullTrust` for Electron and `webcam` for local avatar tracking. Microsoft Store distribution applies Microsoft's trusted signature after certification.
