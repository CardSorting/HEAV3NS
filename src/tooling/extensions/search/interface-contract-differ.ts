/**
 * interface-contract-differ.ts
 *
 * Automated Interface & Schema Contract Diff Generator.
 * Compares TypeScript interfaces and types between source files to detect field additions,
 * removals, and breaking contract mutations.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface FieldDiff {
  readonly name: string;
  readonly type: string;
}

export interface InterfaceDiff {
  readonly interfaceName: string;
  readonly addedFields: string[];
  readonly removedFields: string[];
}

export interface ContractDiffReport {
  readonly success: boolean;
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly hasDrift: boolean;
  readonly addedInterfaces: string[];
  readonly removedInterfaces: string[];
  readonly modifiedInterfaces: InterfaceDiff[];
}

export class InterfaceContractDiffer {
  /**
   * Compares interface declarations between two files.
   */
  public async diffContracts(
    sourcePath: string,
    targetPath: string,
    rootDir: string
  ): Promise<ContractDiffReport> {
    const fullSource = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(rootDir, sourcePath);
    const fullTarget = path.isAbsolute(targetPath) ? targetPath : path.resolve(rootDir, targetPath);

    const sourceContent = await fs.readFile(fullSource, "utf-8");
    const targetContent = await fs.readFile(fullTarget, "utf-8");

    const sourceInterfaces = this.extractInterfaces(sourceContent);
    const targetInterfaces = this.extractInterfaces(targetContent);

    const sourceNames = new Set(Object.keys(sourceInterfaces));
    const targetNames = new Set(Object.keys(targetInterfaces));

    const addedInterfaces: string[] = [];
    const removedInterfaces: string[] = [];
    const modifiedInterfaces: InterfaceDiff[] = [];

    for (const name of targetNames) {
      if (!sourceNames.has(name)) {
        addedInterfaces.push(name);
      }
    }

    for (const name of sourceNames) {
      if (!targetNames.has(name)) {
        removedInterfaces.push(name);
      } else {
        const sFields = sourceInterfaces[name];
        const tFields = targetInterfaces[name];

        const addedFields = tFields.filter((f) => !sFields.includes(f));
        const removedFields = sFields.filter((f) => !tFields.includes(f));

        if (addedFields.length > 0 || removedFields.length > 0) {
          modifiedInterfaces.push({
            interfaceName: name,
            addedFields,
            removedFields,
          });
        }
      }
    }

    const hasDrift = addedInterfaces.length > 0 || removedInterfaces.length > 0 || modifiedInterfaces.length > 0;

    return {
      success: true,
      sourcePath: path.relative(rootDir, fullSource).replace(/\\/g, "/"),
      targetPath: path.relative(rootDir, fullTarget).replace(/\\/g, "/"),
      hasDrift,
      addedInterfaces,
      removedInterfaces,
      modifiedInterfaces,
    };
  }

  private extractInterfaces(code: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;

    while ((match = ifaceRegex.exec(code)) !== null) {
      const name = match[1];
      const body = match[2];
      const fieldLines = body
        .split("\n")
        .map((l) => l.trim().replace(/[;,]$/, ""))
        .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*"));

      const fields: string[] = [];
      for (const line of fieldLines) {
        const fieldMatch = /^([a-zA-Z0-9_$?]+):/.exec(line);
        if (fieldMatch) {
          fields.push(fieldMatch[1].replace(/\?$/, ""));
        }
      }
      result[name] = fields;
    }

    return result;
  }
}
