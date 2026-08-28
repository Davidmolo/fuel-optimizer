import { copyFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

function copyIfNeeded(source, target) {
  if (!existsSync(source)) {
    return;
  }

  const shouldCopy =
    !existsSync(target) || statSync(source).size !== statSync(target).size;

  if (shouldCopy) {
    copyFileSync(source, target);
  }
}

copyIfNeeded(
  path.join(projectRoot, "node_modules", "lightningcss-win32-x64-msvc", "lightningcss.win32-x64-msvc.node"),
  path.join(projectRoot, "node_modules", "lightningcss", "lightningcss.win32-x64-msvc.node"),
);

copyIfNeeded(
  path.join(
    projectRoot,
    "node_modules",
    "@tailwindcss",
    "oxide-win32-x64-msvc",
    "tailwindcss-oxide.win32-x64-msvc.node",
  ),
  path.join(projectRoot, "node_modules", "@tailwindcss", "oxide", "tailwindcss-oxide.win32-x64-msvc.node"),
);
