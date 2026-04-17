const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function createBaseResult(name, displayName, installCmd, isLocal = false) {
  return {
    name,
    displayName,
    installed: false,
    error: null,
    model: '',
    used: 0,
    limit: 0,
    remaining: 0,
    percentage: 0,
    resetInfo: 'API key limit',
    modelsCount: 0,
    isLocal,
    details: {},
    rawOutput: null
  };
}

function checkGoose() {
  return new Promise((resolve) => {
    const result = createBaseResult('goose', 'Goose', 'brew install goose');
    const homeDir = os.homedir();
    
    exec('goose --version', (error) => {
      if (error) {
        result.error = 'Not installed (brew install goose)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'Claude';
      
      const dataPath = path.join(homeDir, '.local', 'share', 'goose');
      if (fs.existsSync(dataPath)) {
        try {
          const files = fs.readdirSync(dataPath);
          result.modelsCount = files.length;
          result.details.dataFiles = files.length;
        } catch (e) {}
      }
      
      resolve(result);
    });
  });
}

function checkLlm() {
  return new Promise((resolve) => {
    const result = createBaseResult('llm', 'LLM', 'pip install llm', true);
    const homeDir = os.homedir();
    
    exec('llm --version', (error) => {
      if (error) {
        result.error = 'Not installed (pip install llm)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'Multiple providers';
      
      const dbPath = path.join(homeDir, '.llm', 'logs', 'requests.db');
      const modelsPath = path.join(homeDir, '.llm', 'models.json');
      
      if (fs.existsSync(dbPath)) {
        result.resetInfo = 'SQLite logs available';
        result.details.hasDatabase = true;
      }
      
      if (fs.existsSync(modelsPath)) {
        try {
          const models = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
          if (Array.isArray(models)) {
            result.modelsCount = models.length;
            result.details.modelsCount = models.length;
          }
        } catch (e) {}
      }
      
      result.remaining = 'Local logs';
      
      resolve(result);
    });
  });
}

function checkCursor() {
  return new Promise((resolve) => {
    const result = createBaseResult('cursor', 'Cursor', 'Download from cursor.com');
    const homeDir = os.homedir();
    const isWin = process.platform === 'win32';
    
    result.installed = true;
    result.model = 'Multiple models';
    
    let configPaths = [];
    
    if (isWin) {
      const appData = process.env.APPDATA || '';
      configPaths = [
        path.join(appData, 'Cursor', 'User', 'globalStorage', 'cursor'),
        path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'cursor')
      ];
    } else {
      configPaths = [
        path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'cursor'),
        path.join(homeDir, '.cursor')
      ];
    }
    
    let foundConfig = false;
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const files = fs.readdirSync(configPath);
          result.modelsCount = files.length;
          result.details.configFiles = files.length;
          foundConfig = true;
          break;
        } catch (e) {}
      }
    }
    
    if (!foundConfig) {
      result.error = 'Config not found';
    }
    
    resolve(result);
  });
}

function checkCodex() {
  return new Promise((resolve) => {
    const result = createBaseResult('codex', 'Codex CLI', 'npm install -g @openai/codex');
    const homeDir = os.homedir();
    
    exec('codex --version', (error) => {
      if (error) {
        result.error = 'Not installed (npm install -g @openai/codex)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'claude-3-5-sonnet';
      
      const configPath = path.join(homeDir, '.codex', 'config.json');
      const usagePath = path.join(homeDir, '.codex', 'usage.json');
      
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.model) result.model = config.model;
          if (config.org_id) result.details.orgId = config.org_id;
        } catch (e) {}
      }
      
      if (fs.existsSync(usagePath)) {
        try {
          const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
          result.used = usage.total_usage || 0;
          result.limit = usage.limit || 0;
          result.remaining = result.limit > 0 ? (result.limit - result.used) : 'N/A';
          result.details.usage = usage;
          if (result.limit > 0) {
            result.percentage = Math.round((result.used / result.limit) * 100);
          }
        } catch (e) {}
      }
      
      resolve(result);
    });
  });
}

function checkGenericTool(name, displayName, installCmd) {
  return new Promise((resolve) => {
    const result = createBaseResult(name, displayName, installCmd);
    const cmd = process.platform === 'win32' ? `${name}.exe --version` : `${name} --version`;
    
    exec(cmd, { timeout: 3000 }, (error) => {
      if (error) {
        result.error = 'Not installed';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'Installed';
      
      resolve(result);
    });
  });
}

module.exports = { checkGoose, checkLlm, checkCursor, checkCodex, checkGenericTool };
