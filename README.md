# TerraFirmaCraft Alloy Calculator

A static TerraFirmaCraft alloy calculator that can be hosted directly on GitHub Pages. No backend, package manager, bundler, or build step is required.

## Files

- `index.html` - app layout
- `styles.css` - responsive dark UI
- `app.js` - alloy data, profile system, unit conversion, solvers, and local storage

## Features

- Current crucible/vessel metal input
- Per-row unit conversion: mB, 10 mB unit, nugget/small item, ingot/mold, double ingot, sheet, double sheet, vessel
- Settings panel for changing how much fluid one ingot/mold requires and how much fluid each item provides
- Import/export custom unit and item settings as JSON
- Alloy profile selector for TFC versions or modpacks
- Import/export custom alloy profiles as JSON
- Automatic alloy detection
- Result total shown in mB and in configured ingot/mold output count
- Percentage breakdown bars
- Capacity warnings for vessels/crucibles
- “What can I make?” recovery mode
- Smart correction suggestions for invalid mixes
- Full-ingot output recommendations that suggest adding up to or removing down to the nearest whole ingot/mold amount
- Batch planner with valid ingredient ranges
- Closest simple recipe solver using selectable granularity: 1 mB, 10 mB units, or whole ingots
- Browser local storage for saved state, custom profiles, and custom unit settings

## Hosting on GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the repository root.
3. Go to **Settings > Pages**.
4. Select **Deploy from a branch**.
5. Select the `main` branch and `/root` folder.
6. Save.

GitHub will provide a Pages URL after deployment.

## Editing built-in ratios

Default alloy data is near the top of `app.js` in `DEFAULT_PROFILES`.

Each alloy looks like this:

```js
{ name: 'Bronze', ingredients: { Copper: [88, 92], Tin: [8, 12] }, group: 'Primitive' }
```

The two numbers are the minimum and maximum valid percentage for that ingredient.

## Custom unit and item settings

Open **Settings** in the app to change fluid amounts without editing code. This controls every unit conversion in the app, including metal input rows, capacity, batch planning, recipe granularity, and the result output count shown as ingots/molds.

Useful examples:

- `Ingot / Mold`: how many mB are required to fill one ingot mold.
- `Nugget / Small Item`: how many mB one small melted item provides.
- `Vessel`: how much a vessel can hold if your pack changes vessel capacity.
- Custom rows: add any modpack-specific melted item and the mB it contributes.

Unit settings can be exported, downloaded, imported, or pasted as JSON:

```json
[
  { "id": "mb", "label": "mB", "mb": 1, "quick": true, "locked": true },
  { "id": "ingot", "label": "Ingot / Mold", "mb": 100, "quick": true, "locked": true },
  { "id": "nugget", "label": "Nugget / Small Item", "mb": 10, "quick": false, "locked": false }
]
```

The `quick` flag makes the unit appear in compact selectors like capacity and batch output. All units appear in metal input rows.


## Full ingot / mold output recommendations

The Result panel now shows the total molten amount both as mB and as the number of configured `Ingot / Mold` outputs. For example, if `Ingot / Mold` is set to 100 mB, `2976 mB` displays as `29.76 Ingot / Mold` and shows how far it is from the nearest whole output.

When the total is not a whole ingot/mold amount, **Smart Corrections** adds a rounding card:

- **Add up** to the next full ingot/mold using the configured unit sizes.
- **Remove down** to the previous full ingot/mold.
- For valid alloys, additive suggestions try to preserve the current alloy recipe.
- Removal suggestions are proportional so the alloy percentages stay the same.

## Custom profile JSON format

You can also export, edit, and import profiles in the app UI.

```json
{
  "id": "my-modpack",
  "name": "My Modpack",
  "notes": "Custom ratios for my server",
  "alloys": [
    {
      "name": "Bronze",
      "group": "Primitive",
      "ingredients": {
        "Copper": [88, 92],
        "Tin": [8, 12]
      }
    }
  ]
}
```

The validator checks that every alloy can plausibly add up to 100%.

## Notes

- The default ratios are provided as editable defaults and may not match every TerraFirmaCraft version or modpack.
- Ore yields vary by version and pack. The calculator works from molten metal amounts, so use the unit conversion that matches your setup.
