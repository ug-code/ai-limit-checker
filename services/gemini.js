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
    limit: 1500000,
    remaining: 1500000,
    percentage: 0,
    resetInfo: '1.5M tokens/month',
    modelsCount: 0,
    isLocal,
    details: {},
    rawOutput: null
  };
}

function checkGeminiCLI() {
  return new Promise((resolve) => {
    const result = createBaseResult('gemini', 'Gemini CLI', 'npm install -g @google/gemini-cli');
    const homeDir = os.homedir();
    
    exec('gemini --version', (error) => {
      if (error) {
        result.error = 'Not installed (npm install -g @google/gemini-cli)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'Gemini CLI';
      
      const configPaths = [
        path.join(homeDir, '.gemini', 'config.json'),
        path.join(homeDir, '.config', 'gemini', 'config.json')
      ];
      
      const usagePaths = [
        path.join(homeDir, '.gemini', 'usage.json'),
        path.join(homeDir, '.gemini', 'usage_local.json')
      ];
      
      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.model) {
              result.model = config.model;
              result.details.model = config.model;
            }
            if (config.api_key) {
              result.details.hasApiKey = true;
            }
          } catch (e) {}
          break;
        }
      }
      
      for (const usagePath of usagePaths) {
        if (fs.existsSync(usagePath)) {
          try {
            const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
            result.used = usage.total_tokens || usage.tokens_used || 0;
            result.details.usage = usage;
            result.remaining = result.limit > 0 ? (result.limit - result.used) : 'N/A';
            if (result.limit > 0) {
              result.percentage = Math.round((result.used / result.limit) * 100);
            }
          } catch (e) {}
          break;
        }
      }
      
      if (result.used === 0) {
        result.remaining = result.limit;
        result.percentage = 0;
      }
      
      resolve(result);
    });
  });
}

module.exports = { checkGeminiCLI };
