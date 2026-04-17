const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    apiKeys: {},
    windowBounds: { width: 1200, height: 800 }
  }
});

let mainWindow;

function createWindow() {
  const { width, height } = store.get('windowBounds');
  
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-api-keys', () => {
  return store.get('apiKeys');
});

ipcMain.handle('save-api-keys', (event, keys) => {
  const currentKeys = store.get('apiKeys');
  Object.keys(keys).forEach(k => {
    if (keys[k] && keys[k] !== '' && keys[k] !== '***') {
      currentKeys[k] = keys[k];
    }
  });
  store.set('apiKeys', currentKeys);
  return true;
});

ipcMain.handle('check-openai', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch('https://api.openai.com/v1/usage', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.status === 401) return { available: false, error: 'Invalid API key' };
    if (!response.ok) return { available: false, error: `Status: ${response.status}` };
    
    const data = await response.json();
    return {
      available: true,
      used: Math.round(data.total_used_units || 0),
      limit: Math.round(data.total_granted_units || 0),
      remaining: Math.round(data.total_available_units || 0),
      model: 'GPT-4/ChatGPT'
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-anthropic', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/organizations/current/usage', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    if (response.status === 401) return { available: false, error: 'Invalid API key' };
    
    return {
      available: true,
      used: 0,
      limit: 0,
      remaining: 0,
      model: 'Claude 3',
      resetTime: 'Monthly reset'
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-gemini', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta3/models?key=${apiKey}`);
    
    if (response.status === 400 || response.status === 403) {
      return { available: false, error: 'Invalid API key' };
    }
    
    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        used: 0,
        limit: 1500000,
        remaining: 1500000,
        model: 'Gemini Pro',
        resetTime: 'Free tier: 1.5M tokens/month',
        modelCount: data.models ? data.models.length : 0
      };
    }
    
    return { available: false, error: `Status: ${response.status}` };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-qwen', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 10
      })
    });
    
    if (response.status === 401) return { available: false, error: 'Invalid API key' };
    
    return {
      available: true,
      used: 0,
      limit: 1000000,
      remaining: 1000000,
      model: 'Qwen Turbo',
      resetTime: 'Free tier available'
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-groq', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch('https://api.groq.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.status === 401) return { available: false, error: 'Invalid API key' };
    
    return {
      available: true,
      used: 0,
      limit: 14400,
      remaining: 14400,
      model: 'Llama 3/Gemma',
      resetTime: 'Free tier: 14.4K tokens/min'
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-cohere', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch('https://api.cohere.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.status === 401) return { available: false, error: 'Invalid API key' };
    
    return {
      available: true,
      used: 0,
      limit: 50000,
      remaining: 50000,
      model: 'Command R+',
      resetTime: 'Free tier: 50K tokens/month'
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-openrouter', async (event, apiKey) => {
  if (!apiKey) return { available: false, error: 'API key not provided' };
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.status === 401) return { available: false, error: 'Invalid API key' };
    
    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        used: data.usage?.total_usage || 0,
        limit: data.usage?.limit || 0,
        remaining: (data.usage?.limit || 0) - (data.usage?.total_usage || 0),
        model: 'Multiple Models'
      };
    }
    
    return { available: false, error: `Status: ${response.status}` };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('check-cli-tools', async () => {
  const { checkAllCLITools } = require('../services');
  const apiKeys = store.get('apiKeys') || {};
  return await checkAllCLITools(apiKeys);
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});
