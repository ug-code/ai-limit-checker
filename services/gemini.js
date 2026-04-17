const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

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
    resetInfo: 'Checking...',
    modelsCount: 0,
    isLocal,
    details: {},
    rawOutput: null
  };
}

function parseTokenValue(str) {
  if (!str) return 0;
  str = str.trim();
  const cleanStr = str.replace(/,/g, '');
  const num = parseFloat(cleanStr);
  if (str.includes('M')) return Math.round(num * 1000000);
  if (str.includes('K') || str.includes('k')) return Math.round(num * 1000);
  return Math.round(num);
}

function formatTokens(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function readGeminiLocalData() {
  const homeDir = os.homedir();
  const geminiPath = path.join(homeDir, '.gemini');
  const data = {
    totalMessages: 0,
    totalSessions: 0,
    projects: []
  };
  
  if (!fs.existsSync(geminiPath)) return data;
  
  const tmpPath = path.join(geminiPath, 'tmp');
  if (!fs.existsSync(tmpPath)) return data;
  
  try {
    const entries = fs.readdirSync(tmpPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(tmpPath, entry.name);
        const logsPath = path.join(projectPath, 'logs.json');
        
        if (fs.existsSync(logsPath)) {
          try {
            const logs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
            if (Array.isArray(logs)) {
              data.totalMessages += logs.length;
              const sessions = new Set(logs.map(l => l.sessionId));
              data.totalSessions += sessions.size;
              data.projects.push({
                name: entry.name,
                messages: logs.length,
                sessions: sessions.size
              });
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  
  return data;
}

function getOAuthToken() {
  const homeDir = os.homedir();
  const credsPath = path.join(homeDir, '.gemini', 'oauth_creds.json');
  
  if (!fs.existsSync(credsPath)) return null;
  
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    return creds.access_token || null;
  } catch (e) {
    return null;
  }
}

function makeApiCallWithKey(apiKey) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: 'hi' }] }]
    });
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (e) => {
      resolve({ status: 0, body: e.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    
    req.write(postData);
    req.end();
  });
}

function makeApiCallWithOAuth(token) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: 'hi' }] }]
    });
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (e) => {
      resolve({ status: 0, body: e.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    
    req.write(postData);
    req.end();
  });
}

function parseQuotaResponse(status, body) {
  const result = {
    exhausted: false,
    remaining: null,
    resetSeconds: null,
    tier: 'Free',
    error: null
  };
  
  if (status === 200) {
    result.exhausted = false;
    return result;
  }
  
  try {
    const data = JSON.parse(body);
    
    if (data.error) {
      const code = data.error.code;
      const statusStr = data.error.status || '';
      
      if (code === 429 || statusStr === 'RESOURCE_EXHAUSTED') {
        result.exhausted = true;
      }
      
      const msg = data.error.message || '';
      
      if (msg.includes('exhausted') || msg.includes('quota')) {
        result.exhausted = true;
      }
      
      const resetMatch = msg.match(/reset after (\d+)s/i) || body.match(/reset after (\d+)s/i);
      if (resetMatch) {
        result.resetSeconds = parseInt(resetMatch[1]);
      }
      
      if (msg.includes('free_tier') || msg.includes('Free tier')) {
        result.tier = 'Free';
      } else if (msg.includes('Tier 1')) {
        result.tier = 'Tier 1';
      } else if (msg.includes('Tier 2')) {
        result.tier = 'Tier 2';
      } else if (code === 403) {
        result.error = 'Invalid/insufficient scope';
        result.tier = 'OAuth (Limited)';
      }
      
      if (data.error.details) {
        for (const detail of data.error.details) {
          if (detail.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') {
            result.error = 'OAuth scopes insufficient';
            result.tier = 'OAuth (Limited)';
          }
        }
      }
    }
  } catch (e) {
    result.error = 'Parse error';
  }
  
  return result;
}

