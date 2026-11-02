import { useEffect, useState } from "react";
import type { UnitModel } from "./battle/models";
import { portrait } from "./battle/portraits";

export function Portrait({ model, size, dim = false }: { model: UnitModel; size: number; dim?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void portrait(model).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [model]);
  return <span className={`portrait ${dim ? "silhouette" : ""}`} style={{ width: size, height: size, backgroundImage: url ? `url(${url})` : undefined }} aria-hidden />;
}
