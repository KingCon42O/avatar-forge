# Android release signing

The permanent application ID is `com.kingcon42o.avatarforge`.

Release credentials are deliberately excluded from this repository. Set these environment variables before building:

```text
AVATAR_FORGE_UPLOAD_KEYSTORE=<absolute path to the private .p12 file>
AVATAR_FORGE_UPLOAD_PASSWORD=<private password>
AVATAR_FORGE_UPLOAD_ALIAS=avatar-forge-upload
```

Then run `android\gradlew.bat bundleRelease` with Java 21 and the Android SDK configured. Never commit the keystore or recovery password. Back them up in at least two private locations. Google Play App Signing protects the app-signing key, but future updates still require this upload key unless it is reset through Play Console.
