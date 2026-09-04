# Infinity Spark mobile release

Infinity Spark is packaged as a Capacitor Android application with the ID `com.infinity.c13b0`. The same Next.js source continues to publish the GitHub Pages website and now exports a local web bundle for the Android WebView.

## Android development build

Requirements: Node.js 22+, Android Studio, Android SDK, and Java 21.

```bash
npm ci
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Google Play release bundle

Create a private Android signing key, configure the release signing block locally or in a protected CI secret, then run:

```bash
npm run android:bundle
```

The upload bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`. Never commit the keystore or its passwords.

## Store listing checklist

- App name: Infinity Spark
- Package ID: `com.infinity.c13b0`
- Category: Productivity
- Privacy-policy URL and support contact
- Phone screenshots and 512×512 store icon
- Feature graphic (1024×500)
- Data Safety answers covering local search history, wallet storage, external research APIs, and any analytics
- Content rating and target-audience declarations
- Signed `.aab` uploaded through the owner's Google Play Console

The repository can generate a build, but publication remains an owner-controlled step because Google requires identity, legal declarations, signing custody, and store review.
