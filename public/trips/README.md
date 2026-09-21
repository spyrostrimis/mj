# Trip photos

Images for the trips in `src/trips.js`, referenced as `/trips/<name>.<ext>`.

A trip may have one photo or several. With several, one is chosen per page
load, so the trip shows a different photo on every refresh and the same one
all the way through a session:

```js
{ date: '2026-09-21', place: 'Napoli', photos: ['/trips/napoli-1.webp', '/trips/napoli-2.webp'] }
{ date: '2026-05-08', place: 'Lisboa', photo:  '/trips/lisboa.webp' }
```

The three `placeholder-*.svg` files are TEST FAKE stand-ins and carry no real
content. Delete them once the real photos are in.

## Before adding real photos

These files are committed to the git repo and served by the public app shell,
which is not behind the password gate - only `/api/*` is. Anyone who knows or
guesses a filename can fetch the image directly. Decide that is acceptable
before adding anything you would not want found.

## Sizing and format

**WebP, quality ~80, 1200px on the long edge, under ~150KB each.** JPEG is a
fine fallback. The sheet is about 390 CSS px wide on a large phone, which is
~1170 real pixels at 3x, so 1200 is exactly enough and anything larger is pure
download weight. Desktop renders smaller, so the phone sets the size.

The frame takes the shape of the photo in it, so portrait and landscape both
show in full and nothing needs pre-cropping. It is clamped to between 3:4 and
2:1: a photo taller than 3:4 (a 9:16 screenshot, say) is cropped to 3:4 so it
cannot push the place and the date off the sheet, and anything wider than 2:1
is cropped to 2:1 rather than drawn as a strip.

Photos are fetched only when a sheet is opened - the sheet is not in the DOM
before that - so a large collection costs nothing on load. The app makes no
third-party request, so these are served from this origin like the fonts.
