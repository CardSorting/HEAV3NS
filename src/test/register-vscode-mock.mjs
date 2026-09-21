import { register } from "node:module"

register(new URL("./vscode-loader.mjs", import.meta.url), import.meta.url)
