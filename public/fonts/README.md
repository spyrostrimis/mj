# Fonts

Self-hosted so the app makes no runtime request to Google. The `@font-face`
rules live at the top of `public/css/styles.css`.

| File | Family | Styles / weights | Subset | Used for |
| --- | --- | --- | --- | --- |
| `instrument-sans-latin-normal.woff2` | Instrument Sans | 400, 500, 600 | latin | UI text |
| `instrument-sans-latin-ext-normal.woff2` | Instrument Sans | 400, 500, 600 | latin-ext | Turkish |
| `instrument-serif-latin-normal.woff2` | Instrument Serif | 400 | latin | titles |
| `instrument-serif-latin-ext-normal.woff2` | Instrument Serif | 400 | latin-ext | Turkish titles |
| `instrument-serif-latin-italic.woff2` | Instrument Serif | 400 italic | latin | entry bodies |
| `instrument-serif-latin-ext-italic.woff2` | Instrument Serif | 400 italic | latin-ext | Turkish entry bodies |
| `inter-greek-normal.woff2` | Inter | 400, 500, 600 | greek | Greek sans fallback |
| `inter-greek-italic.woff2` | Inter | 400, 500, 600 italic | greek | Greek sans fallback |
| `eb-garamond-greek-normal.woff2` | EB Garamond | 400 | greek | Greek serif fallback |
| `eb-garamond-greek-italic.woff2` | EB Garamond | 400 italic | greek | Greek serif fallback |

Instrument Sans and Inter are variable fonts: the three weights share one file
and one `@font-face` per weight pins the `wght` axis, exactly as Google's own
CSS does.

Greek is outside the latin and latin-ext unicode ranges, so Greek characters
fall through to the second family in each stack. Those faces carry the greek
`unicode-range`, so the files stay off the wire until Greek text is rendered.

## Refreshing

Ask the Google Fonts CSS API (the `css2` endpoint) for these two queries, with
a modern browser User-Agent - an old UA gets you a single unsubsetted TTF
instead of per-subset woff2:

    family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap
    family=EB+Garamond:ital,wght@0,400;1,400&family=Inter:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap

Keep the `latin` and `latin-ext` blocks from the first and the `greek` blocks
from the second, download the files they reference, and re-copy each
`unicode-range` verbatim. The host names are deliberately left out of this
file, so that grepping the repo for them keeps coming back empty.

## License

All four families are licensed under the SIL Open Font License 1.1. The
licenses ship next to the fonts, as the OFL requires of redistributed copies:
`OFL-instrument-sans.txt`, `OFL-instrument-serif.txt`, `OFL-inter.txt`,
`OFL-eb-garamond.txt`.
