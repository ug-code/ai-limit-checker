const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function parseTokenValue(str) {
  if (!str) return 0;
  str = str.toUpperCase().trim();
  const num = parseFloat(str.replace(/[KMB]/gi, ''));
  if (str.includes('K')) return Math.round(num * 1000);
  if (str.includes('M')) return Math.round(num * 1000000);
  if (str.includes('B')) return Math.round(num * 1000000000);
  return Math.round(num);
}

function getOpenCodeConfig(homeDir) {
  const configPaths = [
    path.join(homeDir, '.opencode', 'config.json'),
    path.join(homeDir, '.config', 'opencode', 'config.json'),
    path.join(homeDir, 'AppData', 'Roaming', 'opencode', 'config.json'),
    path.join(homeDir, '.opencodex', 'config.json')
  ];
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

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

function checkOpenCode() {
  return new Promise((resolve) => {
    const result = createBaseResult('opencode', 'OpenCode', 'npm install -g opencode');
    const homeDir = os.homedir();
    
    exec('opencode --version', (versionError) => {
      if (versionError) {
        result.error = 'Not installed (npm install -g opencode)';
        return resolve(result);
      }
      
      result.installed = true;
      
      const config = getOpenCodeConfig(homeDir);
      if (config) {
        if (config.model) result.model = config.model;
        if (config.provider) {
          result.model = config.provider + ' - ' + (config.model || 'default');
        }
      }
      if (!result.model) result.model = 'OpenAI/Claude';
      
      exec('opencode stats', { timeout: 15000 }, (statsError, stdout) => {
        if (statsError || !stdout) {
          result.resetInfo = 'Run "opencode stats" for details';
          return resolve(result);
        }
        
        result.rawOutput = stdout;
        
        const output = stdout;
        
        const sessionsMatch = output.match(/Sessions\s+(\d+)/);
        const messagesMatch = output.match(/Messages\s+(\d+)/);
        const daysMatch = output.match(/Days\s+(\d+)/);
        const costMatch = output.match(/Total Cost\s+\$?([\d.]+)/);
        const avgCostMatch = output.match(/Avg Cost\/Day\s+\$?([\d.]+)/);
        const avgTokensMatch = output.match(/Avg Tokens\/Session\s+([\d.]+[KMB]?)/i);
        const medianTokensMatch = output.match(/Median Tokens\/Session\s+([\d.]+[KMB]?)/i);
        const inputMatch = output.match(/Input\s+([\d.]+[KMB]?)/i);
        const outputMatch = output.match(/Output\s+([\d.]+[KMB]?)/i);
        const cacheReadMatch = output.match(/Cache Read\s+([\d.]+[KMB]?)/i);
        const cacheWriteMatch = output.match(/Cache Write\s+([\d.]+[KMB]?)/i);
        
        if (sessionsMatch) {
          result.modelsCount = parseInt(sessionsMatch[1]);
          result.details.sessions = sessionsMatch[1];
        }
        if (messagesMatch) result.details.messages = messagesMatch[1];
        if (daysMatch) result.details.days = daysMatch[1];
        if (costMatch) {
          result.cost = parseFloat(costMatch[1]);
          result.details.totalCost = '$' + parseFloat(costMatch[1]).toFixed(2);
        }
        if (avgCostMatch) result.details.avgCostPerDay = '$' + parseFloat(avgCostMatch[1]).toFixed(2);
        if (avgTokensMatch) result.details.avgTokensPerSession = avgTokensMatch[1];
        if (medianTokensMatch) result.details.medianTokensPerSession = medianTokensMatch[1];
        
        let inputTokens = 0;
        let outputTokens = 0;
        
        if (inputMatch) {
          inputTokens = parseTokenValue(inputMatch[1]);
          result.details.input = inputMatch[1];
        }
        if (outputMatch) {
          outputTokens = parseTokenValue(outputMatch[1]);
          result.details.output = outputMatch[1];
        }
        
        result.used = inputTokens + outputTokens;
        
        if (cacheReadMatch) result.details.cacheRead = cacheReadMatch[1];
        if (cacheWriteMatch) result.details.cacheWrite = cacheWriteMatch[1];
        
        const infoParts = [];
        if (costMatch) infoParts.push(`$${parseFloat(costMatch[1]).toFixed(2)}`);
        if (sessionsMatch) infoParts.push(`${sessionsMatch[1]} session`);
        if (messagesMatch) infoParts.push(`${messagesMatch[1]} msg`);
        
        result.resetInfo = infoParts.join(' | ') || 'API key limit';
        
        if (result.used > 0) {
          result.limit = 0;
          result.remaining = 'Provider dashboard';
        }
        
        resolve(result);
      });
    });
  });
}

module.exports = { checkOpenCode };
