// Debug mode flag for conversation storage
const CONV_STORAGE_DEBUG = false;

// Debug prefix specific to conversation storage
const CONV_STORAGE_DEBUG_PREFIX = '[ConversationStorage]';

// Debug logging utility for conversation storage
function convStorageDebugLog(...args) {
  if (!CONV_STORAGE_DEBUG) return;
  
  const [message, ...rest] = args;
  const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
  const logMessage = `${CONV_STORAGE_DEBUG_PREFIX} ${timestamp} ${message}`;
  
  console.log(logMessage, ...rest);
}

// ConversationStorage object
const ConversationStorage = {
  // State for conversation storage
  state: {
    conversationParts: [],     // The 4 conversation parts
    conversationType: null,    // Type of conversation (NEW or ONGOING)
    lastUpdated: null,         // Timestamp of last update
    recipientName: null,       // Current recipient name
    isInitialized: false,      // Initialization flag
    conversationId: null       // Unique ID for the current conversation
  },

  // Initialize the storage
  initialize() {
    if (this.state.isInitialized) {
      convStorageDebugLog('✅ Already initialized');
      return;
    }

    convStorageDebugLog('🚀 Initializing ConversationStorage...');
    
    try {
      // Set initial state
      this.state.isInitialized = true;
      this.state.lastUpdated = new Date().toISOString();
      
      // Set up event listeners
      this.setupEventListeners();
      
      convStorageDebugLog('✅ Event listeners set up successfully');
      convStorageDebugLog('Current state:', this.state);
      convStorageDebugLog('✅ ConversationStorage initialization complete');
    } catch (error) {
      convStorageDebugLog('❌ Initialization error:', error);
      this.state.isInitialized = false;
    }
  },

  // Set up event listeners
  setupEventListeners() {
    // Listen for conversation updates from ConversationDetector
    document.addEventListener('conversationUpdated', (event) => {
      convStorageDebugLog('📥 Received conversationUpdated event:', event.detail);
      
      // Extract parts and type from the event detail
      const { parts, type, timestamp } = event.detail;
      
      // Update conversation with all data
      this.updateConversation(parts, type, timestamp);
    });

    // Listen for recipient updates to associate with conversations
    document.addEventListener('recipientDetected', (event) => {
      // Don't log recipient events anymore
      // convStorageDebugLog('📥 Received recipientDetected event:', event.detail);
      this.state.recipientName = event.detail.name;
    });
  },

  // Update conversation data
  updateConversation(conversationParts, conversationType, timestamp) {
    try {
      // Log the incoming data
      convStorageDebugLog('🔄 Updating conversation with:', {
        partsLength: conversationParts ? conversationParts.length : 0,
        newType: conversationType,
        currentType: this.state.conversationType,
        timestamp
      });
      
      // For NEW conversations, we should reset the conversation parts
      if (conversationType === 'NEW') {
        convStorageDebugLog('🔄 Resetting conversation data for NEW conversation');
        this.state.conversationParts = [];
        this.state.conversationId = this.generateConversationId();
      } else if (conversationParts && conversationParts.length > 0) {
        // Only update parts if they're provided and not empty
        this.state.conversationParts = conversationParts;
      }
      
      // Only update conversation type if it's provided and different
      if (conversationType) {
        const typeChanged = this.state.conversationType !== conversationType;
        this.state.conversationType = conversationType;
        
        if (typeChanged) {
          convStorageDebugLog('🔄 Conversation type changed to:', conversationType);
        }
      }
      
      this.state.lastUpdated = timestamp || new Date().toISOString();
      
      // Generate a conversation ID if needed
      if (!this.state.conversationId) {
        this.state.conversationId = this.generateConversationId();
      }
      
      convStorageDebugLog('✅ Conversation updated successfully');
      convStorageDebugLog('Updated conversation parts:', this.state.conversationParts);
      convStorageDebugLog('Conversation type:', this.state.conversationType);
      
      // Emit event for other components
      this.emitConversationStoredEvent();
    } catch (error) {
      convStorageDebugLog('❌ Error updating conversation:', error);
    }
  },

  // Generate a unique conversation ID
  generateConversationId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `conv-${timestamp}-${random}`;
  },

  // Emit event when conversation is stored
  emitConversationStoredEvent() {
    const event = new CustomEvent('conversationStored', {
      detail: {
        conversationParts: this.state.conversationParts,
        conversationType: this.state.conversationType,
        recipientName: this.state.recipientName,
        conversationId: this.state.conversationId,
        timestamp: this.state.lastUpdated
      }
    });
    
    document.dispatchEvent(event);
    convStorageDebugLog('📤 Emitted conversationStored event');
  },

  // Get the current conversation data
  getConversation() {
    return {
      conversationParts: this.state.conversationParts,
      conversationType: this.state.conversationType,
      recipientName: this.state.recipientName,
      lastUpdated: this.state.lastUpdated,
      conversationId: this.state.conversationId
    };
  },

  // Get conversation type
  getConversationType() {
    return this.state.conversationType;
  },

  // Check if we have a conversation
  hasConversation() {
    return this.state.conversationParts && this.state.conversationParts.length > 0;
  },

  // Get formatted conversation for AI prompt
  getFormattedConversationForAI() {
    try {
      // Check if this is a NEW conversation first
      const isNewConversation = this.state.conversationType === 'NEW';
      
      // For NEW conversations, we can return a simplified result even without message data
      if (isNewConversation) {
        convStorageDebugLog('📝 Formatting NEW conversation for AI');
        
        const result = {
          messages: [],
          conversationType: 'NEW',
          isNewConversation: true
        };
        
        convStorageDebugLog('📝 Formatted NEW conversation for AI:', result);
        convStorageDebugLog('🔍 NEW Conversation type check:', {
          rawType: this.state.conversationType,
          isNewConversation: true,
          typeofIsNew: typeof true,
          stringValue: String(true)
        });
        
        return result;
      }
      
      // For ONGOING conversations, check if we have data
      if (!this.hasConversation()) {
        convStorageDebugLog('⚠️ No conversation data available for AI');
        return null;
      }
      
      // Format the conversation in a way that's optimal for the AI prompt
      const formattedConversation = this.state.conversationParts.map(part => {
        const partKey = Object.keys(part).find(key => key.startsWith('Part'));
        if (!partKey) return null;
        
        const messages = part[partKey];
        const messageText = Array.isArray(messages) ? messages.join('\n') : messages;
        
        return {
          role: part.sender === 'You' ? 'user' : 'other',
          name: part.sender,
          content: messageText
        };
      }).filter(Boolean);
      
      // Add conversation type as metadata
      const result = {
        messages: formattedConversation,
        conversationType: this.state.conversationType,
        isNewConversation: isNewConversation
      };
      
      convStorageDebugLog('📝 Formatted conversation for AI:', result);
      convStorageDebugLog('🔍 Conversation type check:', {
        rawType: this.state.conversationType,
        isNewConversation: isNewConversation,
        typeofIsNew: typeof isNewConversation,
        stringValue: String(isNewConversation)
      });
      
      return result;
    } catch (error) {
      convStorageDebugLog('❌ Error formatting conversation for AI:', error);
      return null;
    }
  },

  // Get a simple text representation of the conversation
  getConversationText() {
    try {
      if (!this.state.conversationParts || this.state.conversationParts.length === 0) {
        return "No conversation available.";
      }
      
      let conversationText = `Conversation with ${this.state.recipientName || 'Unknown'}\n\n`;
      
      this.state.conversationParts.forEach(part => {
        const partKey = Object.keys(part).find(key => key.startsWith('Part'));
        if (!partKey) return;
        
        const sender = part.sender;
        const messages = part[partKey];
        
        conversationText += `${sender}:\n`;
        if (Array.isArray(messages)) {
          messages.forEach(msg => {
            conversationText += `  ${msg}\n`;
          });
        } else {
          conversationText += `  ${messages}\n`;
        }
        conversationText += '\n';
      });
      
      return conversationText;
    } catch (error) {
      convStorageDebugLog('❌ Error generating conversation text:', error);
      return "Error retrieving conversation.";
    }
  }
};

// Export to window
try {
  window.ConversationStorage = ConversationStorage;
  convStorageDebugLog('✅ ConversationStorage exported to window');
} catch (error) {
  convStorageDebugLog('❌ Export error:', error);
}

// Initialize based on document state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    convStorageDebugLog('📝 Document loading, initializing ConversationStorage on DOMContentLoaded');
    ConversationStorage.initialize();
  });
} else {
  convStorageDebugLog('📝 Document already loaded, initializing ConversationStorage immediately');
  ConversationStorage.initialize();
}
