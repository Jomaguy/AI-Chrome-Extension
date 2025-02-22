// Debug mode flag
const DEBUG = true;

// Update our logging utility with a distinct prefix
function debugLog(...args) {
  if (!DEBUG) return;
  
  const [message, ...rest] = args;
  
  // Skip more noisy logs
  if (
    message.includes('Raw input event received') ||
    message.includes('Found field:') ||
    message.includes('Field focused and input') ||
    message.includes('Field blurred and input') ||
    message.includes('Monitoring new field type') ||
    message.includes('Listeners attached to field') ||
    message.includes('Input event:') ||
    (message.includes('Memory check') && !message.includes('error'))
  ) return;
  
  // Enhanced categorization with lifecycle events
  const prefix = 
    message.includes('Memory check') ? '[Memory]' :
    message.includes('cleanup') ? '[Cleanup]' :
    message.includes('Observer') || message.includes('Initial field scan') ? '[Observer]' :
    message.includes('Field') ? '[Field]' :
    message.includes('Error') ? '[Error]' :
    message.includes('AI') ? '[AI]' :
    message.includes('Selection') ? '[Selection]' :
    message.includes('initialized') || message.includes('Starting') ? '[Init]' :
    message.includes('State change') || message.includes('unloading') || message.includes('hiding') ? '[State]' :
    message.includes('Direct field removal') || message.includes('Nested field removal') ? '[Cleanup]' :
    '[Lifecycle]';
  
  // Only log the message if it's meaningful
  if (rest.length === 0 && message.trim().length < 3) return;
  
  console.log(prefix, message, ...(rest.length ? rest : []));
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

// Add near other state tracking
const shortcutState = {
  lastShortcut: null,
  timestamp: null
};

// Add near other state tracking
const undoRedoState = {
  lastAction: null,  // 'undo' or 'redo'
  timestamp: null,
  fieldState: {
    beforeAction: null,
    afterAction: null,
    cursorPosition: null,
    fieldId: null
  }
};

// Add near other state tracking
const aiState = {
  lastAction: null,  // 'complete', 'suggest', 'rephrase'
  timestamp: null,
  fieldState: {
    content: null,
    cursorPosition: null,
    selection: null,
    fieldId: null
  }
};

// Add near other state tracking
const lifecycleState = {
  lastEvent: null,
  timestamp: null,
  cleanupStatus: {
    fieldsRemoved: 0,
    listenersRemoved: 0,
    stateReset: false
  }
};

// Add near other state tracking
const memoryState = {
  lastCheck: null,
  activeFields: 0,
  attachedListeners: 0,
  performance: {
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0
  }
};

// Helper function to attach listeners to a field
function attachFieldListeners(field) {
  if (!field || monitoredFields.has(field)) return;
  if (!isTextField(field)) return;
  
  if (field._listeners) {
    debugLog('Field already has listeners:', {
      tagName: field.tagName,
      id: field.id || 'no-id'
    });
    return;
  }
  
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
  
  // Add selection handler
  const onSelect = () => {
    debouncedSelectionUpdate(field);
  };

  const onCopy = (e) => {
    try {
      const selectedText = selectionState.selectedText;
      // Only process copy events with actual selected text
      if (selectedText && selectedText.length > 0) {
        clipboardState.lastCopy = selectedText;
        clipboardState.timestamp = new Date().toISOString();
        
        debugLog('Copy event:', {
          selectedText,
          length: selectedText.length,
          fieldType: field.tagName,
          fieldId: field.id || 'no-id'
        });
      }
    } catch (error) {
      handleError('copy handler', error, field);
    }
  };

  const onPaste = (e) => {
    try {
      const pastedText = e.clipboardData.getData('text/plain');
      clipboardState.lastPaste = pastedText;
      clipboardState.timestamp = new Date().toISOString();
      
      debugLog('Paste event:', {
        textLength: pastedText.length,
        cursorPosition: field.selectionStart,
        fieldType: field.tagName,
        fieldId: field.id || 'no-id'
      });
    } catch (error) {
      handleError('paste handler', error, field);
    }
  };
  
  const handleSelectAll = (e) => {
    try {
      // Check if it's Ctrl+A (Windows/Linux) or Cmd+A (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault(); // Prevent default to handle it ourselves
        
        field.select(); // Select all text
        updateSelectionState(field); // Update our selection tracking
        
        shortcutState.lastShortcut = 'selectAll';
        shortcutState.timestamp = new Date().toISOString();
        
        debugLog('Select All shortcut:', {
          fieldType: field.tagName,
          fieldId: field.id || 'no-id',
          textLength: field.value.length
        });
      }
    } catch (error) {
      debugLog('Error in select all handler:', error);
    }
  };
  
  const handleUndoRedo = (e) => {
    try {
      // Only log for potential undo/redo commands
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
        debugLog('Potential undo/redo detected:', {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey
        });

        const beforeState = {
          content: field.value,
          cursorPosition: field.selectionStart,
          selectionEnd: field.selectionEnd,
          timestamp: Date.now()
        };

        // Undo (Ctrl/Cmd + Z)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          setTimeout(() => {
            const afterState = {
              content: field.value,
              cursorPosition: field.selectionStart
            };
            
            debugLog('Checking undo state change:', {
              before: beforeState.content.length,
              after: afterState.content.length,
              changed: beforeState.content !== afterState.content
            });
            
            if (beforeState.content !== afterState.content) {
              trackUndoRedo(field, 'undo', beforeState, afterState);
            }
          }, 10); // Slightly longer timeout
        }

        // Similar update for redo...
      }
    } catch (error) {
      debugLog('Error in undo/redo handler:', error);
    }
  };

  const handleAIShortcuts = (e) => {
    try {
      const getFieldState = () => ({
        content: field.value,
        cursorPosition: field.selectionStart,
        selection: field.value.substring(field.selectionStart, field.selectionEnd),
        fieldId: field.id || 'no-id'
      });

      // Command/Ctrl + Shift + Space for AI completion
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        const fieldState = getFieldState();
        aiState.lastAction = 'complete';
        aiState.timestamp = new Date().toISOString();
        aiState.fieldState = fieldState;
        
        debugLog('AI completion triggered:', {
          fieldType: field.tagName,
          fieldId: fieldState.fieldId,
          cursorPosition: fieldState.cursorPosition,
          hasSelection: fieldState.selection.length > 0,
          shortcut: 'Cmd/Ctrl + Shift + Space'
        });
      }

      // Command/Ctrl + Shift + S for AI suggestions
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        const fieldState = getFieldState();
        aiState.lastAction = 'suggest';
        aiState.timestamp = new Date().toISOString();
        aiState.fieldState = fieldState;
        
        debugLog('AI suggestions triggered:', {
          fieldType: field.tagName,
          fieldId: fieldState.fieldId,
          cursorPosition: fieldState.cursorPosition,
          hasSelection: fieldState.selection.length > 0,
          shortcut: 'Cmd/Ctrl + Shift + S'
        });
      }

      // Command/Ctrl + Shift + R for AI rephrase
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r') {
        e.preventDefault();
        const fieldState = getFieldState();
        aiState.lastAction = 'rephrase';
        aiState.timestamp = new Date().toISOString();
        aiState.fieldState = fieldState;
        
        debugLog('AI rephrase triggered:', {
          fieldType: field.tagName,
          fieldId: fieldState.fieldId,
          cursorPosition: fieldState.cursorPosition,
          hasSelection: fieldState.selection.length > 0,
          shortcut: 'Cmd/Ctrl + Shift + R'
        });
      }
    } catch (error) {
      handleError('AI shortcuts handler', error, field);
    }
  };

  // Update the event listeners section
  try {
    field.addEventListener('focus', onFocus);
    field.addEventListener('blur', onBlur);
    field.addEventListener('select', onSelect);
    field.addEventListener('mouseup', onSelect);
    field.addEventListener('keyup', (e) => {
      if (e.shiftKey || e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        onSelect();
      }
    });
    field.addEventListener('copy', onCopy);
    field.addEventListener('paste', onPaste);
    field.addEventListener('keydown', handleSelectAll);
    field.addEventListener('keydown', handleUndoRedo);
    field.addEventListener('keydown', handleAIShortcuts);
    
    debugLog('Listeners attached to field:', {
      tagName: field.tagName,
      type: field.type,
      id: field.id || 'no-id'
    });
  } catch (error) {
    debugLog('Error attaching listeners:', error);
  }
  
  // Update stored listeners
  field._listeners = {
    ...field._listeners,
    select: onSelect,
    copy: onCopy,
    paste: onPaste,
    selectAll: handleSelectAll,
    undoRedo: handleUndoRedo,
    aiShortcuts: handleAIShortcuts
  };
  
  // Log new field types
  const fieldType = `${field.tagName}${field.type ? ':' + field.type : ''}`;
  if (!seenFieldTypes.has(fieldType)) {
    seenFieldTypes.add(fieldType);
    debugLog(`Monitoring new field type: ${fieldType}`);
  }

  // Add memory check after attachment
  checkMemoryUsage();
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

