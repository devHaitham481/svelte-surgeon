import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverProject, formatFrameworkName } from "../src/utils/discover-project.js";

const FIXTURES_DIRECTORY = path.resolve(import.meta.dirname, "fixtures");
const VALID_FRAMEWORKS = ["sveltekit", "vite", "unknown"];

describe("discoverProject", () => {
  it("detects Svelte version from package.json", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-svelte"));
    expect(projectInfo.svelteVersion).toBe("^4.0.0");
  });

  it("returns a valid framework", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "sveltekit-app"));
    expect(VALID_FRAMEWORKS).toContain(projectInfo.framework);
    expect(projectInfo.framework).toBe("sveltekit");
  });

  it("detects TypeScript when tsconfig.json exists", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-svelte"));
    expect(projectInfo.hasTypeScript).toBe(false);
  });

  it("throws when package.json is missing", () => {
    expect(() => discoverProject("/nonexistent/path")).toThrow("No package.json found");
  });
});

describe("formatFrameworkName", () => {
  it("formats known frameworks", () => {
    expect(formatFrameworkName("sveltekit")).toBe("SvelteKit");
    expect(formatFrameworkName("vite")).toBe("Vite");
  });

  it("formats unknown framework as Svelte", () => {
    expect(formatFrameworkName("unknown")).toBe("Svelte");
  });
});
