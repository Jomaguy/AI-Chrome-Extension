// Debug mode flag for conversation detection
const CONV_DEBUG = true;

// Debug prefix specific to conversation detection
const CONV_DEBUG_PREFIX = '[ConversationDetector]';

// Selectors for conversation detection
const SELECTORS = {
  ONGOING_CONVERSATION: '.msg-s-message-list-container',
  NEW_CONVERSATION: '.msg-form__contenteditable'
};

// Debug logging utility for conversation detection
function convDebugLog(...args) {
  if (!CONV_DEBUG) return;
  
  const [message, ...rest] = args;
  
  // Only show conversation-specific logs and remove noise
  const isConversationLog = 
    (message.includes('conversation') || message.startsWith('🔍') || 
     message.startsWith('✅') || message.startsWith('❌')) &&
    !message.includes('recipient') &&
    !message.includes('profile');
    
  if (!isConversationLog) return;
  
  const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
  console.log(CONV_DEBUG_PREFIX, timestamp, ...args);
}

// Initial debug message
convDebugLog('🚀 Starting conversation detector...');

// ConversationDetector object
const ConversationDetector = {
  // State focused only on conversation tracking
  state: {
    type: null,          // 'NEW' or 'ONGOING'
    lastDetected: null,
    isInitialized: false,
    currentURL: null
  },

  // Initialize the detector
  initialize() {
    if (this.state.isInitialized) {
      convDebugLog('✅ Already initialized');
      return;
    }

    convDebugLog('🔍 Initializing conversation detector');
    
    try {
      // Set initial state
      this.state.isInitialized = true;
      this.state.lastDetected = new Date().toISOString();
      this.state.currentURL = window.location.href;
      
      // Set up URL monitoring
      this.setupURLMonitoring();
      
      // Initial detection
      this.detectConversationType();
      
      convDebugLog('✅ Initialization complete');
    } catch (error) {
      convDebugLog('❌ Initialization error:', error);
      this.state.isInitialized = false;
    }
  },

  // Set up URL monitoring
  setupURLMonitoring() {
    convDebugLog('🔍 Setting up conversation monitoring');

    // Function to check URL changes
    const checkURLChange = () => {
      const currentURL = window.location.href;
      const previousURL = this.state.currentURL;

      if (currentURL !== previousURL) {
        this.state.currentURL = currentURL;
        this.handleURLChange(previousURL, currentURL);
      }
    };

    // Set up interval for checking URL
    setInterval(checkURLChange, 1000);

    convDebugLog('✅ Monitoring ready');
  },

  // Handle URL changes
  handleURLChange(oldURL, newURL) {
    // Only process if we're entering or leaving a messaging page
    if (newURL.includes('/messaging/')) {
      convDebugLog('🔍 Navigation to messaging detected');
      this.detectConversationType();
    }
  },

  // Find conversation elements
  findConversationElements() {
    try {
      const ongoingElement = document.querySelector(SELECTORS.ONGOING_CONVERSATION);
      const newElement = document.querySelector(SELECTORS.NEW_CONVERSATION);

      // Only log if we found at least one element
      if (ongoingElement || newElement) {
        convDebugLog('🔍 Found elements:', {
          ongoing: !!ongoingElement,
          new: !!newElement
        });
      }

      return { ongoingElement, newElement };
    } catch (error) {
      convDebugLog('❌ Error finding elements:', error);
      return { ongoingElement: null, newElement: null };
    }
  },

  // Detect the type of conversation
  detectConversationType() {
    try {
      // Reset state for new detection
      this.state.type = null;
      
      // Find conversation elements
      const { ongoingElement, newElement } = this.findConversationElements();

      // Prioritize ongoing conversation detection
      if (ongoingElement) {
        this.state.type = 'ONGOING';
        convDebugLog('✅ ONGOING conversation detected');
      } else if (newElement) {
        this.state.type = 'NEW';
        convDebugLog('✅ NEW conversation detected');
      } else {
        convDebugLog('❌ No conversation elements found');
      }

      // Update last detection time
      this.state.lastDetected = new Date().toISOString();
      
      if (this.state.type) {
        convDebugLog('🔍 Detection complete:', {
          type: this.state.type
        });
      }

      return this.state.type;
    } catch (error) {
      convDebugLog('❌ Detection error:', error);
      return null;
    }
  }
};

// Export to window
try {
  window.ConversationDetector = ConversationDetector;
  convDebugLog('✅ Detector ready');
} catch (error) {
  convDebugLog('❌ Export error:', error);
}

// Initialize based on document state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    convDebugLog('🔍 Document loaded, initializing');
    ConversationDetector.initialize();
  });
} else {
  convDebugLog('🔍 Initializing immediately');
  ConversationDetector.initialize();
} 