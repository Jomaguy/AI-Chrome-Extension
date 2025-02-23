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
    (message.includes('Memory check') && !message.includes('error')) ||
    message.includes('[Context] Text context captured') ||
    message.includes('Selection updated') ||
    message.includes('[Trigger] Context validation') ||
    message.includes('[Prompt] Formatting prompt') ||
    message.includes('[API] Generating content') ||
    message.includes('[API] Request body') ||
    message.includes('[API] Raw response') ||
    message.includes('[API] Processing response') ||
    message.includes('[API] Raw suggestion') ||
    message.includes('[API] Processed result') ||
    message.includes('[API] Invalid response structure')
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

// Add near other state tracking
const ghostTextState = {
  isVisible: false,
  suggestedText: null,
  originalText: null,
  cursorPosition: null,
  isProcessing: false,
  lastUpdate: null,
  fieldState: {
    id: null,
    type: null,
    value: null
  }
};

// Add near other state tracking
const textContextState = {
  beforeCursor: null,
  afterCursor: null,
  selectedText: null,
  cursorPosition: null,
  lastUpdate: null,
  contextLength: {
    before: 0,
    after: 0,
    total: 0
  },
  wordContext: null
};

// Add near other state tracking
const triggerState = {
  lastTrigger: null,
  timestamp: null,
  source: null, // 'shortcut', 'context-menu', etc.
  context: {
    isValid: false,
    validationErrors: [],
    textLength: 0
  }
};

// Add position tracking state
const overlayState = {
  activeOverlay: null,
  activeField: null,
  scrollListener: null,
  resizeListener: null
};

// Add visual feedback state
const visualState = {
  loadingIndicator: null,
  errorIndicator: null,
  successIndicator: null
};

// Update API state
const apiState = {
  key: 'AIzaSyA2GUYnGCYlR5v4iugHBNBU4so7bjGoYFA',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
  isProcessing: false,
  lastRequest: null,
  lastResponse: null,
  error: null
};

// Add prompt formatting function
function formatPrompt(field) {
  const context = textContextState;
  
  return {
    text: `Given the following text context:
Before cursor: "${context.beforeCursor}"
After cursor: "${context.afterCursor}"
Current word: "${context.wordContext?.currentWord || ''}"

Please provide a natural continuation of the text that:
1. Matches the writing style
2. Continues from the cursor position
3. Is contextually relevant

Provide only the continuation text without any explanation.`
  };
}

