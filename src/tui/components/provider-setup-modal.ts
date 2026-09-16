import type { Component, Focusable } from "../tui.js";
import { Box } from "./box.js";
import { SettingsList, type SettingItem, type SettingsListTheme } from "./settings-list.js";
import { Text } from "./text.js";
import { VStack } from "./v-stack.js";
import type { SetupWizard, } from "../../agents/extensions/setup/setup-wizard.js";

const PROVIDER_SETUP_THEME: SettingsListTheme = {
  label: (text, selected) => (selected ? `\x1b[1;36m${text}\x1b[0m` : text),
  value: (text, selected) => (selected ? `\x1b[1;32m${text}\x1b[0m` : `\x1b[33m${text}\x1b[0m`),
  description: (text) => `\x1b[90m${text}\x1b[0m`,
  cursor: "\x1b[1;35m▶ \x1b[0m",
  hint: (text) => `\x1b[90m${text}\x1b[0m`,
};

export class ProviderSetupModal implements Component, Focusable {
  focused: boolean = false;
  private readonly container: Box;
  private readonly settingsList: SettingsList;
  private readonly setupWizard: SetupWizard;
  private readonly onClose: () => void;

  constructor(
    setupWizard: SetupWizard,
    onSelectProvider: (providerId: string) => void,
    onClose: () => void
  ) {
    this.setupWizard = setupWizard;
    this.onClose = onClose;

    const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`;
    this.container = new Box(2, 1, bgFn);

    const vstack = new VStack();
    const title = new Text(
      `\x1b[1;35m━━━ MODEL PROVIDERS & OAUTH CREDENTIAL SETUP WIZARD ━━━\x1b[0m`,
      0,
      0
    );

    const statuses = setupWizard.auditStatus();
    const items: SettingItem[] = statuses.map((st) => {
      const statusBadge = st.configured ? `[✓ ACTIVE - ${st.source}]` : `[✗ UNCONFIGURED]`;
      return {
        id: st.provider,
        label: st.provider.toUpperCase(),
        description: `Status: ${statusBadge} ${st.maskedValue ? `- ${st.maskedValue}` : ""}. Select to edit credentials.`,
        currentValue: st.configured ? st.maskedValue || "Configured" : "Not Set",
        values: ["Configure", "Test Connection"],
      };
    });

    items.push({
      id: "run_diagnostics",
      label: "RUN ALL DIAGNOSTICS",
      description: "Test authentication headers and API connection diagnostics across all 5 providers.",
      currentValue: "Run Tests",
      values: ["Execute Audit"],
    });

    this.settingsList = new SettingsList(
      items,
      7,
      PROVIDER_SETUP_THEME,
      (id, newValue) => {
        onSelectProvider(id);
      },
      onClose
    );

    vstack.addChild(title);
    vstack.addChild(this.settingsList);
    this.container.addChild(vstack);
  }

  invalidate(): void {
    this.container.invalidate();
    this.settingsList.invalidate();
  }

  handleInput(data: string): void {
    this.settingsList.handleInput(data);
  }

  render(width: number): string[] {
    return this.container.render(width);
  }
}
