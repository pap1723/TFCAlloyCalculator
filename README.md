# TerraFirmaCraft Alloy Calculator

A static TerraFirmaCraft alloy calculator that can be hosted directly on GitHub Pages. No backend, package manager, bundler, or build step is required.

## Files

- `index.html` - app layout
- `styles.css` - responsive dark UI
- `app.js` - alloy data, profile system, unit conversion, solvers, and local storage

## Features

- Current crucible/vessel metal input
- Per-row unit conversion: mB, 10 mB unit, ingot, double ingot, sheet, double sheet, vessel
- Alloy profile selector for TFC versions or modpacks
- Import/export custom alloy profiles as JSON
- Automatic alloy detection
- Percentage breakdown bars
- Capacity warnings for vessels/crucibles
- “What can I make?” recovery mode
- Smart correction suggestions for invalid mixes
- Batch planner with valid ingredient ranges
- Closest simple recipe solver using selectable granularity: 1 mB, 10 mB units, or whole ingots
- Browser local storage for saved state and custom profiles

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