function checkGeminiCLI(apiKeys = {}) {
  return new Promise((resolve) => {
    const result = createBaseResult('gemini', 'Gemini CLI', 'npm install -g @google/gemini-cli');
    const homeDir = os.homedir();
    const checkVersion = process.platform === 'win32' ? 'cmd /c "gemini --version"' : 'gemini --version';
    
    exec(checkVersion, (versionError, versionOutput) => {
      if (versionError) {
        result.error = 'Not installed (npm install -g @google/gemini-cli)';
        return resolve(result);
      }
      
      result.installed = true;
      const versionMatch = versionOutput.trim().match(/(\d+\.\d+\.\d+)/);
      result.model = 'Gemini 2.0';
      result.details.version = versionMatch ? versionMatch[1] : 'unknown';
      
      const geminiPath = path.join(homeDir, '.gemini');
      const settingsPath = path.join(geminiPath, 'settings.json');
      
      if (fs.existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (settings.general?.preferredEditor) {
            result.details.editor = settings.general.preferredEditor;
          }
          if (settings.security?.auth?.selectedType) {
            result.details.authType = settings.security.auth.selectedType;
          }
        } catch (e) {}
      }
      
      const localData = readGeminiLocalData();
      if (localData.totalMessages > 0) {
        result.details.messages = localData.totalMessages;
        result.details.sessions = localData.totalSessions;
        result.details.projectsCount = localData.projects.length;
      }
      
      const apiKey = apiKeys.gemini;
      const token = getOAuthToken();
      
      const checkQuota = async () => {
        if (apiKey && apiKey.length > 10) {
          const response = await makeApiCallWithKey(apiKey);
          return parseQuotaResponse(response.status, response.body);
        } else if (token) {
          const response = await makeApiCallWithOAuth(token);
          return parseQuotaResponse(response.status, response.body);
        } else {
          return { exhausted: false, tier: 'No API key', error: 'No key found' };
        }
      };
      
      checkQuota().then((quotaInfo) => {
        result.details.quotaExhausted = quotaInfo.exhausted;
        result.details.tier = quotaInfo.tier;
        result.details.resetSeconds = quotaInfo.resetSeconds;
        result.details.apiError = quotaInfo.error;
        result.details.hasApiKey = !!apiKey;
        
        generateGeminiOutput(result, localData, quotaInfo);
        resolve(result);
      }).catch(() => {
        result.details.apiError = true;
        generateGeminiOutput(result, localData, { exhausted: false });
        resolve(result);
      });
    });
  });
}

function generateGeminiOutput(result, localData, quotaInfo) {
  let output = `=== Gemini CLI Status ===\n`;
  output += `Version: ${result.details.version || 'unknown'}\n`;
  output += `Model: ${result.model}\n`;
  output += `Editor: ${result.details.editor || 'unknown'}\n`;
  output += `Auth Type: ${result.details.authType || 'OAuth'}\n`;
  output += `API Key: ${result.details.hasApiKey ? '✓ Configured' : '✗ Not set'}\n`;
  output += `Tier: ${result.details.tier || 'Free'}\n\n`;
  
  output += `=== Local Usage Statistics ===\n`;
  output += `Total Messages: ${localData.totalMessages}\n`;
  output += `Total Sessions: ${localData.totalSessions}\n`;
  output += `Projects Used: ${localData.projects.length}\n\n`;
  
  if (localData.projects.length > 0) {
    output += `=== Usage by Project ===\n`;
    for (const project of localData.projects) {
      output += `${project.name}: ${project.messages} msgs, ${project.sessions} sessions\n`;
    }
    output += `\n`;
  }
  
  output += `=== API Quota Status ===\n`;
  
  if (quotaInfo.exhausted) {
    output += `Status: ⚠️ QUOTA EXHAUSTED\n`;
    output += `Tier: ${quotaInfo.tier || 'Free'}\n`;
    if (quotaInfo.resetSeconds !== null) {
      const minutes = Math.ceil(quotaInfo.resetSeconds / 60);
      output += `Resets in: ${minutes} minute${minutes > 1 ? 's' : ''}\n`;
    } else {
      output += `Resets: Midnight Pacific Time\n`;
    }
    output += `\n→ Check: aistudio.google.com → Quotas\n`;
  } else if (result.details.apiError && !result.details.hasApiKey) {
    output += `Status: ⚠️ No API Key\n`;
    output += `Auth: OAuth only (limited quota access)\n`;
    output += `\nAdd Gemini API Key in Settings for quota details\n`;
  } else if (result.details.apiError) {
    output += `Status: ⚠️ ${result.details.apiError}\n`;
    output += `Tier: ${quotaInfo.tier || 'Unknown'}\n`;
  } else {
    output += `Status: ✅ Working\n`;
    output += `Tier: ${quotaInfo.tier || 'Active'}\n`;
  }
  
  output += `\n=== Quick Commands ===\n`;
  output += `gemini /stats        # Check quota in CLI\n`;
  output += `gemini /stats model  # Model usage\n`;
  output += `gemini /stats tools  # Tool usage\n`;
  
  result.rawOutput = output;
  
  const infoParts = [];
  if (localData.totalMessages > 0) {
    infoParts.push(`${localData.totalMessages} msgs`);
  }
  if (localData.totalSessions > 0) {
    infoParts.push(`${localData.totalSessions} sessions`);
  }
  if (quotaInfo.exhausted) {
    infoParts.push('⚠️ EXHAUSTED');
  } else if (result.details.tier && result.details.tier !== 'No API key') {
    infoParts.push(result.details.tier);
  }
  
  result.resetInfo = infoParts.join(' | ') || 'Active';
}

module.exports = { checkGeminiCLI };
