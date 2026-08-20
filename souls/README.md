# 🔮 LUMI SOUL Drop Vault (`souls/`)

Welcome to the **SOUL Drop Vault**! You can manage, switch, or customize your agent's persona simply by **dragging and dropping** files into this folder.

## 🚀 How to Use (Zero Configuration)

1. **Drop Any Persona File Here**:
   - **Markdown Frontmatter**: `my-agent.soul.md` or `my-agent.md`
   - **CharacterCard V2**: `my-character.card.json` or `my-character.json`
   - **OpenAI Custom GPT**: `my-assistant.gpt.json`
   - **Anthropic Claude XML**: `my-prompt.claude.xml` or `my-prompt.xml`
   - **Plain English Prompt**: `my-bot.txt` *(Describes what you want in plain text — auto-synthesizes a persona!)*

2. **Automatic Ingestion**:
   - LUMI automatically scans this folder, detects the format, computes the cryptographic SHA-256 integrity hash, and registers the profile into the live runtime.

3. **Starter Templates**:
   - Look in the `templates/` folder for ready-to-use persona templates!
   - Duplicate any template into this folder, rename it (e.g. `patient-tutor.soul.md`), and edit its traits.

4. **Export & Share**:
   - Any persona created in LUMI can be exported here so you can drag it out to share on Discord, Slack, or GitHub.
