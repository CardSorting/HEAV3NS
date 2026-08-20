# ⚡ LUMI Skill Drop Vault (`skills/`)

Welcome to the **Skill Drop Vault**! You can install, customize, or create new skills simply by **dragging and dropping** folders or files into this directory.

## 🚀 Supported Skill Formats (Zero Configuration)

1. **Skill Folder or Markdown**:
   - `skills/my-skill/SKILL.md` (Standard LUMI / Antigravity skill structure)
   - `my-skill.skill.md` or `my-skill.md`
2. **OpenAI Tool & Function Schema**:
   - `my-tool.json` or `my-tool.tool.json`
3. **Anthropic Tool Spec**:
   - `my-tool.claude.xml`
4. **Declarative Workflow**:
   - `my-pipeline.skill.yaml`
5. **Standalone Scripts**:
   - `audit-script.ts`, `helper.py`
6. **Plain English Prompt**:
   - `my-workflow.txt` *(Describes what you want in plain text — auto-synthesizes a complete skill!)*

## 📂 Quick Templates

Look in the `templates/` directory for pre-built starter templates:
- `templates/starter-skill/SKILL.md` (Standard Skill Tree node)
- `templates/starter-tool.json` (OpenAI function calling schema)
- `templates/starter-workflow.yaml` (Declarative multi-step pipeline)
