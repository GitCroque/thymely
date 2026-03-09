# Translations

Thymely supports 16 languages through [next-translate](https://github.com/aralroca/next-translate). Translation files are simple JSON key-value pairs.

## Supported locales

| Code | Language |
| --- | --- |
| `en` | English |
| `da` | Danish |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `he` | Hebrew |
| `hu` | Hungarian |
| `is` | Icelandic |
| `it` | Italian |
| `no` | Norwegian |
| `pt` | Portuguese |
| `se` | Swedish |
| `th` | Thai |
| `tl` | Filipino |
| `tr` | Turkish |
| `zh-CN` | Chinese (Simplified) |

## Translation files

All translation files are located at:

```
apps/client/locales/<locale-code>/thymely.json
```

For example, the French translation file is `apps/client/locales/fr/thymely.json`.

Each file is a flat JSON object with translation keys and their values:

```json
{
  "welcome": "Bienvenue",
  "login": "Connexion",
  "logout": "Deconnexion"
}
```

Use the English file (`apps/client/locales/en/thymely.json`) as the reference for all keys.

## Adding a new language

1. **Create the locale directory and file:**

   ```bash
   mkdir apps/client/locales/<code>
   cp apps/client/locales/en/thymely.json apps/client/locales/<code>/thymely.json
   ```

2. **Translate the values** in the new file. Keep all keys identical to the English file.

3. **Register the locale** in `apps/client/i18n.js`. Add your locale code to the `locales` array:

   ```javascript
   locales: ["en", "da", "de", "es", "fr", ..., "<code>"],
   ```

4. **Test locally:**

   ```bash
   yarn dev
   ```

   Then visit `http://localhost:3000/<code>/` to verify the translations display correctly.

## Contributing translations

If you want to contribute a translation or fix errors in an existing one:

1. Fork the repository.
2. Edit or create the translation file.
3. Open a pull request with a clear description of the language and changes.

Partial translations are accepted. Missing keys fall back to English automatically.
