import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { itemName, openChest } from "../game/loot";
import { audio } from "./battle/audio";
import { BattleView } from "./battle/view";
import { engine } from "./engine";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

export const STRIP_HEIGHT = 168;
const POP_SIZE = { width: 760, height: 112 };

export function openNextChest(): void {
  engine.act((s) => openChest(s, []), (items) => `Opened ${items.map(itemName).join(", ")}`);
}

const view = new BattleView(openNextChest);
const ready = view.init();
let generation = 0;

function runLoop(win: Window, host: HTMLElement): void {
  const current = ++generation;
  const frame = () => {
    if (current !== generation) return;
    engine.tick(Date.now());
    view.resize(host.clientWidth, host.clientHeight);
    view.frame(engine.state, engine.drainEvents());
    win.requestAnimationFrame(frame);
  };
  win.requestAnimationFrame(frame);
}

export function Strip() {
  const slot = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [popped, setPopped] = useState(false);
  const prefs = useSyncExternalStore(audio.subscribe, audio.getPrefs);
  const canPop = !!window.documentPictureInPicture;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    void ready.then(() => {
      el.append(view.canvas);
      runLoop(window, el);
    });
  }, []);

  async function popOut() {
    const api = window.documentPictureInPicture;
    const el = host.current;
    if (!api || !el || popped) return;
    const pip = await api.requestWindow(POP_SIZE);
    pip.document.title = "Tray Heroes";
    pip.document.body.style.cssText = "margin:0;height:100vh;background:#120a1c;overflow:hidden";
    pip.document.body.append(el);
    pip.addEventListener("pagehide", () => {
      slot.current?.append(el);
      runLoop(window, el);
      setPopped(false);
    });
    runLoop(pip, el);
    setPopped(true);
  }

  return (
    <section className="strip-wrap">
      <div className="strip-frame">
        <div ref={slot} className="strip-slot" style={{ height: STRIP_HEIGHT }}>
          <div ref={host} className="strip-host" style={{ width: "100%", height: "100%" }} />
          {popped && <div className="strip-popped">The battle is in its own always-on-top window. Close it to bring it back.</div>}
        </div>
      </div>
      <div className="strip-actions">
        <button type="button" onClick={() => audio.toggle("sfx")} aria-pressed={prefs.sfx} title="Sound effects">
          {prefs.sfx ? "Sound on" : "Sound off"}
        </button>
        <button type="button" onClick={() => audio.toggle("music")} aria-pressed={prefs.music} title="Music">
          {prefs.music ? "Music on" : "Music off"}
        </button>
        <button type="button" onClick={popOut} disabled={!canPop || popped} title={canPop ? "Float the battle above other windows" : "Needs Chrome or Edge 116+"}>
          {popped ? "Popped out" : "Pop out"}
        </button>
      </div>
    </section>
  );
}
