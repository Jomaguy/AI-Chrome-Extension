// Debug mode flag
const BACKGROUND_DEBUG = false;

// Debug logging utility
function debugLog(...args) {
  if (!BACKGROUND_DEBUG) return;
  console.log('[Background]', ...args);
}

// Listen for storage test messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TEST_STORAGE') {
    debugLog('Received storage test request:', request);
    
    switch (request.action) {
      case 'set':
        chrome.storage.local.set(request.data)
          .then(() => {
            debugLog('Test data stored successfully');
            sendResponse({ success: true });
          })
          .catch(error => {
            debugLog('Error storing test data:', error);
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      case 'get':
        chrome.storage.local.get(request.key)
          .then(result => {
            debugLog('Retrieved test data:', result);
            sendResponse({ success: true, data: result });
          })
          .catch(error => {
            debugLog('Error retrieving test data:', error);
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    // Required for async response
    return true;
  }
}); 