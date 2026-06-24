# TerraFirmaCraft Alloy Calculator

A static GitHub Pages app for calculating TerraFirmaCraft alloy percentages and planning additions to a vessel or crucible.

## Features

- Works on GitHub Pages with no build step.
- Detects valid alloy results from the current mixture.
- Shows percentage breakdowns and warnings for invalid mixes.
- Includes an alloy planner that calculates the smallest additions needed to make the current mix valid for a target alloy.
- Saves your current inputs in browser local storage.
- Alloy ratios are easy to edit in `app.js`.

## Included recipes

- Bronze
- Bismuth Bronze
- Black Bronze
- Brass
- Rose Gold
- Sterling Silver
- Weak Steel
- Weak Blue Steel
- Weak Red Steel

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the repository root.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root` folder.
6. Save. GitHub will publish the site after the Pages build finishes.

## Customize recipes

Open `app.js` and edit the `ALLOYS` array near the top of the file. Each ingredient uses `[minimumPercent, maximumPercent]`.

```js
{ name: 'Bronze', ingredients: { Copper: [88, 92], Tin: [8, 12] }, group: 'Primitive' }
```

## Notes

Ore and item yields can vary by TerraFirmaCraft version or modpack. This calculator only needs proportional amounts, so any consistent unit works.
