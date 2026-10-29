# Tray Heroes

An idle auto-battler that runs in a thin strip. A party of up to three pixel heroes fights through waves on its own, drops chests, and gets stronger while you do something else. Pop the strip out and it floats above your other windows.

```sh
npm install
npm run dev       # play at the printed URL
npm test          # game rules
npm run balance   # simulate a player, print time-to-milestone
```

## Playing

- **Battle strip.** Heroes walk right, fight a wave, walk on. Each stage has 4–8 waves and ends with a stage boss; every tenth stage is an act boss.
- **Pop out.** In Chrome or Edge 116+, the Pop out button moves the battle into an always-on-top Picture-in-Picture window. The menus stay in the tab. Close the window to bring the strip back.
- **Chests** drop on a timer, not per kill: a common chest can drop at most every 45 s, a boss chest every 90 s, an act chest every 10 min. Open them from the Bag tab, the header, or by clicking the chest icon on the strip.
- **Cube.** Synthesis turns 9 items of one grade into 1 item of a higher grade (sometimes two grades higher; from Legendary up it can fail and stay). Alchemy turns items into gold.
- **Runes** are permanent upgrades bought with gold. Fellowship adds party slots, Repose turns on offline rewards, Mainspring auto-opens chests.
- **Pets** unlock after enough kills of one monster type and give a party-wide bonus.
- **Offline.** With Repose, closing the tab still earns gold and XP at your recent online rate for up to 2 h, or 8 h with Long Repose. No chests drop offline. A hidden tab is still online: the game catches up when it gets CPU time again.

Progress saves to `localStorage` every 10 s and when the tab hides.

## Art and sound

Units, weapons, effects, sounds and music are CC0 and live in `public/`. `npm run import-art` rebuilds them from the source packs, cropping sprite sheets into one atlas per unit and writing a manifest the renderer reads:

```sh
npm run import-art -- --dungeon <0x72_DungeonTilesetII_v1.7> --ninja "<Ninja Adventure - Asset Pack>"
```

For hand-animated attack, hurt and death frames, buy Zerie's Tiny RPG Character Asset Packs 01 and 02 and run `npm run import-art -- --zerie <pack 01 dir> <pack 02 dir>`. The result goes to `public/art/licensed/` (git-ignored, the license forbids redistribution) and overrides the CC0 units it covers. Hit frames are detected from the sheets, so attacks land on the right frame without hand tuning.

## How it is built

```
src/game/   pure TypeScript, no DOM: the whole game
src/ui/     React panels + a PixiJS renderer that only reads game state
scripts/    balance simulation
```

- `src/game/combat.ts` steps the simulation in fixed 100 ms ticks with a seeded RNG, so runs are reproducible and testable. `game.ts#advance` converts wall-clock time into ticks; gaps over 10 minutes become offline rewards instead.
- `src/game/schema.ts` is the save format (zod). Types are inferred from it, and saves are parsed at load, so a corrupt save starts a new game instead of crashing.
- `src/game/data/` holds every table a designer would tune: classes, grades and drop weights, item bases and affixes, monsters and acts, runes, pets. Growth rates and timers live in `src/game/tuning.ts`.
- `src/ui/battle/` draws the strip with PixiJS 8 in a 56-pixel-tall world scaled up by a whole number, so pixels stay crisp. Units play idle, walk, attack, hurt and death; hits land on the attack's impact frame with slash, spark and explosion effects, knockback, hit-stop and sound. It renders on whichever window hosts it, so the battle keeps animating in the pop-out window while the main tab is hidden.

## Balancing

`npm run balance -- <hours> <seed>` plays the game with a bot that opens chests, equips upgrades, synthesizes, sells junk and buys the cheapest rune every 15 simulated seconds. It prints when each act was first cleared. Current tuning, two seeds:

| Milestone | Seed 7 | Seed 31 |
|---|---|---|
| Normal cleared | 0.6 h | 0.6 h |
| Nightmare cleared | 1.5 h | 1.7 h |
| Hell cleared | 3.1 h | 3.5 h |
| Torment cleared | 38 h | 28 h |

Add `--save path.json` to the balance command to write the bot's save. Paste it into `localStorage["tray-heroes/save"]` to jump to that point in the game.

To test with everything unlocked, open `/?sandbox` while running `npm run dev`. It starts a new game with all three heroes in the party, 10B gold and 18 chests.

## Credits

Art and audio are CC0 packs by 0x72, pixel-boy & AAA, Kenney and Clint Bellanger; see [CREDITS.md](CREDITS.md).
