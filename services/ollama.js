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
    resetInfo: 'Unlimited (Local)',
    modelsCount: 0,
    isLocal,
    details: {},
    rawOutput: null
  };
}

function checkOllama() {
  return new Promise((resolve) => {
    const result = createBaseResult('ollama', 'Ollama', 'curl -fsSL https://ollama.com/install.sh | sh', true);
    
    exec('ollama list', (error, stdout) => {
      if (error || !stdout) {
        result.error = 'Not running (ollama serve)';
        return resolve(result);
      }
      
      result.installed = true;
      result.model = 'Local Models';
      
      const lines = stdout.split('\n').filter(l => 
        l.trim() && 
        !l.includes('NAME') && 
        !l.includes('---')
      );
      
      result.modelsCount = lines.length;
      result.details.installedModels = lines.length;
      
      if (lines.length > 0) {
        result.details.models = lines.map(l => {
          const parts = l.trim().split(/\s+/);
          return parts[0] || '';
        }).filter(Boolean);
      }
      
      resolve(result);
    });
  });
}

module.exports = { checkOllama };
