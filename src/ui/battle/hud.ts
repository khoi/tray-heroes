import font400 from "@fontsource/pixelify-sans/files/pixelify-sans-latin-400-normal.woff2?url";
import font600 from "@fontsource/pixelify-sans/files/pixelify-sans-latin-600-normal.woff2?url";
import type { SpriteRef } from "../../game/types";
import { spriteStyle } from "../sprites";

const CSS = `
@font-face { font-family: "Pixelify Sans"; font-weight: 400; src: url(${font400}) format("woff2"); }
@font-face { font-family: "Pixelify Sans"; font-weight: 600; src: url(${font600}) format("woff2"); }
.bh { position: absolute; inset: 0; pointer-events: none; overflow: hidden; font-family: "Pixelify Sans", ui-sans-serif, system-ui, sans-serif; font-weight: 600; color: #fff; user-select: none; }
.bh-text { text-shadow: 0 2px 0 #2e222f, 2px 0 0 #2e222f, -2px 0 0 #2e222f, 0 -2px 0 #2e222f, 1px 1px 0 #2e222f, -1px -1px 0 #2e222f, 1px -1px 0 #2e222f, -1px 1px 0 #2e222f; }
.bh-stage { position: absolute; left: 10px; top: 6px; font-size: 13px; }
.bh-waves { position: absolute; left: 11px; top: 26px; display: flex; gap: 3px; }
.bh-waves i { width: 6px; height: 4px; background: #000; outline: 1px solid rgb(255 255 255 / 0.6); }
.bh-waves i.done { background: #ffd23f; outline: none; }
.bh-waves i.now { background: #fff; outline: none; }
.bh-right { position: absolute; right: 10px; top: 4px; display: flex; align-items: center; gap: 14px; }
.bh-gold { display: flex; align-items: center; gap: 4px; font-size: 15px; color: #ffd23f; transform-origin: right center; }
.bh-chest { pointer-events: auto; cursor: pointer; display: flex; align-items: center; gap: 4px; font: inherit; font-size: 15px; color: #fff; background: none; border: none; padding: 0; transform-origin: center; }
.bh-chest:disabled { cursor: default; opacity: 0.7; }
.bh-icon { display: inline-block; image-rendering: pixelated; background-repeat: no-repeat; }
.bh-banner { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 22px; letter-spacing: 2px; opacity: 0; }
.bh-boss { position: absolute; left: 50%; top: 4px; transform: translateX(-50%); display: none; flex-direction: column; align-items: center; gap: 3px; }
.bh-boss-name { font-size: 11px; color: #ffb0b0; }
.bh-boss-bar { width: min(220px, 30vw); height: 9px; background: #2e222f; padding: 2px; box-sizing: border-box; }
.bh-boss-bar span { display: block; height: 100%; background: #ff8a3d; }
.bh-boss.act .bh-boss-bar span { background: #ff4d6d; }
.bh-bar { position: absolute; left: 0; top: 0; width: 34px; height: 5px; margin-left: -17px; background: #2e222f; padding: 1px; box-sizing: border-box; }
.bh-bar span { display: block; height: 100%; background: #6fd36a; }
.bh-bar.foe span { background: #ff6b6b; }
.bh-float { position: absolute; left: 0; top: 0; white-space: nowrap; transform: translate(-50%, -100%); animation: bh-float 0.9s ease-out forwards; }
.bh-flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
@keyframes bh-float {
  0% { opacity: 0; translate: 0 6px; scale: 0.6; }
  12% { opacity: 1; translate: 0 0; scale: 1.1; }
  25% { scale: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; translate: 0 -26px; }
}
@media (prefers-reduced-motion: reduce) { .bh-float { animation-duration: 0.01s; } }
`;

function icon(sprite: SpriteRef, scale: number): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "bh-icon";
  for (const [key, value] of Object.entries(spriteStyle(sprite, scale))) el.style.setProperty(key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), typeof value === "number" ? `${value}px` : String(value));
  return el;
}

function div(className: string, parent: HTMLElement): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  parent.append(el);
  return el;
}

export class Hud {
  readonly root = document.createElement("div");
  private readonly stage: HTMLDivElement;
  private readonly waves: HTMLDivElement;
  private readonly gold: HTMLDivElement;
  private readonly goldText = document.createElement("span");
  private readonly chest = document.createElement("button");
  private readonly chestText = document.createElement("span");
  private readonly banner: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private readonly bossName: HTMLDivElement;
  private readonly bossFill = document.createElement("span");
  private readonly flashEl: HTMLDivElement;
  private readonly bars = new Map<number, { el: HTMLDivElement; fill: HTMLSpanElement }>();
  private waveKey = "";
  private bannerT = 0;
  private goldPulse = 0;
  private chestPulse = 0;
  private flash = 0;

