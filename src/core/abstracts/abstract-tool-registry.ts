import type { IToolRegistry, ToolDefinition } from "../contracts/tooling.contracts.js";
import type { Eyes } from "../../tooling/base/eyes.js";
import type { AbstractHands } from "./abstract-hands.js";
import type { AbstractEars } from "./abstract-ears.js";

const TOOL_NAME_ALIASES: Record<string, string> = {
  read_file: "view_file",
  readFile: "view_file",
  read: "view_file",
  cat: "view_file",
  viewFile: "view_file",
  writeFile: "write_file",
  create_file: "write_file",
  createFile: "write_file",
  write: "write_file",
  replaceFileContent: "replace_file_content",
  replace_content: "replace_file_content",
  edit_file: "replace_file_content",
  editFile: "replace_file_content",
  multi_replace: "multi_replace_file_content",
  multiReplaceFileContent: "multi_replace_file_content",
  runCommand: "run_command",
  execute_command: "run_command",
  executeCommand: "run_command",
  bash: "run_command",
  sh: "run_command",
  terminal: "run_command",
  exec: "run_command",
  list_files: "list_dir",
  listFiles: "list_dir",
  list_directory: "list_dir",
  ls: "list_dir",
  dir: "list_dir",
  grep: "grep_search",
  search: "grep_search",
  ripgrep: "grep_search",
  searchSymbols: "search_symbols",
  read_multiple_files: "batch_view_files",
  batch_read_files: "batch_view_files",
  readFiles: "batch_view_files",
  batchViewFiles: "batch_view_files",
  find_file: "find_files",
  findFiles: "find_files",
  glob: "find_files",
  glob_files: "find_files",
  stat: "file_info",
  stat_file: "file_info",
  fileInfo: "file_info",
  tree: "directory_tree",
  directoryTree: "directory_tree",
  remove_file: "delete_file",
  removeFile: "delete_file",
  deleteFile: "delete_file",
  rm: "delete_file",
  unlink: "delete_file",
  rename_file: "move_file",
  renameFile: "move_file",
  moveFile: "move_file",
  mv: "move_file",
  rename: "move_file",
  make_dir: "create_directory",
  makeDir: "create_directory",
  make_directory: "create_directory",
  makeDirectory: "create_directory",
  mkdir: "create_directory",
  createDirectory: "create_directory",
  cp: "copy_file",
  copyFile: "copy_file",
  clone_file: "copy_file",
  copy_directory: "copy_file",
  exists: "path_exists",
  path_exists: "path_exists",
  check_exists: "path_exists",
  append_to_file: "append_file",
  appendToFile: "append_file",
  append: "append_file",
  truncate_file: "clear_file",
  truncateFile: "clear_file",
  clearFile: "clear_file",
  delete_files: "batch_delete_files",
  deleteFiles: "batch_delete_files",
  batch_delete: "batch_delete_files",
  hash_file: "file_hash",
  checksum: "file_hash",
  fileHash: "file_hash",
  getenv: "get_env",
  getEnv: "get_env",
  env: "get_env",
  setenv: "set_env",
  setEnv: "set_env",
  sysinfo: "system_info",
  sys_info: "system_info",
  os_info: "system_info",
  systemInfo: "system_info",
  fetch: "http_request",
  fetch_url: "http_request",
  curl: "http_request",
  httpRequest: "http_request",
  http_fetch: "http_request",
  batch_create_files: "batch_write_files",
  write_multiple_files: "batch_write_files",
  writeFiles: "batch_write_files",
  write_files: "batch_write_files",
  project_summary: "workspace_summary",
  repo_summary: "workspace_summary",
  port_status: "check_port",
  checkPort: "check_port",
  port_check: "check_port",
  free_port: "find_free_port",
  freePort: "find_free_port",
  get_free_port: "find_free_port",
  mem_usage: "memory_usage",
  memoryUsage: "memory_usage",
  process_memory: "memory_usage",
  download: "download_file",
  fetch_to_file: "download_file",
  save_url_to_file: "download_file",
  touch: "touch_file",
  du: "disk_usage",
  dir_size: "disk_usage",
  folder_size: "disk_usage",
  global_replace: "search_and_replace",
  replace_all_files: "search_and_replace",
  chmod: "chmod_file",
  make_executable: "chmod_file",
  temp_dir: "create_temp_dir",
  make_temp_dir: "create_temp_dir",
  killPort: "kill_port",
  free_port_process: "kill_port",
  stop_port: "kill_port",
  killProcess: "kill_process",
  terminate_process: "kill_process",
};

