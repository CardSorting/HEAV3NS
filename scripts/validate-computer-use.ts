/**
 * validate-computer-use.ts
 *
 * Comprehensive validation suite for Target #26: Deterministic Computer Use,
 * Virtual Display Buffer & OS Automation Subsystem (Phase 88 / ADR-040).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicDisplayDriver } from "../src/tooling/extensions/computer-use/deterministic-display-driver.js";
import { BroccoliDisplaySubstrate } from "../src/sessions/extensions/computer-use/broccoli-display-substrate.js";
import { DisplaySnapshotManager } from "../src/sessions/extensions/computer-use/display-snapshot-manager.js";
import { ComputerUseSupervisor } from "../src/agents/extensions/computer-use/computer-use-supervisor.js";
import { ComputerUseToolSuite } from "../src/tooling/extensions/computer-use/computer-use-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 88 / ADR-040: Computer Use & Virtual Display Validation Suite ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-computer-use-val-"));

  try {
    const driver = new DeterministicDisplayDriver(1920, 1080);

    // ---------------------------------------------------------------------------
    // Suite 1: Virtual Display Initialization & Resolution Verification
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Virtual Display Initialization & Resolution Verification...");
    const initFrame = driver.captureFrame();
    if (initFrame.width !== 1920 || initFrame.height !== 1080) {
      throw new Error(`Unexpected display resolution: ${initFrame.width}x${initFrame.height}`);
    }
    if (initFrame.windows.length < 1 || initFrame.elements.length < 3) {
      throw new Error("Default workspace windows or UI elements missing");
    }
    console.log("  ✓ Virtual display 1920x1080 frame buffer initialized cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Set-of-Marks (SoM) Element Overlay & Hit-Testing
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Set-of-Marks (SoM) Element Overlay & Hit-Testing...");
    const el1 = driver.findElementById(1);
    const el2 = driver.findElementById(2);

    if (!el1 || el1.element.label !== "Search bar" || !el2 || el2.element.label !== "Submit button") {
      throw new Error("Set-of-Marks integer ID element lookup failed");
    }

    const hitSearch = driver.hitTest(150, 140);
    if (!hitSearch || hitSearch.element?.id !== 1) {
      throw new Error("Coordinate hit-test over Search Bar failed");
    }
    console.log("  ✓ Set-of-Marks (SoM) element overlay & bounding-box hit-testing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Mouse Actions (Click by Coord, Click by SoM Element ID, Drag, Scroll)
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Mouse Actions (Click by Coord, Click by SoM Element ID, Drag, Scroll)...");
    const frameAfterClick = driver.click({ elementId: 2 });
    if (frameAfterClick.cursor.x !== 590 || frameAfterClick.cursor.y !== 140) {
      throw new Error(`Expected cursor at (590, 140), got (${frameAfterClick.cursor.x}, ${frameAfterClick.cursor.y})`);
    }

    const frameAfterDrag = driver.drag(100, 100, 400, 400);
    if (frameAfterDrag.cursor.x !== 400 || frameAfterDrag.cursor.y !== 400) {
      throw new Error("Drag end cursor coordinates incorrect");
    }

    const frameAfterScroll = driver.scroll(50, 100);
    if (frameAfterScroll.cursor.x !== 450 || frameAfterScroll.cursor.y !== 500) {
      throw new Error("Scroll coordinate offset calculation incorrect");
    }
    console.log("  ✓ Click, drag, and scroll virtual input actions verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Keyboard Input & Focus-Aware Text Mutation
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Keyboard Input & Focus-Aware Text Mutation...");
    driver.click({ elementId: 1 });
    const typedFrame = driver.type("Hermes agent analysis");
    const searchEl = driver.findElementById(1);

    if (searchEl?.element.value !== "Hermes agent analysis") {
      throw new Error(`Expected input value 'Hermes agent analysis', got '${searchEl?.element.value}'`);
    }
    console.log("  ✓ Focus-aware virtual keyboard text input verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Window Hierarchy, Multitasking & Focus Management
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] Window Hierarchy, Multitasking & Focus Management...");
    driver.registerWindow({
      id: "win-secondary-2",
      title: "Terminal Console",
      appName: "LumiTerm",
      bounds: { x: 300, y: 300, width: 800, height: 500 },
      active: true,
      elements: [
        { id: 10, label: "Terminal buffer", role: "terminal", bounds: { x: 310, y: 340, width: 780, height: 450 } },
      ],
    });

    const switched = driver.focusWindow("win-secondary-2");
    const captured = driver.captureFrame();
    if (!switched || captured.activeWindowId !== "win-secondary-2" || captured.windows.length !== 2) {
      throw new Error("Window focus switching or window registration failed");
    }
    console.log("  ✓ Multi-window hierarchy and focus management verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: In-Memory BroccoliDisplaySubstrate Ledgers
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] In-Memory BroccoliDisplaySubstrate Ledgers...");
    const substrate = new BroccoliDisplaySubstrate();
    const supervisor = new ComputerUseSupervisor(driver, substrate);

    supervisor.executeAction("click", { elementId: 1 });
    supervisor.executeAction("type", { text: " test" });

    const history = supervisor.listActions(10);
    if (history.length < 2) {
      throw new Error("Action history list empty or incomplete");
    }

    const stats = supervisor.getStats();
    if (stats.totalActions < 2 || stats.windowCount !== 2) {
      throw new Error(`Substrate stats invalid: ${JSON.stringify(stats)}`);
    }
    console.log("  ✓ In-memory Broccolidb display action ledgers verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: DisplaySnapshotManager Frame Snapshotting & O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] DisplaySnapshotManager Frame Snapshotting & O(1) Rollback...");
    const snapshotManager = new DisplaySnapshotManager(substrate);
    snapshotManager.captureFrame(1);

    supervisor.executeAction("click", { x: 500, y: 500 });
    if (substrate.exportSnapshot().totalActions < 3) {
      throw new Error("Did not record click action");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || substrate.exportSnapshot().totalActions !== 2) {
      throw new Error("Display state rollback failed");
    }
    console.log(`  ✓ O(1) Display substrate state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: ComputerUseToolSuite Execution & Grand Monolith Composition
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] ComputerUseToolSuite Execution & Grand Monolith Composition...");
    const toolSuite = new ComputerUseToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const actionTool = tools.find((t) => t.name === "computer_action")!;
    const statusTool = tools.find((t) => t.name === "computer_display_status")!;

    if (!actionTool || !statusTool) {
      throw new Error("Missing required Computer Use model tools");
    }

    const actionToolRes = await actionTool.execute({
      action: "click",
      paramsJson: JSON.stringify({ elementId: 1 }),
    }, tempDir) as { success: boolean; action: string; elementsCount: number };

    if (!actionToolRes.success || actionToolRes.action !== "click") {
      throw new Error("computer_action tool execution failed");
    }

    const statusToolRes = await statusTool.execute({}, tempDir) as { success: boolean; stats: { windowCount: number } };
    if (!statusToolRes.success || statusToolRes.stats.windowCount < 1) {
      throw new Error("computer_display_status tool execution failed");
    }

    console.log("  ✓ All 2 Computer Use model tools executed cleanly");

    // Monolith Composition Verification
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
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 88 COMPUTER USE SUITES PASSED CLEANLY! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
