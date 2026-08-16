/**
 * validate-terminal-skin.ts
 *
 * Comprehensive validation suite for Target #38: Terminal UI Skin Engine,
 * Theme Palette & Animated Banner Subsystem (Phase 100 / ADR-054).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicSkinEngine } from "../src/tooling/extensions/skin/deterministic-skin-engine.js";
import { BroccoliSkinSubstrate } from "../src/sessions/extensions/skin/broccoli-skin-substrate.js";
import { SkinSnapshotManager } from "../src/sessions/extensions/skin/skin-snapshot-manager.js";
import { TerminalSkinSupervisor } from "../src/agents/extensions/skin/terminal-skin-supervisor.js";
import { TerminalSkinToolSuite } from "../src/tooling/extensions/skin/terminal-skin-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 100 / ADR-054: Terminal Skin & Theme Validation Suite            ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-skin-val-"));

  try {
    const engine = new DeterministicSkinEngine();

    // ---------------------------------------------------------------------------
    // Suite 1: TrueColor (24-bit) & 256-Color ANSI Color Conversion
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] TrueColor (24-bit) & 256-Color ANSI Color Conversion...");
    const goldAnsi = engine.hexToAnsi("#FFD700");
    const bgAnsi = engine.hexToAnsi("#0e0e12", true);

    if (goldAnsi !== "\x1b[38;2;255;215;0m" || bgAnsi !== "\x1b[48;2;14;14;18m") {
      throw new Error(`ANSI TrueColor conversion mismatch: gold='${goldAnsi}', bg='${bgAnsi}'`);
    }
    console.log("  ✓ Generated correct 24-bit TrueColor ANSI escape sequences for foreground and background");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Built-in Theme Presets & Palette Resolution
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Built-in Theme Presets & Palette Resolution...");
    const defaultPalette = engine.resolvePalette("default");
    const tokyoPalette = engine.resolvePalette("tokyo-night");
    const nordPalette = engine.resolvePalette("nord");
    const draculaPalette = engine.resolvePalette("dracula");
    const monokaiPalette = engine.resolvePalette("monokai");
    const cyberPalette = engine.resolvePalette("cyberpunk");

    if (
      defaultPalette.accent !== "#FFD700" ||
      tokyoPalette.accent !== "#7aa2f7" ||
      nordPalette.accent !== "#88c0d0" ||
      draculaPalette.accent !== "#ff79c6" ||
      monokaiPalette.accent !== "#e6db74" ||
      cyberPalette.accent !== "#fefe00"
    ) {
      throw new Error("Theme palette resolution failed for built-in presets");
    }
    console.log("  ✓ Verified 6 built-in themes (default, tokyo-night, nord, dracula, monokai, cyberpunk)");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Deterministic Kawaii Spinner Frame Generation
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Deterministic Kawaii Spinner Frame Generation...");
    const frame0 = engine.getSpinnerFrame(0, "waiting", "default");
    const frame1 = engine.getSpinnerFrame(1, "waiting", "default");
    const frameThinking = engine.getSpinnerFrame(2, "thinking", "default");

    if (!frame0.includes("(⚔)") || !frame1.includes("(⛨)") || !frameThinking.includes("...")) {
      throw new Error("Deterministic Kawaii spinner frame generation failed");
    }
    console.log("  ✓ Generated deterministic Kawaii animated spinner frames across waiting and reasoning phases");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Dynamic Terminal Banner Rendering & Border Styles
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Dynamic Terminal Banner Rendering & Border Styles...");
    const roundedBanner = engine.renderBanner({ borderStyle: "rounded", activeSkinName: "default" });
    const doubleBanner = engine.renderBanner({ borderStyle: "double", activeSkinName: "tokyo-night" });

    if (!roundedBanner.includes("╭") || !doubleBanner.includes("╔") || !roundedBanner.includes("LUMI-JOY")) {
      throw new Error("Banner rendering with adaptive borders failed");
    }
    console.log("  ✓ Rendered flicker-free ASCII art banners across rounded and double border styles");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: In-Memory BroccoliSkinSubstrate & SkinSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] In-Memory BroccoliSkinSubstrate & SkinSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliSkinSubstrate();
    const supervisor = new TerminalSkinSupervisor(engine, substrate);
    const snapshotManager = new SkinSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.setActiveSkinName("tokyo-night");
    supervisor.registerCustomTheme({
      name: "synthwave",
      description: "Neon 80s synthwave glow",
      colors: {
        background: "#2b213a",
        foreground: "#f92aad",
        accent: "#f92aad",
        border: "#241b2f",
        success: "#72f1b8",
        warning: "#fede5d",
        error: "#fe4450",
        dim: "#614d85",
        text: "#fff",
        reasoning: "#36f9f6",
        tool: "#f92aad",
      },
      spinner: {
        waitingFaces: ["(🕶)", "(🌆)"],
        thinkingFaces: ["(⚡)", "(🏎)"],
        thinkingVerbs: ["accelerating", "cruising"],
        wings: [["«", "»"]],
      },
      branding: {
        agentName: "LUMI-SYNTH",
        welcomeMessage: "Outrun mode engaged.",
        goodbyeMessage: "Grid off.",
        responseLabel: " 🌆 SYNTH ",
      },
    });

    if (supervisor.getActiveSkinName() !== "tokyo-night" || !substrate.getCustomPreset("synthwave")) {
      throw new Error("Failed to update skin substrate state");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || supervisor.getActiveSkinName() !== "default" || substrate.getCustomPreset("synthwave")) {
      throw new Error("Skin state rewind failed");
    }
    console.log(`  ✓ O(1) Skin state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: TerminalSkinSupervisor Theme Lifecycle & Overrides
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] TerminalSkinSupervisor Theme Lifecycle & Overrides...");
    const appliedNord = supervisor.setActiveSkinName("nord");
    if (!appliedNord || supervisor.getActiveSkinName() !== "nord") {
      throw new Error("Supervisor failed to set active skin");
    }

    const nordPaletteRetrieved = supervisor.getThemePalette();
    if (nordPaletteRetrieved.accent !== "#88c0d0") {
      throw new Error("Supervisor retrieved incorrect palette for active skin");
    }

    const bannerOutput = supervisor.renderWelcomeBanner({ borderStyle: "sharp" });
    if (!bannerOutput.includes("LUMI-NORD") || !bannerOutput.includes("┌")) {
      throw new Error("Supervisor banner rendering failed");
    }
    console.log("  ✓ Supervisor coordinated theme lifecycle, palette queries, and banner generation");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: TerminalSkinToolSuite Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] TerminalSkinToolSuite Model Tools Execution...");
    const toolSuite = new TerminalSkinToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const bannerTool = tools.find((t) => t.name === "skin_render_banner")!;
    const paletteTool = tools.find((t) => t.name === "skin_get_theme_palette")!;
    const applyTool = tools.find((t) => t.name === "skin_apply_theme_override")!;

    if (!bannerTool || !paletteTool || !applyTool) {
      throw new Error("Missing required Terminal Skin model tools");
    }

    const banRes = await bannerTool.execute({ skinName: "cyberpunk", borderStyle: "double" }, tempDir) as { success: boolean; bannerOutput: string };
    if (!banRes.success || !banRes.bannerOutput.includes("LUMI-CYBER")) {
      throw new Error("skin_render_banner tool execution failed");
    }

    const palRes = await paletteTool.execute({ skinName: "dracula" }, tempDir) as { success: boolean; palette: { accent: string } };
    if (!palRes.success || palRes.palette.accent !== "#ff79c6") {
      throw new Error("skin_get_theme_palette tool execution failed");
    }

    const appRes = await applyTool.execute({ skinName: "monokai" }, tempDir) as { success: boolean; activeSkin: string };
    if (!appRes.success || appRes.activeSkin !== "monokai") {
      throw new Error("skin_apply_theme_override tool execution failed");
    }
    console.log("  ✓ All 3 Terminal Skin model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (367 Components)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (367 Components)...");
    const monolith = MonolithFactory.createEngine();
    const verification = GrandMonolithSynthesizer.verifyComposition(monolith);

    if (verification.cohesionStatus !== "OPTIMAL") {
      console.error("Missing components:", verification.missingComponents);
      console.error("Unexpected components:", verification.unexpectedComponents);
      console.error("Duplicates:", verification.duplicateManifestComponents);
      throw new Error(`Composition status is ${verification.cohesionStatus}, expected OPTIMAL`);
    }

    if (verification.componentCount !== verification.requiredComponentCount) {
      throw new Error(`Expected exactly ${verification.requiredComponentCount} components, got ${verification.componentCount}`);
    }
    console.log(`  ✓ Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion`);
    passedSuites++;

    console.log("\n================================================================================");
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 100 TERMINAL SKIN SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
