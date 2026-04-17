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

function checkAider() {
  return new Promise((resolve) => {
    const result = createBaseResult('aider', 'Aider', 'pip install aider-chat');
    const homeDir = os.homedir();
    
    exec('aider --version', (error) => {
      if (error) {
        result.error = 'Not installed (pip install aider-chat)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'OpenAI/Anthropic';
      
      const dbPath = path.join(homeDir, '.aider.send_logs.db');
      const historyPath = path.join(homeDir, '.aider.chat.history.md');
      const statsPath = path.join(homeDir, '.aider.stats.json');
      
      if (fs.existsSync(historyPath)) {
        try {
          const content = fs.readFileSync(historyPath, 'utf8');
          const tokenMatches = content.match(/tokens?:?\s*(\d+)/gi);
          if (tokenMatches) {
            const totalTokens = tokenMatches.reduce((sum, match) => {
              const num = parseInt(match.replace(/\D/g, ''));
              return sum + (isNaN(num) ? 0 : num);
            }, 0);
            result.used = totalTokens;
            result.details.totalTokens = totalTokens;
          }
          result.details.historyLines = content.split('\n').length;
        } catch (e) {}
      }
      
      if (fs.existsSync(statsPath)) {
        try {
          const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
          if (stats.total_tokens) {
            result.used = stats.total_tokens;
            result.details.stats = stats;
          }
        } catch (e) {}
      }
      
      if (fs.existsSync(dbPath)) {
        result.details.hasDatabase = true;
      }
      
      resolve(result);
    });
  });
}

module.exports = { checkAider };
