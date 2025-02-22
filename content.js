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

// Update the debounced input handler
const debouncedHandleInput = debounce((e) => {
  const value = e.target.value || e.target.textContent || '';
  const cursor = e.target.selectionStart || 0;
  
  debugLog('Input event:', {
    tagName: e.target.tagName,
    type: e.target.type,
    valueLength: value.length,
    cursor,
    hasListeners: !!e.target._listeners
  });
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
    debugLog('Focus event:', {
      tagName: field.tagName,
      type: field.type,
      id: field.id || 'no-id'
    });
    
    activeTextField = field;
    field.addEventListener('input', handleInput);
    debugLog('Field focused and input listener attached');
  };
  
  const onBlur = () => {
    debugLog('Blur event:', {
      tagName: field.tagName,
      type: field.type,
      id: field.id || 'no-id'
    });
    
    if (activeTextField === field) {
      field.removeEventListener('input', handleInput);
      activeTextField = null;
      debugLog('Field blurred and input listener removed');
    }
  };
  
  // Add the event listeners
  try {
    field.addEventListener('focus', onFocus);
    field.addEventListener('blur', onBlur);
    debugLog('Listeners attached to field:', {
      tagName: field.tagName,
      type: field.type,
      id: field.id || 'no-id'
    });
  } catch (error) {
    debugLog('Error attaching listeners:', error);
  }
  
  // Store in _listeners for cleanup
  field._listeners = {
    focus: onFocus,
    blur: onBlur
  };
  
  // Log new field types
  const fieldType = `${field.tagName}${field.type ? ':' + field.type : ''}`;
  if (!seenFieldTypes.has(fieldType)) {
    seenFieldTypes.add(fieldType);
    debugLog(`Monitoring new field type: ${fieldType}`);
  }
}

// Update handleInput to add immediate feedback
function handleInput(e) {
  try {
    debugLog('Raw input event received:', {
      tagName: e.target.tagName,
      type: e.target.type,
      id: e.target.id || 'no-id'
    });
    debouncedHandleInput(e);
  } catch (error) {
    debugLog('Error in handleInput:', error);
  }
}

// Utility to track monitored fields
const monitoredFields = new WeakSet();
const seenFieldTypes = new Set();

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
      // Clean up removed nodes
      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && monitoredFields.has(node)) {
          cleanupFieldListeners(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          node.querySelectorAll('input, textarea, [contenteditable="true"]')
              .forEach(field => monitoredFields.has(field) && cleanupFieldListeners(field));
        }
      });

      // Add new nodes
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
    // Handle contenteditable changes
    else if (mutation.type === 'attributes' && 
             mutation.attributeName === 'contenteditable' && 
             isTextField(mutation.target)) {
      attachFieldListeners(mutation.target);
    }
  });
});

// Cleanup tracker
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

// Observer state tracking
let isObserverActive = false;

function disconnectObserver() {
  try {
    debugLog('Attempting to disconnect observer');
    if (observer && isObserverActive) {
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
      }
    }
  } catch (error) {
    debugLog('Error during observer disconnection:', error);
  }
}

function startObserver() {
  if (isObserverActive) {
    debugLog('Observer already active, skipping start');
    return;
  }
  
  debugLog('Starting observer');
  
  // Add this debug scan
  debugLog('Initial field scan');
  document.querySelectorAll('input, textarea, [contenteditable="true"]')
    .forEach(field => {
      debugLog('Found field:', {
        tagName: field.tagName,
        type: field.type,
        isTextField: isTextField(field)
      });
      if (isTextField(field)) {
        attachFieldListeners(field);
      }
    });

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('pagehide', handlePageHide);
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);

  observer.observe(document.body, observerConfig);
  isObserverActive = true;
  debugLog('Observer successfully started');
}

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

function cleanupFieldListeners(field) {
  if (!field || !monitoredFields.has(field)) return;
  
  if (field._listeners) {
    field.removeEventListener('focus', field._listeners.focus);
    field.removeEventListener('blur', field._listeners.blur);
    field.removeEventListener('input', handleInput);
    delete field._listeners;
  }
  
  monitoredFields.delete(field);
  
  if (activeTextField === field) {
    activeTextField = null;
  }
}

const debouncedStateChange = debounce((state) => {
  debugLog('State change:', state);
  if (state === 'hidden') {
    if (isObserverActive) {
      disconnectObserver();
    }
  } else if (state === 'visible' && !isObserverActive) {
    startObserver();
  }
}, 250);

// Initialize
if (document.readyState === 'loading') {
  const initObserver = () => {
    startObserver();
    document.removeEventListener('DOMContentLoaded', initObserver);
  };
  document.addEventListener('DOMContentLoaded', initObserver);
} else {
  startObserver();
} 