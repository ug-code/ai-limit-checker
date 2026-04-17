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
    
    const checkVersion = process.platform === 'win32' ? 'cmd /c "codex --version"' : 'codex --version';
    
    exec(checkVersion, (versionError, versionOutput) => {
      if (versionError) {
        result.error = 'Not installed (npm install -g @openai/codex)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'gpt-5.4-mini';
      
      const codexHome = path.join(homeDir, '.codex');
      const configPath = path.join(codexHome, 'config.toml');
      
      if (fs.existsSync(configPath)) {
        try {
          const config = fs.readFileSync(configPath, 'utf8');
          const modelMatch = config.match(/model\s*=\s*"([^"]+)"/);
          if (modelMatch) result.model = modelMatch[1];
        } catch (e) {}
      }
      
      const sessionData = readCodexSessions(codexHome);
      
      if (sessionData.totalTokens > 0) {
        result.used = sessionData.totalTokens;
        result.details.usedTokens = formatTokens(sessionData.totalTokens);
        result.details.inputTokens = formatTokens(sessionData.inputTokens);
        result.details.outputTokens = formatTokens(sessionData.outputTokens);
        result.details.cachedTokens = formatTokens(sessionData.cachedTokens);
        result.details.sessions = sessionData.sessionCount;
        result.details.usedPercent = sessionData.usedPercent.toFixed(1) + '%';
        result.details.planType = sessionData.planType;
        if (sessionData.resetsAt) {
          const resetDate = new Date(sessionData.resetsAt * 1000);
          result.details.resetsAt = resetDate.toLocaleString();
        }
        if (sessionData.cost > 0) {
          result.details.totalCost = '$' + sessionData.cost.toFixed(2);
        }
      }
      
      const infoParts = [];
      if (result.details.usedPercent && result.details.usedPercent !== '0.0%') {
        infoParts.push(`${result.details.usedPercent} used`);
      }
      if (result.details.sessions) {
        infoParts.push(`${result.details.sessions} turns`);
      }
      if (result.details.totalCost) {
        infoParts.push(result.details.totalCost);
      }
      if (result.details.planType && result.details.planType !== 'unknown') {
        infoParts.push(result.details.planType);
      }
      result.resetInfo = infoParts.join(' | ') || 'API key limit';
      
      result.rawOutput = generateCodexRawOutput(result, sessionData, codexHome);
      
      resolve(result);
    });
  });
}

function generateCodexRawOutput(result, sessionData, codexHome) {
  let output = `=== Codex CLI Status ===\n`;
  output += `Version: ${result.model}\n`;
  output += `Model: ${result.model}\n\n`;
  
  output += `=== Usage Statistics ===\n`;
  output += `Total Tokens: ${result.details.usedTokens || 'N/A'}\n`;
  output += `Input Tokens: ${result.details.inputTokens || 'N/A'}\n`;
  output += `Cached Tokens: ${result.details.cachedTokens || 'N/A'}\n`;
  output += `Output Tokens: ${result.details.outputTokens || 'N/A'}\n`;
  output += `Cost Estimate: ${result.details.totalCost || 'N/A'}\n\n`;
  
  output += `=== Rate Limits ===\n`;
  output += `Used: ${result.details.usedPercent || 'N/A'}\n`;
  output += `Plan: ${result.details.planType || 'unknown'}\n`;
  if (result.details.resetsAt) {
    output += `Resets At: ${result.details.resetsAt}\n`;
  }
  output += `Window: 10080 minutes (weekly)\n\n`;
  
  output += `=== Sessions ===\n`;
  output += `Total Turns: ${result.details.sessions || 0}\n\n`;
  
  output += `=== Config Location ===\n`;
  output += `${codexHome}\\config.toml\n`;
  
  return output;
}

function parseCodexStats(result, output) {
  const lines = output.split('\n');
  
  const sessionsMatch = output.match(/Sessions?\s*[:\s]*(\d+)/i);
  const tokensMatch = output.match(/Tokens?\s*[:\s]*([\d,.]+[KMB]?)/i);
  const costMatch = output.match(/Cost\s*[:\s]*\$?([\d.]+)/i);
  const requestsMatch = output.match(/Requests?\s*[:\s]*(\d+)/i);
  const inputMatch = output.match(/Input Tokens?\s*[:\s]*([\d,.]+[KMB]?)/i);
  const outputMatch = output.match(/Output Tokens?\s*[:\s]*([\d,.]+[KMB]?)/i);
  
  if (sessionsMatch) {
    result.details.sessions = parseInt(sessionsMatch[1]);
    result.modelsCount = parseInt(sessionsMatch[1]);
  }
  if (tokensMatch) {
    result.used = parseTokenValue(tokensMatch[1]);
    result.details.usedTokens = formatTokens(result.used);
  }
  if (costMatch) {
    result.details.totalCost = '$' + parseFloat(costMatch[1]).toFixed(2);
  }
  if (requestsMatch) {
    result.details.requests = parseInt(requestsMatch[1]);
  }
  if (inputMatch) {
    result.details.input = inputMatch[1];
  }
  if (outputMatch) {
    result.details.output = outputMatch[1];
  }
}

function readCodexSessions(codexHome) {
  const data = {
    totalTokens: 0,
    sessionCount: 0,
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    usedPercent: 0,
    planType: 'unknown',
    resetsAt: null
  };
  
  if (!fs.existsSync(codexHome)) return data;
  
  try {
    const sessionsPath = path.join(codexHome, 'sessions');
    if (!fs.existsSync(sessionsPath)) return data;
    
    function scanSessions(dir, depth = 0) {
      if (depth > 4) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = entries.filter(e => e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl'));
      
      for (const file of files.slice(0, 20)) {
        try {
          const filePath = path.join(dir, file.name);
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(l => l.trim());
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.type === 'event_msg' && entry.payload?.type === 'token_count') {
                const info = entry.payload.info;
                const rateLimits = entry.payload.rate_limits;
                
                if (info?.total_token_usage) {
                  data.inputTokens += info.total_token_usage.input_tokens || 0;
                  data.cachedTokens += info.total_token_usage.cached_input_tokens || 0;
                  data.outputTokens += info.total_token_usage.output_tokens || 0;
                  data.totalTokens += info.total_token_usage.total_tokens || 0;
                }
                
                if (rateLimits?.primary) {
                  data.usedPercent = Math.max(data.usedPercent, rateLimits.primary.used_percent || 0);
                  data.planType = rateLimits.plan_type || 'unknown';
                  if (rateLimits.primary.resets_at) {
                    if (!data.resetsAt || rateLimits.primary.resets_at > data.resetsAt) {
                      data.resetsAt = rateLimits.primary.resets_at;
                    }
                  }
                }
                
                data.sessionCount++;
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
      
      for (const subDir of entries.filter(e => e.isDirectory())) {
        scanSessions(path.join(dir, subDir.name), depth + 1);
      }
    }
    
    scanSessions(sessionsPath);
    
    data.cost = (data.inputTokens / 1000) * 0.003 + (data.outputTokens / 1000) * 0.015;
  } catch (e) {}
  
  return data;
}

function parseTokenValue(str) {
  if (!str) return 0;
  str = str.trim().replace(/,/g, '');
  const num = parseFloat(str);
  if (str.includes('M')) return Math.round(num * 1000000);
  if (str.includes('K')) return Math.round(num * 1000);
  return Math.round(num);
}

function formatTokens(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
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