  constructor(onChest: () => void) {
    this.root.className = "bh";
    const style = document.createElement("style");
    style.textContent = CSS;
    this.root.append(style);
    this.flashEl = div("bh-flash", this.root);
    this.stage = div("bh-stage bh-text", this.root);
    this.waves = div("bh-waves", this.root);
    this.boss = div("bh-boss", this.root);
    this.bossName = div("bh-boss-name bh-text", this.boss);
    div("bh-boss-bar", this.boss).append(this.bossFill);
    const right = div("bh-right", this.root);
    this.chest.type = "button";
    this.chest.className = "bh-chest bh-text";
    this.chest.title = "Open a chest";
    this.chest.append(icon({ sheet: "dungeon", index: 89 }, 1.5), this.chestText);
    this.chest.addEventListener("click", onChest);
    right.append(this.chest);
    this.gold = div("bh-gold bh-text", right);
    this.gold.append(icon({ sheet: "custom", name: "coin" }, 1.25), this.goldText);
    this.banner = div("bh-banner bh-text", this.root);
  }

  get goldAnchor(): { x: number; y: number } {
    return this.anchor(this.gold);
  }

  get chestAnchor(): { x: number; y: number } {
    return this.anchor(this.chest);
  }

  private anchor(el: HTMLElement): { x: number; y: number } {
    const host = this.root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - host.left + 10, y: r.top - host.top + r.height / 2 };
  }

  setStage(text: string): void {
    if (this.stage.textContent !== text) this.stage.textContent = text;
  }

  setWaves(total: number, current: number): void {
    const key = `${total}/${current}`;
    if (key === this.waveKey) return;
    this.waveKey = key;
    this.waves.replaceChildren(
      ...Array.from({ length: total }, (_, i) => {
        const dot = document.createElement("i");
        if (i < current) dot.className = "done";
        else if (i === current) dot.className = "now";
        return dot;
      }),
    );
  }

  setGold(text: string): void {
    if (this.goldText.textContent !== text) this.goldText.textContent = text;
  }

  setChests(count: number): void {
    const text = String(count);
    if (this.chestText.textContent !== text) this.chestText.textContent = text;
    this.chest.disabled = count === 0;
  }

  setBoss(name: string | null, ratio: number, act: boolean): void {
    this.boss.style.display = name ? "flex" : "none";
    if (!name) return;
    if (this.bossName.textContent !== name) this.bossName.textContent = name;
    this.boss.classList.toggle("act", act);
    this.bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  showBanner(text: string): void {
    this.banner.textContent = text;
    this.bannerT = 1.4;
  }

  pulseGold(): void {
    this.goldPulse = 1;
  }

  pulseChest(): void {
    this.chestPulse = 1;
  }

  screenFlash(amount: number): void {
    this.flash = Math.max(this.flash, amount);
  }

  float(text: string, x: number, y: number, size: number, color: string): void {
    const el = div("bh-float bh-text", this.root);
    el.textContent = text;
    el.style.left = `${Math.round(x + (Math.random() - 0.5) * 10)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.fontSize = `${size}px`;
    el.style.color = color;
    el.addEventListener("animationend", () => el.remove());
    const floats = this.root.querySelectorAll(".bh-float");
    if (floats.length > 40) floats[0]?.remove();
  }

  bar(id: number, x: number, y: number, ratio: number, foe: boolean, visible: boolean): void {
    let bar = this.bars.get(id);
    if (!bar) {
      const el = div(`bh-bar${foe ? " foe" : ""}`, this.root);
      const fill = document.createElement("span");
      el.append(fill);
      bar = { el, fill };
      this.bars.set(id, bar);
    }
    bar.el.style.display = visible ? "block" : "none";
    if (!visible) return;
    bar.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    bar.fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  prune(alive: Set<number>): void {
    for (const [id, bar] of this.bars) {
      if (alive.has(id)) continue;
      bar.el.remove();
      this.bars.delete(id);
    }
  }

  update(dt: number): void {
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.banner.style.opacity = String(Math.min(1, this.bannerT * 3));
    this.banner.style.transform = `scale(${1 + Math.max(0, this.bannerT - 1.2) * 2})`;
    this.goldPulse = Math.max(0, this.goldPulse - dt * 4);
    this.gold.style.transform = `scale(${1 + this.goldPulse * 0.25})`;
    this.chestPulse = Math.max(0, this.chestPulse - dt * 3);
    this.chest.style.transform = `scale(${1 + this.chestPulse * 0.3})`;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.flashEl.style.opacity = String(this.flash * 0.5);
  }
}
