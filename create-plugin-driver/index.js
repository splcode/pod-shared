#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import prompts from "prompts";
import { generateDriver } from "./templates/driver.js";
import { createVanillaUI } from "./templates/vanilla.js";
import { createMantineUI } from "./templates/mantine.js";

const projectPath = process.cwd();
const folderName = path.basename(projectPath);

const defaultClassName = folderName
  .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
  .replace(/^(.)/, (_, c) => c.toUpperCase());

const response = await prompts([
  {
    type: "text",
    name: "className",
    message: "Driver class name",
    initial: defaultClassName,
  },
  {
    type: "select",
    name: "uiType",
    message: "Plugin UI type",
    choices: [
      { title: "None — schema-driven UI only (getUiLayout)", value: "none" },
      { title: "Vanilla — custom element with hand-written HTML/CSS", value: "vanilla" },
      { title: "Mantine — React + Mantine in a custom element", value: "mantine" },
    ],
    initial: 0,
  },
  {
    type: (prev) => (prev !== "none" ? "text" : null),
    name: "tagName",
    message: "Custom element tag name (must contain a hyphen)",
    initial: folderName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-ui",
    validate: (v) => v.includes("-") || "Custom element names must contain a hyphen",
  },
  {
    type: "text",
    name: "uiTab",
    message: "UI tab name (e.g. lighting, audio, video)",
    initial: "lighting",
  },
]);

if (!response.className) {
  console.log("Cancelled.");
  process.exit(1);
}

const { className, uiType, tagName, uiTab } = response;
const jsFileName = tagName || folderName.toLowerCase();
const pluginId = folderName;
const opts = { className, uiType, pluginId, tagName, jsFileName, uiTab };

console.log("");

// --- package.json ---
writePackageJson(opts);

// --- .gitignore ---
writeGitignore(uiType);

// --- dist/ (esbuild output, non-mantine only) ---
if (uiType !== "mantine") {
  fs.mkdirSync(path.join(projectPath, "dist"), { recursive: true });
}

// --- index.js (driver) ---
if (!fs.existsSync(path.join(projectPath, "index.js"))) {
  fs.writeFileSync(path.join(projectPath, "index.js"), generateDriver(opts));
  console.log("✓ index.js");
}

// --- UI scaffolding ---
if (uiType === "vanilla") {
  createVanillaUI(projectPath, opts);
} else if (uiType === "mantine") {
  createMantineUI(projectPath, opts);
}

// --- Install & build ---
console.log("\nInstalling driver dependencies...");
execSync("npm install", { cwd: projectPath, stdio: "inherit" });

if (uiType === "mantine") {
  console.log("\nInstalling UI dependencies...");
  execSync("npm install", { cwd: path.join(projectPath, "ui"), stdio: "inherit" });

  console.log("\nBuilding UI...");
  execSync("npm run build", { cwd: projectPath, stdio: "inherit" });
}

console.log("\n✅ Plugin created!");
if (uiType === "mantine") {
  console.log(`\nTo rebuild: npm run build`);
  console.log(`To watch for changes: npm run watch`);
} else if (uiType === "vanilla") {
  console.log(`\nThe vanilla UI (ui/ui.js) requires no build step.`);
}

// =============================================================================

function writePackageJson({ uiType }) {
  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    : { name: folderName, version: "1.0.0", type: "module" };

  if (!packageJson.scripts) packageJson.scripts = {};
  if (!packageJson.dependencies) packageJson.dependencies = {};
  if (!packageJson.devDependencies) packageJson.devDependencies = {};

  if (uiType === "mantine") {
    packageJson.scripts.build = "cd ui && npx --no-install vite build";
    packageJson.scripts.watch = "cd ui && npx --no-install vite build --watch";
  } else {
    packageJson.scripts.build = [
      "npx esbuild index.js",
      "--bundle",
      "--format=esm",
      "--platform=node",
      "--outfile=dist/output.js",
      "--banner:js=\"import { createRequire } from 'module';",
      'const require = createRequire(import.meta.url);"',
    ].join(" ");
    packageJson.devDependencies.esbuild = "^0.25.11";
  }

  packageJson.dependencies["@splcode/pod-abstract-driver"] = "^1.4.0";

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log("✓ package.json");
}

function writeGitignore(uiType) {
  const gitignorePath = path.join(projectPath, ".gitignore");
  if (fs.existsSync(gitignorePath)) return;

  const ignores = ["node_modules/", ".DS_Store"];
  if (uiType === "mantine") {
    ignores.push("ui/node_modules/", "ui/dist/");
  } else {
    ignores.push("dist/");
  }

  fs.writeFileSync(gitignorePath, ignores.join("\n") + "\n");
  console.log("✓ .gitignore");
}
