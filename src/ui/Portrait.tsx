import { useEffect, useState, type CSSProperties } from "react";
import type { SpriteRef } from "../game/types";
import { loadManifest, type ArtKey, type UnitManifest } from "./battle/manifest";
import { Icon } from "./items";

const rows = (m: UnitManifest) => Math.max(m.idle.row, m.walk.row, m.hurt?.row ?? 0, m.death?.row ?? 0, ...m.attacks.map((a) => a.row)) + 1;

let manifest: Promise<Partial<Record<ArtKey, UnitManifest>>> | null = null;

export function Portrait({ unit, fallback, scale = 3 }: { unit: ArtKey; fallback: SpriteRef; scale?: number }) {
  const [art, setArt] = useState<UnitManifest | null>(null);
  useEffect(() => {
    manifest ??= loadManifest();
    let live = true;
    void manifest.then((m) => live && setArt(m[unit] ?? null));
    return () => {
      live = false;
    };
  }, [unit]);
  if (!art) return <Icon sprite={fallback} scale={scale} />;
  const style = {
    width: art.w * scale,
    height: art.h * scale,
    backgroundImage: `url(${art.src})`,
    backgroundSize: `auto ${art.h * scale * rows(art)}px`,
    backgroundPositionY: 0,
    "--frames": art.idle.frames,
    "--end": `-${art.idle.frames * art.w * scale}px`,
    animationDuration: `${art.idle.frames / 7}s`,
  } as CSSProperties;
  return <span className="portrait" style={style} aria-hidden />;
}
