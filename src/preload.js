const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getApiKeys: () => ipcRenderer.invoke('get-api-keys'),
  saveApiKeys: (keys) => ipcRenderer.invoke('save-api-keys', keys),
  
  checkOpenAI: (apiKey) => ipcRenderer.invoke('check-openai', apiKey),
  checkAnthropic: (apiKey) => ipcRenderer.invoke('check-anthropic', apiKey),
  checkGemini: (apiKey) => ipcRenderer.invoke('check-gemini', apiKey),
  checkQwen: (apiKey) => ipcRenderer.invoke('check-qwen', apiKey),
  checkGroq: (apiKey) => ipcRenderer.invoke('check-groq', apiKey),
  checkCohere: (apiKey) => ipcRenderer.invoke('check-cohere', apiKey),
  checkOpenRouter: (apiKey) => ipcRenderer.invoke('check-openrouter', apiKey),
  
  checkCLITools: () => ipcRenderer.invoke('check-cli-tools'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
