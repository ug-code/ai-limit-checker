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

function checkOpencodex() {
  return new Promise((resolve) => {
    const result = createBaseResult('opencodex', 'Opencodex', 'npm install -g opencodex');
    const homeDir = os.homedir();
    
    exec('opencodex --version', (error) => {
      if (error) {
        result.error = 'Not installed (npm install -g opencodex)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'OpenAI/Anthropic';
      
      const configPaths = [
        path.join(homeDir, '.opencodex', 'config.json'),
        path.join(homeDir, '.config', 'opencodex', 'config.json'),
        path.join(homeDir, 'AppData', 'Roaming', 'opencodex', 'config.json')
      ];
      
      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.model) result.model = config.model;
            if (config.provider) result.model = config.provider + ' (' + config.model + ')';
          } catch (e) {}
          break;
        }
      }
      
      const dataPath = path.join(homeDir, '.opencodex', 'data');
      
      if (fs.existsSync(dataPath)) {
        try {
          const statsPath = path.join(dataPath, 'stats.json');
          const usagePath = path.join(dataPath, 'usage.json');
          
          for (const p of [statsPath, usagePath]) {
            if (fs.existsSync(p)) {
              const usage = JSON.parse(fs.readFileSync(p, 'utf8'));
              result.used = usage.total_tokens || usage.tokens || usage.total_usage || 0;
              result.limit = usage.limit || 0;
              result.remaining = result.limit > 0 ? (result.limit - result.used) : 'N/A';
              result.details.usage = usage;
              if (result.limit > 0) {
                result.percentage = Math.round((result.used / result.limit) * 100);
              }
              break;
            }
          }
          
          const files = fs.readdirSync(dataPath);
          result.modelsCount = files.filter(f => f.endsWith('.json')).length;
        } catch (e) {}
      }
      
      resolve(result);
    });
  });
}

module.exports = { checkOpencodex };