export abstract class AbstractToolRegistry implements IToolRegistry {
  readonly eyes: Eyes;
  readonly hands: AbstractHands;
  readonly ears: AbstractEars;
  protected readonly tools: Map<string, ToolDefinition>;

  constructor(eyes: Eyes, hands: AbstractHands, ears: AbstractEars) {
    this.eyes = eyes;
    this.hands = hands;
    this.ears = ears;
    this.tools = new Map();
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    const canonicalName = TOOL_NAME_ALIASES[name] ?? name;
    return this.tools.get(canonicalName);
  }

  listTools(): readonly ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  normalizeToolArgs(args: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...args };
    if (!normalized.path) {
      if (normalized.filePath) normalized.path = normalized.filePath;
      else if (normalized.file_path) normalized.path = normalized.file_path;
      else if (normalized.file) normalized.path = normalized.file;
      else if (normalized.targetFile) normalized.path = normalized.targetFile;
      else if (normalized.directory) normalized.path = normalized.directory;
      else if (normalized.dir) normalized.path = normalized.dir;
    }
    if (!normalized.paths) {
      if (normalized.filePaths) normalized.paths = normalized.filePaths;
      else if (normalized.files) normalized.paths = normalized.files;
    }
    if (!normalized.source) {
      if (normalized.sourcePath) normalized.source = normalized.sourcePath;
      else if (normalized.from) normalized.source = normalized.from;
      else if (normalized.src) normalized.source = normalized.src;
    }
    if (!normalized.target) {
      if (normalized.targetPath) normalized.target = normalized.targetPath;
      else if (normalized.to) normalized.target = normalized.to;
      else if (normalized.dest) normalized.target = normalized.dest;
      else if (normalized.destination) normalized.target = normalized.destination;
    }
    if (!normalized.command) {
      if (normalized.cmd) normalized.command = normalized.cmd;
      else if (normalized.script) normalized.command = normalized.script;
    }
    if (!normalized.content) {
      if (normalized.text) normalized.content = normalized.text;
      else if (normalized.body) normalized.content = normalized.body;
      else if (normalized.data) normalized.content = normalized.data;
    }
    if (!normalized.query) {
      if (normalized.pattern) normalized.query = normalized.pattern;
      else if (normalized.search_term) normalized.query = normalized.search_term;
      else if (normalized.term) normalized.query = normalized.term;
    }
    if (!normalized.target) {
      if (normalized.find) normalized.target = normalized.find;
      else if (normalized.search_text) normalized.target = normalized.search_text;
    }
    if (!normalized.replacement) {
      if (normalized.replace) normalized.replacement = normalized.replace;
      else if (normalized.new_text) normalized.replacement = normalized.new_text;
      else if (normalized.newContent) normalized.replacement = normalized.newContent;
    }
    return normalized;
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    cwd: string
  ): Promise<unknown> {
    const canonicalName = TOOL_NAME_ALIASES[name] ?? name;
    const tool = this.tools.get(canonicalName);
    if (!tool) {
      throw new Error(`Tool standard target '${name}' not found in registry`);
    }
    const normalizedArgs = this.normalizeToolArgs(args);
    this.ears.emit("tool_start", "AbstractToolRegistry", { name: canonicalName, args: normalizedArgs });
    try {
      const result = await tool.execute(normalizedArgs, cwd);
      this.ears.emit("tool_success", "AbstractToolRegistry", { name: canonicalName, result });
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.ears.emit("tool_error", "AbstractToolRegistry", { name: canonicalName, error: errorMessage });
      throw err;
    }
  }

  protected abstract registerBuiltins(): void;
}
