# Trip photos

One image per trip, referenced from `src/trips.js` as `/trips/<name>.<ext>`.

The three `placeholder-*.svg` files are TEST FAKE stand-ins and carry no real
content. Delete them once the real photos are in.

## Before adding real photos

These files are committed to the git repo and served by the public app shell,
which is not behind the password gate - only `/api/*` is. Anyone who knows or
guesses a filename can fetch the image directly. Decide that is acceptable
before adding anything you would not want found.

## Sizing

The sheet renders them at 4:3, `object-fit: cover`, about 360px wide on a
phone. ~1200x900 is plenty; anything larger is only download weight. The app
makes no third-party request, so these are served from this origin like the
fonts.
