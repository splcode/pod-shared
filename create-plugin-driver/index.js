#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const projectPath = process.cwd();
const packageJsonPath = path.join(projectPath, "package.json");
const packageJson = getPackageJson(packageJsonPath);

writePackageJson(packageJsonPath, packageJson);
createDist(projectPath);
createGitignore(projectPath);
createDriver(projectPath);

console.log("Installing dependencies...");
execSync("npm install", { cwd: projectPath, stdio: "inherit" });
console.log("\n✅ Setup complete!");

function getPackageJson(packageJsonPath) {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    console.log("Found existing package.json...");
    return packageJson;
  } else {
    // Create new package.json
    const packageJson = {
      name: path.basename(projectPath),
      version: "1.0.0",
      type: "module",
    };

    console.log("Creating new package.json...");
    return packageJson;
  }
}

function writePackageJson(packageJsonPath, packageJson) {
  // Add scripts
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  packageJson.scripts.build = [
    "npx esbuild index.js",
    "--bundle",
    "--format=esm",
    "--platform=node",
    "--outfile=dist/output.js",
    "--banner:js=\"import { createRequire } from 'module';",
    'const require = createRequire(import.meta.url);\"',
  ].join(" ");

  // Add esbuild and pod-abstract-driver as dependencies
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  packageJson.dependencies["@splcode/pod-abstract-driver"] = "^1.2.0";
  packageJson.devDependencies.esbuild = "^0.25.11";

  // Write package.json
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
}

function createDist(projectPath) {
  const distPath = path.join(projectPath, "dist");

  // Create dist directory if it doesn't exist
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
    console.log("Created dist/");
  }
}

function createGitignore(projectPath) {
  const gitignorePath = path.join(projectPath, ".gitignore");

  // Create .gitignore if it doesn't exist
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "node_modules/\ndist/\n");
    console.log("Created .gitignore");
  }
}

function createDriver(projectPath) {
  const driverPath = path.join(projectPath, "index.js");

  // Create a driver file if it doesn't exist
  if (!fs.existsSync(driverPath)) {
    const driver = [
      "import { PodcartAbstractDriver } from '@splcode/pod-abstract-driver';",
      "",
      "export default class CustomPluginDriver extends PodcartAbstractDriver {",
      "  thingy = Math.floor(Math.random() * 100);",
      "",
      "  async _connect() {",
      "    this.log.info('There is a config!', this.config);",
      "    this._registerMeter('thingy', this.thingy);",
      "  }",
      "",
      "  async _disconnect() {}",
      "",
      "  async _get() {",
      "    this.thingy += 1;",
      "    return this.thingy % 100;",
      "  }",
      "",
      "  async _set(meterName, value) {",
      "    this.log.info('SET', meterName, value);",
      "    this.thingy = value;",
      "  }",
      "",
      "  getUiTab() {",
      "    return 'audio';",
      "  }",
      "",
      "  getUiLayout() {",
      "    return {",
      "      type: 'box',",
      "      components: [",
      "        {",
      "          type: 'led',",
      "          meter: 'led',",
      "          styleProps: { size: 20 },",
      "        },",
      "      ],",
      "    };",
      "  }",
      "}",
    ].join("\n");

    fs.writeFileSync(driverPath, driver);
    console.log("Created index.js");
  }
}