// Update response processing function
function processAIResponse(response, context) {
  try {
    // Log the raw response for debugging
    debugLog('[API] Processing response:', response);

    // Check for valid response structure
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      debugLog('[API] Invalid response structure:', {
        hasCandidates: !!response?.candidates,
        hasContent: !!response?.candidates?.[0]?.content,
        hasParts: !!response?.candidates?.[0]?.content?.parts,
        hasText: !!response?.candidates?.[0]?.content?.parts?.[0]?.text
      });
      throw new Error('Invalid response format');
    }

    let suggestion = response.candidates[0].content.parts[0].text;
    
    debugLog('[API] Raw suggestion:', suggestion);

    // Clean up the response
    suggestion = suggestion
      .trim()
      .replace(/^["']|["']$/g, '')    // Remove quotes
      .replace(/\n\s*\n/g, '\n')      // Clean newlines
      .replace(/\s+/g, ' ');          // Normalize spaces

    // Context matching
    const beforeCursor = context.beforeCursor.trim();
    const afterCursor = context.afterCursor.trim();

    // Calculate relevance score
    const relevanceScore = calculateTextSimilarity(beforeCursor, suggestion);

    // Calculate style match
    const contextStyle = analyzeWritingStyle(beforeCursor);
    const suggestionStyle = analyzeWritingStyle(suggestion);
    const styleScore = calculateStyleMatch(contextStyle, suggestionStyle);

    // Ensure smooth connection with existing text
    if (beforeCursor && !beforeCursor.match(/[\s.!?]$/)) {
      suggestion = ' ' + suggestion;
    }

    const result = {
      text: suggestion,
      isRelevant: relevanceScore > 0.3,
      matchesStyle: styleScore > 0.7,
      scores: {
        relevance: relevanceScore,
        style: styleScore
      }
    };

    debugLog('[API] Processed result:', result);
    return result;

  } catch (error) {
    handleError('response processing', error);
    return null;
  }
}

// Update API client function to better handle responses
async function generateAIContent(field) {
  try {
    apiState.isProcessing = true;
    apiState.error = null;
    
    debugLog('[API] Generating content:', {
      fieldId: field.id,
      textLength: field.value.length,
      cursorPosition: field.selectionStart
    });
    
    const prompt = formatPrompt(field);
    
    // Log the actual request body
    const requestBody = {
      contents: [{
        parts: [prompt]
      }]
    };
    
    debugLog('[API] Request body:', requestBody);
    
    const response = await fetch(`${apiState.baseUrl}?key=${apiState.key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      debugLog('[API] Request failed:', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Log the raw response
    debugLog('[API] Raw response:', data);
    
    apiState.lastResponse = data;

    // Process the response
    const processed = processAIResponse(data, textContextState);
    if (!processed) {
      throw new Error('Failed to process response');
    }

    return processed;
  } catch (error) {
    debugLog('[API] Error:', {
      message: error.message,
      stack: error.stack,
      response: apiState.lastResponse // Add this
    });
    apiState.error = error;
    throw error;
  } finally {
    apiState.isProcessing = false;
  }
}

// Update attachFieldListeners
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
    try {
      // Capture text context on selection
      captureTextContext(field);
      
      debouncedSelectionUpdate(field);
    } catch (error) {
      handleError('selection handler', error, field);
    }
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
      const contextValidation = validateContext(field);
      if (!contextValidation?.isValid) {
        showError(contextValidation.validationErrors[0]);
        return;
      }

      // Command/Ctrl + Shift + S for AI suggestions
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        
        const loadingIndicator = createLoadingIndicator(field);
        captureTextContext(field);
        
        generateAIContent(field)
          .then(response => {
            const suggestion = response.text;
            
            // Store suggestion in state
            ghostTextState.suggestedText = suggestion;
            ghostTextState.isVisible = true;
            
            // Show ghost text inline
            const overlay = createGhostOverlay(field);
            const beforeText = textContextState.beforeCursor;
            const afterText = textContextState.afterCursor;
            
            // Create ghost span without extra space
            const ghostSpan = document.createElement('span');
            ghostSpan.className = 'ai-ghost-suggestion';
            ghostSpan.textContent = suggestion.trimStart();
            
            // Set content without extra spaces
            overlay.textContent = beforeText;
            overlay.appendChild(ghostSpan);
            if (afterText) {
              overlay.appendChild(document.createTextNode(afterText));
            }
            
            loadingIndicator.remove();
            showSuccess();
          })
          .catch(error => {
            loadingIndicator.remove();
            showError(error.message);
          });
      }

      // Command/Ctrl + Shift + R for AI rephrase
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r') {
        e.preventDefault();
        showError("Rephrase feature coming soon!");
      }
    } catch (error) {
      handleError('AI shortcuts handler', error, field);
      showError("Something went wrong");
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

  field.addEventListener('keydown', handleKeyDown);
  
  // Update stored listeners
  field._listeners = {
    ...field._listeners,
    keyDown: handleKeyDown
  };
}

// Update handleInput function to clear ghost text
function handleInput(e) {
  try {
    // Clear any existing ghost text
    if (overlayState.activeOverlay) {
      overlayState.activeOverlay.remove();
      overlayState.activeOverlay = null;
      ghostTextState.isVisible = false;
      ghostTextState.suggestedText = null;
    }
    
    // Capture text context on input
    captureTextContext(e.target);
    debouncedHandleInput(e);
  } catch (error) {
    handleError('input handler', error, e.target);
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
  
  // Add style injection
  injectStyles();
  
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

    // Add ghost text cleanup when field is removed
    if (ghostTextState.fieldState.id === field.id) {
      cleanupGhostText();
      debugLog('[Ghost] Cleaned up on field removal:', {
        fieldId: field.id || 'no-id'
      });
    }
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
  try {
    // Capture text context on selection
    captureTextContext(field);
    
    debouncedSelectionUpdate(field);
  } catch (error) {
    handleError('selection handler', error, field);
  }
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

// Add ghost text cleanup function
function cleanupGhostText() {
  ghostTextState.isVisible = false;
  ghostTextState.suggestedText = null;
  ghostTextState.originalText = null;
  ghostTextState.cursorPosition = null;
  ghostTextState.isProcessing = false;
  ghostTextState.lastUpdate = new Date().toISOString();
  ghostTextState.fieldState = {
    id: null,
    type: null,
    value: null
  };
  
  debugLog('[Ghost] State cleaned up:', {
    timestamp: ghostTextState.lastUpdate
  });
}

// Add ghost text state update function
function updateGhostTextState(field, text = null) {
  try {
    ghostTextState.isVisible = !!text;
    ghostTextState.suggestedText = text;
    ghostTextState.originalText = field.value;
    ghostTextState.cursorPosition = field.selectionStart;
    ghostTextState.isProcessing = false;
    ghostTextState.lastUpdate = new Date().toISOString();
    ghostTextState.fieldState = {
      id: field.id || 'no-id',
      type: field.type,
      value: field.value
    };
    
    debugLog('[Ghost] State updated:', {
      hasText: !!text,
      cursorAt: ghostTextState.cursorPosition,
      fieldId: field.id || 'no-id'
    });
  } catch (error) {
    handleError('ghost state update', error, field);
  }
}

// Add near other utility functions
function getWordBoundaries(text, position) {
  try {
    // Get word at cursor
    const beforeCursor = text.slice(0, position);
    const afterCursor = text.slice(position);
    
    // Find word boundaries
    const wordBefore = beforeCursor.match(/\S+\s*$/)?.[0] || '';
    const wordAfter = afterCursor.match(/^\s*\S+/)?.[0] || '';
    
    return {
      currentWord: (wordBefore + wordAfter).trim(),
      wordStart: position - wordBefore.length,
      wordEnd: position + wordAfter.length,
      isAtWordBoundary: !wordBefore || !wordAfter
    };
  } catch (error) {
    handleError('word boundaries', error);
    return null;
  }
}

// Update text context capture
function captureTextContext(field) {
  try {
    const cursorPos = field.selectionStart;
    const text = field.value;
    
    const wordContext = getWordBoundaries(text, cursorPos);
    
    textContextState.beforeCursor = text.substring(0, cursorPos);
    textContextState.afterCursor = text.substring(cursorPos);
    textContextState.selectedText = text.substring(field.selectionStart, field.selectionEnd);
    textContextState.cursorPosition = cursorPos;
    textContextState.lastUpdate = new Date().toISOString();
    textContextState.contextLength = {
      before: textContextState.beforeCursor.length,
      after: textContextState.afterCursor.length,
      total: text.length
    };
    textContextState.wordContext = wordContext;
    
    // Only log errors now
  } catch (error) {
    handleError('text context capture', error, field);
  }
}

// Add validation function
function validateContext(field) {
  try {
    const minLength = 3; // Minimum characters needed
    const context = {
      isValid: false,
      validationErrors: [],
      textLength: field.value.length
    };

    // Check text length
    if (field.value.length < minLength) {
      context.validationErrors.push('Text too short');
    }

    // Check if cursor is in valid position
    if (field.selectionStart !== field.selectionEnd) {
      context.validationErrors.push('Text must not be selected');
    }

    context.isValid = context.validationErrors.length === 0;
    return context;
  } catch (error) {
    handleError('context validation', error, field);
    return null;
  }
}

// Add style injection function
function injectStyles() {
  const styles = `
    .ai-ghost-text {
      position: absolute;
      pointer-events: none;
      color: inherit;
      background: transparent;
      white-space: pre-wrap;
      overflow: hidden;
      z-index: 1000;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      padding: inherit;
      margin: inherit;
      text-align: inherit;
    }
    
    .ai-ghost-suggestion {
      color: #8888;
    }
    
    .ai-loading-indicator {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border: 2px solid #8888;
      border-top-color: #333;
      border-radius: 50%;
      animation: ai-spin 1s linear infinite;
      z-index: 1001;
    }
    
    @keyframes ai-spin {
      to { transform: translateY(-50%) rotate(360deg); }
    }
    
    .ai-error-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 1002;
      animation: ai-fade-in 0.3s ease;
    }
    
    .ai-success-flash {
      position: absolute;
      inset: 0;
      background: #44ff44;
      opacity: 0.2;
      animation: ai-flash 1s ease;
    }
    
    @keyframes ai-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    
    @keyframes ai-flash {
      0% { opacity: 0.2; }
      50% { opacity: 0.1; }
      100% { opacity: 0; }
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Add position update function
function updateOverlayPosition() {
  if (!overlayState.activeOverlay || !overlayState.activeField) return;
  
  const field = overlayState.activeField;
  const overlay = overlayState.activeOverlay;
  const fieldRect = field.getBoundingClientRect();
  
  // Get computed styles
  const fieldStyle = window.getComputedStyle(field);
  
  // Copy field styles to overlay
  overlay.style.fontFamily = fieldStyle.fontFamily;
  overlay.style.fontSize = fieldStyle.fontSize;
  overlay.style.lineHeight = fieldStyle.lineHeight;
  overlay.style.padding = fieldStyle.padding;
  overlay.style.textAlign = fieldStyle.textAlign;
  
  // Position overlay
  overlay.style.top = `${window.scrollY + fieldRect.top}px`;
  overlay.style.left = `${window.scrollX + fieldRect.left}px`;
  overlay.style.width = `${fieldRect.width}px`;
  overlay.style.height = `${fieldRect.height}px`;
}

// Update createGhostOverlay function
function createGhostOverlay(field) {
  // Remove existing overlay if any
  if (overlayState.activeOverlay) {
    overlayState.activeOverlay.remove();
    window.removeEventListener('scroll', overlayState.scrollListener);
    window.removeEventListener('resize', overlayState.resizeListener);
  }

  const overlay = document.createElement('div');
  overlay.className = 'ai-ghost-text';
  
  // Store active elements
  overlayState.activeOverlay = overlay;
  overlayState.activeField = field;
  
  // Add scroll and resize listeners
  overlayState.scrollListener = () => requestAnimationFrame(updateOverlayPosition);
  overlayState.resizeListener = () => requestAnimationFrame(updateOverlayPosition);
  
  window.addEventListener('scroll', overlayState.scrollListener, { passive: true });
  window.addEventListener('resize', overlayState.resizeListener, { passive: true });
  
  // Initial position
  updateOverlayPosition();
  
  document.body.appendChild(overlay);
  return overlay;
}

// Add loading indicator creation
function createLoadingIndicator(field) {
  const indicator = document.createElement('div');
  indicator.className = 'ai-loading-indicator';
  
  // Position relative to field
  const fieldRect = field.getBoundingClientRect();
  indicator.style.top = `${window.scrollY + fieldRect.top}px`;
  indicator.style.right = `${fieldRect.right + 8}px`;
  
  document.body.appendChild(indicator);
  visualState.loadingIndicator = indicator;
  return indicator;
}

// Add error indicator
function showError(message) {
  const errorToast = document.createElement('div');
  errorToast.className = 'ai-error-toast';
  errorToast.textContent = message;
  
  document.body.appendChild(errorToast);
  visualState.errorIndicator = errorToast;
  
  // Auto remove after delay
  setTimeout(() => {
    errorToast.remove();
    visualState.errorIndicator = null;
  }, 3000);
}

// Add success feedback
function showSuccess() {
  const successFlash = document.createElement('div');
  successFlash.className = 'ai-success-flash';
  
  document.body.appendChild(successFlash);
  visualState.successIndicator = successFlash;
  
  // Remove after animation
  setTimeout(() => {
    successFlash.remove();
    visualState.successIndicator = null;
  }, 1000);
}

// Add text similarity scoring
function calculateTextSimilarity(text1, text2) {
  try {
    // Convert to lowercase and remove punctuation
    const normalize = (text) => text.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ');
    
    const words1 = normalize(text1).split(' ');
    const words2 = normalize(text2).split(' ');
    
    // Create word frequency maps
    const freq1 = words1.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    
    const freq2 = words2.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    Object.keys(freq1).forEach(word => {
      if (freq2[word]) {
        dotProduct += freq1[word] * freq2[word];
      }
      norm1 += freq1[word] * freq1[word];
    });
    
    Object.keys(freq2).forEach(word => {
      norm2 += freq2[word] * freq2[word];
    });
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  } catch (error) {
    handleError('text similarity', error);
    return 0;
  }
}

// Add style analysis function
function analyzeWritingStyle(text) {
  try {
    // Basic style metrics
    const metrics = {
      avgSentenceLength: 0,
      avgWordLength: 0,
      formalityScore: 0,
      punctuationDensity: 0
    };
    
    // Split into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Calculate metrics
    metrics.avgSentenceLength = sentences.length ? words.length / sentences.length : 0;
    metrics.avgWordLength = words.length ? words.join('').length / words.length : 0;
    metrics.punctuationDensity = (text.match(/[.,;:]/g) || []).length / text.length;
    
    // Formality indicators
    const formalWords = text.match(/\b(therefore|however|furthermore|consequently)\b/gi) || [];
    const informalWords = text.match(/\b(like|just|maybe|stuff|things)\b/gi) || [];
    metrics.formalityScore = (formalWords.length - informalWords.length) / words.length;
    
    return metrics;
  } catch (error) {
    handleError('style analysis', error);
    return null;
  }
}

// Add style matching function
function calculateStyleMatch(style1, style2) {
  try {
    if (!style1 || !style2) return 0;
    
    // Compare metrics with weighted importance
    const weights = {
      avgSentenceLength: 0.3,
      avgWordLength: 0.2,
      formalityScore: 0.3,
      punctuationDensity: 0.2
    };
    
    // Calculate normalized difference for each metric
    const diff = {
      avgSentenceLength: 1 - Math.abs(style1.avgSentenceLength - style2.avgSentenceLength) / Math.max(style1.avgSentenceLength, 1),
      avgWordLength: 1 - Math.abs(style1.avgWordLength - style2.avgWordLength) / Math.max(style1.avgWordLength, 1),
      formalityScore: 1 - Math.abs(style1.formalityScore - style2.formalityScore),
      punctuationDensity: 1 - Math.abs(style1.punctuationDensity - style2.punctuationDensity)
    };
    
    // Calculate weighted average
    return Object.keys(weights).reduce((score, metric) => {
      return score + (diff[metric] * weights[metric]);
    }, 0);
  } catch (error) {
    handleError('style matching', error);
    return 0;
  }
}

// Update handleKeyDown function
function handleKeyDown(e) {
  // Accept with Command/Ctrl + Shift + Space
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ' ' && overlayState.activeOverlay) {
    e.preventDefault();
    
    const field = e.target;
    const suggestion = ghostTextState.suggestedText;
    
    if (suggestion) {
      // Update field value with suggestion
      const beforeText = textContextState.beforeCursor;
      const afterText = textContextState.afterCursor;
      
      field.value = beforeText + suggestion + afterText;
      
      // Move cursor to end of suggestion
      const newCursorPos = beforeText.length + suggestion.length;
      field.selectionStart = newCursorPos;
      field.selectionEnd = newCursorPos;
      
      // Clear ghost text
      overlayState.activeOverlay.remove();
      overlayState.activeOverlay = null;
      ghostTextState.isVisible = false;
      ghostTextState.suggestedText = null;
      
      showSuccess();
    }
  }
  
  // Clear with Escape
  if (e.key === 'Escape' && overlayState.activeOverlay) {
    e.preventDefault();
    overlayState.activeOverlay.remove();
    overlayState.activeOverlay = null;
    ghostTextState.isVisible = false;
    ghostTextState.suggestedText = null;
  }
} 