// Debug mode flag
const DEBUG = true;

// Update our logging utility with a distinct prefix
function debugLog(...args) {
  if (!DEBUG) return;
  
  // Only log certain types of messages
  const [message, ...rest] = args;
  if (message.includes('Skipping') || message.includes('Found new text field in container')) {
    return; // Skip noisy logs
  }
  
  console.log('[AI-Extension]', ...args);
}

// Remove the generic console.log
// console.log('Content script loaded!'); // Remove this line

// Update initial load message
debugLog('Extension initialized');

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Update the debounced handler to use debug logging
const debouncedHandleInput = debounce((e) => {
  const value = e.target.value || e.target.textContent || '';
  const cursor = e.target.selectionStart || 0;
  
  if (value !== undefined) {
    debugLog('Text changed:', {
      value,
      cursor,
      element: e.target.tagName
    });
  }
}, 300);

function isTextField(element) {
  try {
    // Skip elements without proper tag names
    if (!element || !element.tagName) return false;
    
    // Skip hidden inputs
    if (element.type === 'hidden') return false;
    
    if (element.tagName === 'INPUT') {
      const textInputTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
      return textInputTypes.includes(element.type);
    }
    
    if (element.tagName === 'TEXTAREA') {
      return true;
    }
    
    // Only monitor contenteditable divs that are actually editable
    if (element.tagName === 'DIV' && element.getAttribute('contenteditable') === 'true') {
      // Skip if it's a toolbar or has role=button
      const role = element.getAttribute('role');
      return !role || (role !== 'toolbar' && role !== 'button');
    }
    
    return false;
  } catch (error) {
    debugLog('Error in isTextField:', error);
    return false;
  }
}

// Track the current active text field
let activeTextField = null;

// Helper function to attach listeners to a field
function attachFieldListeners(field) {
  if (!field || monitoredFields.has(field)) return;
  if (!isTextField(field)) return;
  
  monitoredFields.add(field);
  
  const onFocus = () => {
    activeTextField = field;
    field.addEventListener('input', handleInput);
    debugLog('Field focused:', field.tagName);
  };
  
  const onBlur = () => {
    if (activeTextField === field) {
      field.removeEventListener('input', handleInput);
      activeTextField = null;
      debugLog('Field blurred:', field.tagName);
    }
  };
  
  field.addEventListener('focus', onFocus);
  field.addEventListener('blur', onBlur);
  
  // Add copy/paste handlers
  const onCopy = (e) => {
    debugLog('Copy event:', {
      field: field.tagName,
      selection: window.getSelection().toString()
    });
  };
  
  const onPaste = (e) => {
    debugLog('Paste event:', {
      field: field.tagName,
      data: e.clipboardData.getData('text')
    });
  };
  
  // Add to existing listeners
  field.addEventListener('copy', onCopy);
  field.addEventListener('paste', onPaste);
  
  // Store in _listeners for cleanup
  field._listeners = { 
    focus: onFocus, 
    blur: onBlur,
    copy: onCopy,
    paste: onPaste
  };
  
  // Only log if it's a new field type we haven't seen
  const fieldType = `${field.tagName}${field.type ? ':' + field.type : ''}`;
  if (!seenFieldTypes.has(fieldType)) {
    seenFieldTypes.add(fieldType);
    debugLog(`Monitoring new field type: ${fieldType}`);
  }
}

// Handle text input (simplified logging)
function handleInput(e) {
  debouncedHandleInput(e);
}

// Utility to track which fields we're already monitoring
const monitoredFields = new WeakSet();

// MutationObserver setup
const observerConfig = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['contenteditable']
};

// Create observer instance
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      // Clean up removed nodes silently
      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && monitoredFields.has(node)) {
          cleanupFieldListeners(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          node.querySelectorAll('input, textarea, [contenteditable="true"]')
              .forEach(field => monitoredFields.has(field) && cleanupFieldListeners(field));
        }
      });

      // Add new nodes silently
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (isTextField(node)) {
            attachFieldListeners(node);
          }
          node.querySelectorAll('input, textarea, [contenteditable="true"]')
              .forEach(field => isTextField(field) && attachFieldListeners(field));
        }
      });
    }
    // Handle contenteditable changes silently
    else if (mutation.type === 'attributes' && 
             mutation.attributeName === 'contenteditable' && 
             isTextField(mutation.target)) {
      attachFieldListeners(mutation.target);
    }
  });
});

// Add near other state tracking
const cleanupTracker = new Set();

function cleanupAllFields() {
  if (cleanupTracker.size > 0) return;
  
  const uniqueFields = new Set();
  Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
    .filter(field => monitoredFields.has(field))
    .forEach(field => uniqueFields.add(field));

  if (uniqueFields.size > 0) {
    debugLog(`Cleaning up ${uniqueFields.size} fields`);
    uniqueFields.forEach(cleanupFieldListeners);
  }
}

// Add observer state tracking
let isObserverActive = false;

// Update the disconnection logic
function disconnectObserver() {
  try {
    debugLog('Attempting to disconnect observer');
    if (observer && isObserverActive) {
      // Check if we really need to disconnect
      const shouldDisconnect = 
        document.visibilityState === 'hidden' || 
        document.readyState === 'unloading' ||
        document.readyState === 'complete';

      if (shouldDisconnect) {
        debugLog('Conditions met for disconnection');
        observer.disconnect();
        cleanupAllFields();
        isObserverActive = false;
        debugLog('Observer disconnected and fields cleaned up');
      } else {
        debugLog('Skipping disconnection - conditions not met');
      }
    }
  } catch (error) {
    debugLog('Error during observer disconnection:', error);
  }
}

// Update the observer start function
function startObserver() {
  if (isObserverActive) {
    debugLog('Observer already active, skipping start');
    return;
  }
  
  debugLog('Starting observer');
  
  // Remove any existing listeners first
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('pagehide', handlePageHide);
  
  // Add event listeners with named functions for proper cleanup
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);

  observer.observe(document.body, observerConfig);
  isObserverActive = true;
  debugLog('Observer successfully started');
}

// Update visibility change handler
function handleVisibilityChange() {
  const state = document.visibilityState;
  debouncedStateChange(state);
}

function handleBeforeUnload() {
  debugLog('Page unloading');
  disconnectObserver();
}

function handlePageHide() {
  debugLog('Page hiding');
  disconnectObserver();
}

// Update initialization logic
if (document.readyState === 'loading') {
  debugLog('Document loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', startObserver);
} else {
  debugLog('Document already loaded, starting observer immediately');
  startObserver();
}

function cleanupFieldListeners(field) {
  if (!field || !monitoredFields.has(field)) return;
  
  if (field._listeners) {
    field.removeEventListener('focus', field._listeners.focus);
    field.removeEventListener('blur', field._listeners.blur);
    field.removeEventListener('input', handleInput);
    field.removeEventListener('copy', field._listeners.copy);
    field.removeEventListener('paste', field._listeners.paste);
    delete field._listeners;
  }
  
  monitoredFields.delete(field);
  
  if (activeTextField === field) {
    activeTextField = null;
  }
}

// Keep this one at the top with other utility functions
const debouncedStateChange = debounce((state) => {
  debugLog('State change:', state);
  if (state === 'hidden') {
    if (isObserverActive) {  // Only disconnect if active
      disconnectObserver();
    }
  } else if (state === 'visible' && !isObserverActive) {
    startObserver();
  }
}, 250);  // Increase debounce time 

// Add at the top with other state tracking
const seenFieldTypes = new Set(); 