// Add near other state tracking
const removedFieldTracker = {
  pendingRemovals: new Set(),
  lastRemovalTime: null
};

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
      // Enhanced removal handling
      mutation.removedNodes.forEach(node => {
        try {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Track the removal time
            removedFieldTracker.lastRemovalTime = Date.now();
            
            // Handle direct field removal
            if (monitoredFields.has(node)) {
              debugLog('Direct field removal detected:', {
                tagName: node.tagName,
                id: node.id || 'no-id'
              });
              cleanupFieldListeners(node);
            }
            
            // Handle nested fields removal
            const removedFields = node.querySelectorAll('input, textarea, [contenteditable="true"]');
            removedFields.forEach(field => {
              if (monitoredFields.has(field)) {
                debugLog('Nested field removal detected:', {
                  tagName: field.tagName,
                  id: field.id || 'no-id',
                  parentNode: node.tagName
                });
                cleanupFieldListeners(field);
              }
            });
          }
        } catch (error) {
          debugLog('Error handling node removal:', error);
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

    // Add memory check after disconnect
    checkMemoryUsage();
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

// Enhance cleanup tracking
function cleanupFieldListeners(field) {
  try {
    if (!field || !monitoredFields.has(field)) return;
    
    let listenersRemoved = 0;
    
    if (field._listeners) {
      // Track each listener removal
      field.removeEventListener('focus', field._listeners.focus); listenersRemoved++;
      field.removeEventListener('blur', field._listeners.blur); listenersRemoved++;
      field.removeEventListener('input', handleInput); listenersRemoved++;
      field.removeEventListener('select', field._listeners.select); listenersRemoved++;
      field.removeEventListener('mouseup', field._listeners.select); listenersRemoved++;
      field.removeEventListener('keyup', field._listeners.select);
      field.removeEventListener('copy', field._listeners.copy); listenersRemoved++;
      field.removeEventListener('paste', field._listeners.paste); listenersRemoved++;
      field.removeEventListener('keydown', field._listeners.selectAll); listenersRemoved++;
      field.removeEventListener('keydown', field._listeners.undoRedo); listenersRemoved++;
      field.removeEventListener('keydown', field._listeners.aiShortcuts); listenersRemoved++;
      
      delete field._listeners;
    }
    
    monitoredFields.delete(field);
    
    // Update cleanup status
    lifecycleState.lastEvent = 'cleanup';
    lifecycleState.timestamp = new Date().toISOString();
    lifecycleState.cleanupStatus.fieldsRemoved++;
    lifecycleState.cleanupStatus.listenersRemoved += listenersRemoved;
    
    debugLog('Field cleanup completed:', {
      fieldType: field.tagName,
      fieldId: field.id || 'no-id',
      listenersRemoved,
      totalFieldsRemoved: lifecycleState.cleanupStatus.fieldsRemoved
    });

    // Add memory check after cleanup
    checkMemoryUsage();
  } catch (error) {
    handleError('field cleanup', error, field);
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

// Add near other state tracking variables at the top
const selectionState = {
  selectedText: '',
  selectionStart: 0,
  selectionEnd: 0,
  field: null,
  timestamp: null
};

// Add this utility function near other utility functions
function updateSelectionState(field) {
  try {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = field.value.substring(start, end);
    
    selectionState.selectedText = selected;
    selectionState.selectionStart = start;
    selectionState.selectionEnd = end;
    selectionState.field = field;
    selectionState.timestamp = new Date().toISOString();

    debugLog('Selection updated:', {
      length: selected.length,
      start,
      end,
      fieldType: field.tagName,
      fieldId: field.id || 'no-id'
    });
  } catch (error) {
    debugLog('Error updating selection state:', error);
  }
}

// Add near other debounced functions
const debouncedSelectionUpdate = debounce((field) => {
  updateSelectionState(field);
}, 150);  // Shorter than input debounce

// Update the onSelect handler
const onSelect = () => {
  debouncedSelectionUpdate(field);
};

// Add near other state tracking
const clipboardState = {
  lastCopy: null,
  lastPaste: null,
  timestamp: null
};

// Add utility function to track state changes
function trackUndoRedo(field, action, beforeState, afterState) {
  try {
    undoRedoState.lastAction = action;
    undoRedoState.timestamp = new Date().toISOString();
    undoRedoState.fieldState.beforeAction = beforeState;
    undoRedoState.fieldState.afterAction = afterState;
    undoRedoState.fieldState.fieldId = field.id || 'no-id';

    debugLog(`${action} action detected:`, {
      fieldType: field.tagName,
      fieldId: field.id || 'no-id',
      cursorPosition: beforeState.cursorPosition,
      contentLength: beforeState.content.length
    });
  } catch (error) {
    debugLog('Error tracking undo/redo:', error);
  }
}

// Add near the top with other utility functions
function handleError(context, error, field = null) {
  const errorInfo = {
    context,
    message: error.message,
    timestamp: new Date().toISOString(),
    fieldInfo: field ? {
      tagName: field.tagName,
      id: field.id || 'no-id',
      type: field.type
    } : null
  };

  // Log the error with our debug utility
  debugLog('Error occurred:', errorInfo);

  // Track error state if needed
  if (DEBUG) {
    console.error('Full error details:', {
      ...errorInfo,
      stack: error.stack
    });
  }
}

// Add memory tracking function
function checkMemoryUsage() {
  try {
    memoryState.lastCheck = new Date().toISOString();
    memoryState.activeFields = monitoredFields.size;
    
    // Get performance memory if available
    if (window.performance && performance.memory) {
      memoryState.performance = {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize
      };
    }
    
    debugLog('Memory check:', {
      timestamp: memoryState.lastCheck,
      activeFields: memoryState.activeFields,
      attachedListeners: memoryState.attachedListeners,
      heapUsed: memoryState.performance.usedJSHeapSize
    });
  } catch (error) {
    handleError('memory check', error);
  }
} 