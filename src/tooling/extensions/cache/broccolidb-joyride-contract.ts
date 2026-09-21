/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 172: Zero-Dependency Broccoli JoyRide Contract Verifier
 *
 * Lifted from external source workspace/codemarie-new/src/core/joyride/JoyRideContract.ts.
 * Enforces frozen JoyRide public API contracts, preventing internal implementation detail leakage
 * across export surfaces and verifying integration import boundaries. Zero external npm dependencies.
 */

export const JOYRIDE_FORBIDDEN_EXPORTS = [
  "lookupCommandResult",
  "storeCommandResult",
  "lookupGrepResult",
  "storeGrepResult",
  "JoyRideIntegration",
  "JoyRideCache",
  "createCommandResultCacheKey",
  "createGrepResultCacheKey",
] as const;

export interface ContractValidationResult {
  valid: boolean;
  leakedSymbols: string[];
}

export class BroccoliJoyRideContractVerifier {
  /**
   * Validates an exported symbol list against JoyRide encapsulation rules.
   */
  public validateExportSurface(exportedSymbols: string[]): ContractValidationResult {
    const leakedSymbols: string[] = [];

    for (const sym of exportedSymbols) {
      if ((JOYRIDE_FORBIDDEN_EXPORTS as readonly string[]).includes(sym)) {
        leakedSymbols.push(sym);
      }
    }

    return {
      valid: leakedSymbols.length === 0,
      leakedSymbols,
    };
  }
}
