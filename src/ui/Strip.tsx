import { useEffect, useRef, useState } from "react";
import { itemName, openChest } from "../game/loot";
import { engine } from "./engine";
import { BattleView, STRIP_HEIGHT } from "./battleView";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

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
    view.resize(host.clientWidth);
    view.frame(engine.state, engine.drainEvents());
    win.requestAnimationFrame(frame);
  };
  win.requestAnimationFrame(frame);
}

export function Strip() {
  const slot = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [popped, setPopped] = useState(false);
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
    const pip = await api.requestWindow({ width: 720, height: STRIP_HEIGHT });
    pip.document.title = "Tray Heroes";
    pip.document.body.style.cssText = "margin:0;background:#1b1622;overflow:hidden";
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
    <section className="strip-frame">
      <div ref={slot} className="strip-slot" style={{ height: STRIP_HEIGHT }}>
        <div ref={host} className="strip-host" />
        {popped && <div className="strip-popped">The battle is in its own always-on-top window. Close it to bring it back.</div>}
      </div>
      <div className="strip-actions">
        <button type="button" onClick={popOut} disabled={!canPop || popped} title={canPop ? "Float the battle above other windows" : "Needs Chrome or Edge 116+"}>
          {popped ? "Popped out" : "Pop out"}
        </button>
      </div>
    </section>
  );
}
