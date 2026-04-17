const { checkOpenCode } = require('./opencode');
const { checkOllama } = require('./ollama');
const { checkGeminiCLI } = require('./gemini');
const { checkAider } = require('./aider');
const { checkGoose, checkLlm, checkCursor, checkCodex, checkGenericTool } = require('./clitools');
const { checkOpencodex } = require('./opencodex');

const TOOLS = [
  { name: 'gemini', displayName: 'Gemini CLI', installCmd: 'npm install -g @google/gemini-cli' },
  { name: 'opencode', displayName: 'OpenCode', installCmd: 'npm install -g opencode' },
  { name: 'opencodex', displayName: 'Opencodex', installCmd: 'npm install -g opencodex' },
  { name: 'aider', displayName: 'Aider', installCmd: 'pip install aider-chat' },
  { name: 'goose', displayName: 'Goose', installCmd: 'brew install goose' },
  { name: 'codex', displayName: 'Codex CLI', installCmd: 'npm install -g @openai/codex' },
  { name: 'cursor', displayName: 'Cursor', installCmd: 'Download from cursor.com' },
  { name: 'llm', displayName: 'LLM', installCmd: 'pip install llm' },
  { name: 'ollama', displayName: 'Ollama', installCmd: 'curl -fsSL https://ollama.com/install.sh' }
];

const SERVICE_MAP = {
  opencode: checkOpenCode,
  ollama: checkOllama,
  gemini: checkGeminiCLI,
  aider: checkAider,
  goose: checkGoose,
  llm: checkLlm,
  cursor: checkCursor,
  codex: checkCodex,
  opencodex: checkOpencodex
};

async function checkAllCLITools(apiKeys = {}) {
  const results = [];
  
  for (const tool of TOOLS) {
    const checker = SERVICE_MAP[tool.name];
    
    if (checker) {
      try {
        const result = await checker(apiKeys);
        result.installCmd = tool.installCmd;
        results.push(result);
      } catch (err) {
        results.push({
          name: tool.name,
          displayName: tool.displayName,
          installed: false,
          error: err.message,
          installCmd: tool.installCmd,
          model: '',
          used: 0,
          limit: 0,
          remaining: 0,
          percentage: 0,
          resetInfo: '',
          modelsCount: 0,
          isLocal: false,
          details: {},
          rawOutput: null
        });
      }
    } else {
      const result = await checkGenericTool(tool.name, tool.displayName, tool.installCmd);
      result.installCmd = tool.installCmd;
      results.push(result);
    }
  }
  
  return results;
}

module.exports = { checkAllCLITools };
