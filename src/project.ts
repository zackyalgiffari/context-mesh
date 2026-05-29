import path from "node:path";
import { pathExists, meshDir } from "./paths.js";

export async function findProjectRoot(start: string): Promise<string | null> {
  let current = path.resolve(start);

  while (true) {
    if (await pathExists(meshDir(current))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}
