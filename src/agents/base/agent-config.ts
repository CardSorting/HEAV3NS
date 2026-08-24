export interface AgentConfigOptions {
  modelName: string;
  systemPrompt: string;
  maxTurns: number;
  temperature: number;
}

export class AgentConfig {
  readonly modelName: string;
  readonly systemPrompt: string;
  readonly maxTurns: number;
  readonly temperature: number;

  constructor(options: AgentConfigOptions) {
    this.modelName = options.modelName;
    this.systemPrompt = options.systemPrompt;
    this.maxTurns = options.maxTurns;
    this.temperature = options.temperature;
  }

  static createDefault(): AgentConfig {
    return new AgentConfig({
      modelName: "gpt-5.6-terra",
      systemPrompt: "You are LUMI, an advanced agentic assistant.",
      maxTurns: 30,
      temperature: 0.2,
    });
  }
}
