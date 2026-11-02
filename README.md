# Tray Heroes

An idle auto-battler that runs in a thin strip. A party of up to three low-poly heroes fights through waves on its own, drops chests, and gets stronger while you do something else. Pop the strip out and it floats above your other windows.

Play it at https://khoi.github.io/tray-heroes/. Every push to `main` runs the tests and deploys the build to GitHub Pages (`.github/workflows/pages.yml`); pull requests run the same build without deploying. Runtime assets load through `publicUrl()` in `src/ui/paths.ts` so the game works under the `/tray-heroes/` subpath.

```sh
npm install
npm run dev       # play at the printed URL
npm test          # game rules
npm run balance   # simulate a player, print time-to-milestone
```

## Playing

- **Battle strip.** A 3D diorama: heroes run right, fight a wave, run on. Each stage has 4–8 waves and ends with a stage boss; every tenth stage is an act boss. 3 acts (Greenwood, Sunken Crypt, Dragon's Lair) × 10 stages × 4 difficulties. Nightmare, Hell and Torment lower every resistance by 20, 40 and 60 points.
- **Pop out.** In Chrome or Edge 116+, the Pop out button moves the battle into an always-on-top Picture-in-Picture window. The menus stay in the tab. Close the window to bring the strip back.
- **Heroes.** Six classes: Knight (tank), Ranger (bow), Sorcerer (elemental area damage), Priest (heals, blessings, resurrection), Hunter (crossbow and traps) and Slayer (melee with life leech). The Knight is free; recruit the rest with gold. Up to three fight at once; the front hero takes the hits. Swapping a new hero in has a one-minute deploy cooldown.
- **Combat.** Hits can be dodged (no damage) or blocked (half damage). Physical damage is reduced by armor, elemental and chaos damage by resistances, then damage reduction and flat absorb apply. Hits can stun, freeze, chill, ignite, shock, poison or bleed.
- **Skills.** One point per level. Each class has 6 active skills and 16 passives in 8 tiers; a tier opens after 10 more points are spent. Actives fire on their own, every N attacks or on a cooldown, but only from the active slots (one to start, more from Awakening runes). Resetting is free.
- **Gear.** Ten slots: weapon, class off-hand, helm, armor, gloves, boots, amulet, earring, ring and bracer. Ten grades from Common to Cosmic; higher grades have more random stats, more sockets and, from Arcana, a chance to be a unique item with a special effect.
- **Chests** drop on a timer, not per kill: a common chest at most every 45 s, a boss chest every 90 s, an act chest every 10 min. Act bosses only leave a chest if you carry a Soulstone of that difficulty. Chests also hold gems, scrolls, Soulstones and Arcane Dust; monsters drop parts for engravings.
- **Cube** (opens when a hero reaches level 4; using it levels it up and unlocks more):
  - Synthesis: 9 items of one grade become 1 of a higher grade at a level you choose. From Immortal up it can fail and stay.
  - Alchemy: items become gold and Arcane Dust.
  - Craft: spend dust and gold on an item of a chosen type from a tier's odds table.
  - Sockets: gems in decoration sockets, monster parts in engravings, scrolls write a random inscription. Removal costs gold and destroys the material.
  - Offering: reroll a Legendary-or-better item's random stats.
  - Corrosion: turn items into Plaguelands contamination.
- **Runes.** A tree of 51 runes in six branches (Heroes, Wisdom, Gold, Storage, Treasure, Combat): party and skill slots, offline hours, chest auto-opening, bag and stash space, and stat bonuses. Resetting refunds everything.
- **Plaguelands.** Opens after Nightmare 1-10. Entering costs contamination, which drains while you fight there and refills elsewhere. Each intensity is harder and drops better loot, including relics; from intensity 6 a Contaminated Soulstone summons a contaminated boss.
- **Relics** come from the Plaguelands and sit in three reliquaries for party-wide stats, ×1.5 in a slot of their own color. Attunement rerolls a relic for rising gold.
- **Pets** unlock after enough kills of one monster type and give a party-wide bonus.
- **Offline.** With Repose, closing the tab still earns gold and XP at your recent online rate for up to 2 h, or 8 h with Long Repose. No chests drop offline. A hidden tab is still online: the game catches up when it gets CPU time again.

Progress saves to `localStorage` every 10 s and when the tab hides.

## Art and sound

Heroes, monsters, pets, weapons and scenery are low-poly models from [Polyfork](https://polyfork.dev), free for commercial use. `npm run fetch-models` rebuilds `public/models/` from the registry in `src/ui/battle/models.ts`: it downloads each model (baking structural knobs such as the witch's age), moves each prop's night-glow triangles into an unlit material, and compresses the GLB with meshopt. Downloads are cached in `.cache/polyfork/`; pass part of an id to rebuild only matching models.

Humanoids play Polyfork's motion-captured Idle, Walk and Run clips, which load from Polyfork's CDN at runtime because their license keeps the clips there. Attacks, bow draws, casts, hurt and death are poses layered on top: each pose aims a few bones in the character's own space, so one table animates every humanoid. Creatures use the Idle, Walk and Run clips baked into their GLB, plus a lunge.

`/lab.html` (dev server only) renders units side by side in any pose, for tuning poses and weapon grips: `/lab.html?units=knight,ranger&pose=shoot&t=0.6`.

Sounds and music are CC0; see [CREDITS.md](CREDITS.md).

## How it is built

```
src/game/   pure TypeScript, no DOM: the whole game
src/ui/     React panels + a three.js renderer that only reads game state
scripts/    balance simulation, model download
```

- `src/game/combat.ts` steps the simulation in fixed 100 ms ticks with a seeded RNG, so runs are reproducible and testable. `game.ts#advance` converts wall-clock time into ticks; gaps over 10 minutes become offline rewards instead.
- `src/game/schema.ts` is the save format (zod). Types are inferred from it, and saves are parsed at load, so a corrupt save starts a new game instead of crashing. `migrate.ts` upgrades version 1 saves: heroes, items and progress carry over and rune gold is refunded.
- `src/game/data/` holds every table a designer would tune: stats and damage types, classes, skill trees, grades and drop weights, item bases, affixes and uniques, materials, monsters, acts and the Plaguelands, runes, pets and relics. Growth rates, timers and Cube unlock levels live in `src/game/tuning.ts`.
- `combat.ts` runs a battle tick: hero turns pick a slotted skill or a basic attack, monsters pick a target (taunts first), hits resolve dodge → block → armor or resistance → reduction → absorb, and statuses, buffs and traps tick down. `cube.ts`, `actions.ts` and `loot.ts` hold every player action, each a pure function that returns a result instead of throwing.
- `src/ui/battle/` draws the strip with three.js. `stage.ts` is the world: camera, lights, fog, procedural low-poly ground, distant hills and scenery that recycles as the party runs. `unit.ts` is one hero or monster: model, animation mixer, weapon grips and the pose layer. `fx.ts` holds particles, projectiles, slashes, explosions and lightning, and `hud.ts` the DOM overlay (stage, waves, gold, chests, boss bar, health bars, damage numbers). `view.ts` turns game events into all of it: hits land on the attack's impact moment, with hit-stop, shake and sound. It renders on whichever window hosts it, so the battle keeps animating in the pop-out window while the main tab is hidden. `portraits.ts` renders the same models into the portraits the panels show.

## Balancing

`npm run balance -- <hours> <seed>` plays the game with a bot that opens chests, equips upgrades, synthesizes and sells junk every 15 simulated seconds. It prints when each act was first cleared. Current tuning, two seeds:

| Milestone | Seed 7 | Seed 31 |
|---|---|---|
| Normal cleared | 1.9 h | 2.0 h |
| Nightmare cleared | 3.8 h | 4.0 h |
| Hell cleared | 6.8 h | 7.1 h |
| Torment cleared | 26 h | 17 h |

The bot recruits heroes, spends skill points, fills sockets and buys runes, but doesn't use the Plaguelands, crafting or relics.

Add `--save path.json` to the balance command to write the bot's save. Paste it into `localStorage["tray-heroes/save"]` to jump to that point in the game.

To test with everything unlocked, open `/?sandbox` while running `npm run dev`. It starts a new game with all six heroes at level 30, 10B gold, chests, materials, relics, a level 25 Cube and the Plaguelands open.

## Credits

3D models by Polyfork; sounds, music and icons are CC0 packs by pixel-boy & AAA and Kenney. See [CREDITS.md](CREDITS.md).
