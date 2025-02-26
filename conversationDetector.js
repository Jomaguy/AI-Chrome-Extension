// Debug mode flag for conversation detection
const CONV_DEBUG = false;

// Debug prefix specific to conversation detection
const CONV_DEBUG_PREFIX = '[ConversationDetector]';

// Modified logging approach that doesn't block other logs
// Only filter conversation logs when debug is off, allow all other logs
console.log = (function(originalLog) {
  return function(...args) {
    // Always allow logs that are not conversation related
    const isConversationLog = typeof args[0] === 'string' && 
      (args[0].startsWith('[ConversationDetector]') || 
       args[0].startsWith('[ConversationStorage]'));
      
    // If it's not a conversation log OR debug is on, show the log
    if (!isConversationLog || CONV_DEBUG) {
      originalLog.apply(console, args);
    }
  };
})(console.log.bind(console));

// Selectors for conversation detection
const SELECTORS = {
  ONGOING_CONVERSATION: '.msg-s-message-list-container',
  NEW_CONVERSATION: '.msg-form__contenteditable',
  MESSAGE_CONTAINER: '.msg-s-event-with-indicator.display-flex',
  MESSAGE_CONTENT: '.msg-s-event-listitem__body',
  MESSAGE_GROUP_META: '.msg-s-message-group__meta',
  MESSAGE_SENDER_NAME: '.msg-s-message-group__name',
  MESSAGE_GROUP: '.msg-s-message-list__event',
  MESSAGE_LIST: '.msg-s-message-list__event',
  MESSAGE_ITEM: '.msg-s-event-listitem',
  CONSECUTIVE_MESSAGE: '.msg-s-event-listitem--m2m-msg-followed-by-date-boundary',
  LAST_IN_GROUP: '.msg-s-event-listitem--last-in-group',
  OTHER_MESSAGE: '.msg-s-event-listitem--other',
  SENDING_INDICATOR: '.msg-s-event-with-indicator__sending-indicator',
  OPTIONS_BUTTON: '.msg-s-event-listitem__reactions-options-ellipsis',
  MESSAGE_BUBBLE: '.msg-s-event-listitem__message-bubble'
};

// Debug logging utility for conversation detection
function convDebugLog(...args) {
  if (!CONV_DEBUG) return;
  
  const [message, ...rest] = args;
  
  // Only log messages with [ConversationDetector] prefix
  const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
  const logMessage = `${CONV_DEBUG_PREFIX} ${timestamp} ${message}`;
  
  console.log(logMessage, ...rest);
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
    currentURL: null,
    currentMessages: [],  // Store current conversation messages
    recipientId: null,   // Store current recipient's identifier
    lastDetectionTime: null, // For debouncing
    lastMessageSender: null,  // Track the last message sender for consecutive messages
    userFullName: null,   // Store the user's full name for message ownership comparison
    lastMessageOwnership: null, // Track the last message ownership for consecutive messages
    lastEmittedType: null, // Track the last emitted conversation type
    lastEmittedURL: null, // Track the last emitted URL for conversation type
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
      this.state.lastEmittedType = null;
      this.state.lastEmittedURL = null;
      
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
      
      // Reset the lastEmittedType when URL changes to ensure fresh detection
      if (oldURL !== newURL) {
        this.state.lastEmittedType = null;
        this.state.lastEmittedURL = null;
        convDebugLog('🔄 Reset conversation emission tracking due to URL change');
      }
      
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

  // Add debounce helper
  shouldDebounce() {
    const now = Date.now();
    if (!this.state.lastDetectionTime) {
      this.state.lastDetectionTime = now;
      return false;
    }
    
    // Debounce for 500ms
    const timeSinceLastDetection = now - this.state.lastDetectionTime;
    if (timeSinceLastDetection < 500) {
      convDebugLog('⏳ Debouncing detection, last detection was ' + timeSinceLastDetection + 'ms ago');
      return true;
    }
    
    this.state.lastDetectionTime = now;
    return false;
  },

  // Helper function to find parent message group
  findParentMessageGroup(element) {
    try {
      let current = element;
      while (current && !current.classList.contains('msg-s-message-list__event')) {
        current = current.parentElement;
      }
      
      if (!current) {
        convDebugLog('❌ Could not find parent message group');
        return null;
      }
      
      convDebugLog('✅ Found parent message group');
      return current;
    } catch (error) {
      convDebugLog('❌ Error finding parent message group:', error);
      return null;
    }
  },

  // Helper function to determine message ownership
  determineMessageOwnership(container) {
    try {
      // Check for sending indicator (indicates our message)
      const sendingIndicator = container.querySelector(SELECTORS.SENDING_INDICATOR);
      if (sendingIndicator) {
        return { isFromUs: true };
      }

      // Check for "other" message class
      if (container.classList.contains('msg-s-event-listitem--other')) {
        return { isFromUs: false };
      }

      // Check options button aria-label
      const optionsButton = container.querySelector(SELECTORS.OPTIONS_BUTTON);
      if (optionsButton) {
        const ariaLabel = optionsButton.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Jonathan Mahrt Guyou')) {
          return { isFromUs: true };
        } else if (ariaLabel.includes('from')) {
          return { isFromUs: false };
        }
      }

      // Check meta container
      const metaContainer = container.querySelector(SELECTORS.MESSAGE_GROUP_META);
      if (metaContainer) {
        const nameElement = metaContainer.querySelector(SELECTORS.MESSAGE_SENDER_NAME);
        if (nameElement) {
          const name = nameElement.textContent.trim();
          return { 
            isFromUs: name === 'Jonathan Mahrt Guyou',
            senderName: name
          };
        }
      }

      // Default to checking if it's in the same group as previous message
      const isConsecutive = container.classList.contains('msg-s-event-listitem--m2m-msg-followed-by-date-boundary');
      if (isConsecutive && this.state.lastMessageOwnership) {
        return this.state.lastMessageOwnership;
      }

      convDebugLog('⚠️ Could not determine message ownership definitively');
      return { isFromUs: false };
    } catch (error) {
      convDebugLog('❌ Error determining message ownership:', error);
      return { isFromUs: false };
    }
  },

  // Enhanced message sender detection
  determineMessageSender(container) {
    try {
      // Find the parent message group
      const messageGroup = this.findParentMessageGroup(container);
      if (!messageGroup) {
        return { name: 'Unknown', isFromRecipient: false };
      }

      // Check if we've already processed this group
      if (messageGroup._processedSender) {
        convDebugLog('📝 Using cached sender for message group:', messageGroup._processedSender);
        return messageGroup._processedSender;
      }

      // Look for meta container in the group
      const metaContainer = messageGroup.querySelector(SELECTORS.MESSAGE_GROUP_META);
      
      // If meta container exists, message is from another person
      if (metaContainer) {
        const nameElement = metaContainer.querySelector(SELECTORS.MESSAGE_SENDER_NAME);
        if (nameElement) {
          const senderName = nameElement.textContent.trim();
          
          // Cache the sender info for this group
          messageGroup._processedSender = {
            name: senderName,
            isFromRecipient: true
          };

          convDebugLog('📝 Found message sender in group:', {
            name: senderName,
            hasMetaContainer: true,
            hasNameElement: true
          });

          return messageGroup._processedSender;
        }
      }

      // No meta container means it's from you
      messageGroup._processedSender = {
        name: 'You',
        isFromRecipient: false
      };

      convDebugLog('📝 Message is from us (no meta container in group)');
      return messageGroup._processedSender;

    } catch (error) {
      convDebugLog('❌ Error determining message sender:', error);
      return { name: 'Unknown', isFromRecipient: false };
    }
  },

  // Updated message extraction
  getRecentMessages() {
    try {
      const exchanges = getExchanges();
      const messages = processExchanges(exchanges);
      return messages;
    } catch (error) {
      convDebugLog('❌ Error processing messages:', error);
      return [];
    }
  },

  // Updated detection with debouncing
  detectConversationType() {
    try {
      // Check if we should debounce
      if (this.shouldDebounce()) {
        return this.state.type;
      }

      convDebugLog('🔍 Starting conversation detection...');
      
      // Reset state for new detection
      this.state.type = null;
      this.state.currentMessages = [];
      
      // Find conversation elements
      const { ongoingElement, newElement } = this.findConversationElements();

      // Get the current URL for better context
      const currentURL = window.location.href;
      
      // Check if this is explicitly a new conversation based on URL
      const isExplicitlyNew = currentURL.includes('/messaging/thread/new/');
      
      // Check if there are any messages in the conversation
      const messageElements = document.querySelectorAll(SELECTORS.MESSAGE_ITEM);
      const hasMessages = messageElements && messageElements.length > 0;
      
      // Logic to determine conversation type
      if (isExplicitlyNew && !hasMessages) {
        // If URL contains 'new' and there are no messages, it's definitely NEW
        this.state.type = 'NEW';
        convDebugLog('✅ NEW conversation detected');
      } else if (ongoingElement && hasMessages) {
        // If there's an ongoing element and messages, it's definitely ONGOING
        this.state.type = 'ONGOING';
        convDebugLog('✅ ONGOING conversation detected', {
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
        
        // Get messages directly
        this.getRecentMessages();
      } else if (newElement && !ongoingElement) {
        // If there's only a new element and no ongoing element, it's NEW
        this.state.type = 'NEW';
        convDebugLog('✅ NEW conversation detected');
      } else if (ongoingElement && !hasMessages) {
        // If there's an ongoing element but no messages, check URL for clues
        if (isExplicitlyNew) {
          this.state.type = 'NEW';
          convDebugLog('✅ NEW conversation detected (based on URL)');
        } else {
          this.state.type = 'ONGOING';
          convDebugLog('✅ ONGOING conversation detected (empty conversation)', {
            url: window.location.href,
            timestamp: new Date().toISOString()
          });
        }
      } else if (!ongoingElement && !newElement) {
        convDebugLog('❌ No conversation elements found');
      } else {
        // Default case - if we can't determine, assume NEW for better user experience
        this.state.type = 'NEW';
        convDebugLog('✅ NEW conversation detected (default case)');
      }

      // Update last detection time
      this.state.lastDetected = new Date().toISOString();
      
      if (this.state.type) {
        convDebugLog('🔍 Detection complete:', {
          type: this.state.type,
          messageCount: this.state.currentMessages.length,
          timestamp: this.state.lastDetected,
          url: window.location.href
        });
        
        // IMPORTANT: Emit event for NEW conversations even when there are no messages
        // This ensures ConversationStorage is updated with the correct type
        if (this.state.type === 'NEW') {
          // Only emit if we haven't already emitted for this type or if the URL has changed
          const shouldEmit = this.state.lastEmittedType !== 'NEW' || 
                            (this.state.lastEmittedURL !== window.location.href);
          
          if (shouldEmit) {
            // Create empty conversation parts for a new conversation
            const emptyConversationParts = [];
            
            // Emit the event with the NEW type
            const event = new CustomEvent('conversationUpdated', {
              detail: {
                parts: emptyConversationParts,
                type: 'NEW',
                timestamp: new Date().toISOString()
              }
            });
            document.dispatchEvent(event);
            
            // Update tracking state
            this.state.lastEmittedType = 'NEW';
            this.state.lastEmittedURL = window.location.href;
            
            convDebugLog('📤 Emitted conversationUpdated event for NEW conversation', {
              url: window.location.href
            });
          } else {
            convDebugLog('ℹ️ Skipped duplicate event emission for NEW conversation');
          }
        }
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

function isPartOfMessageGroup(messageElement) {
  return messageElement.classList.contains(SELECTORS.CONSECUTIVE_MESSAGE.slice(1)) || 
         messageElement.classList.contains(SELECTORS.LAST_IN_GROUP.slice(1));
}

function getMessageGroup(startingMessage) {
  const group = [startingMessage];
  let currentMessage = startingMessage;

  // Look for consecutive messages
  while (currentMessage.nextElementSibling && 
         isPartOfMessageGroup(currentMessage.nextElementSibling)) {
    currentMessage = currentMessage.nextElementSibling;
    group.push(currentMessage);
  }

  return group;
}

function processExchanges(conversationParts) {
  const messages = [];

  // Format conversation parts for logging and storage
  const formattedParts = conversationParts.map((part, i) => {
    const partMessages = part.messages.map(msg => {
      const content = msg.querySelector(SELECTORS.MESSAGE_CONTENT)?.textContent.trim();
      return content;
    }).filter(Boolean);

    return {
      [`Part ${i + 1} - ${part.sender}`]: partMessages,
      sender: part.sender,
      isFromUs: part.isFromUs
    };
  });

  // Log conversation parts clearly
  convDebugLog('📝 Conversation Flow:', formattedParts);

  // Emit event for ConversationStorage
  try {
    // Get conversation type from the ConversationDetector
    const conversationType = window.ConversationDetector?.state?.type || 'UNKNOWN';
    
    const event = new CustomEvent('conversationUpdated', {
      detail: {
        parts: formattedParts,
        type: conversationType,
        timestamp: new Date().toISOString()
      }
    });
    document.dispatchEvent(event);
    convDebugLog('📤 Emitted conversationUpdated event');
  } catch (error) {
    convDebugLog('❌ Error emitting conversationUpdated event:', error);
  }

  // Convert to flat message array for compatibility
  formattedParts.forEach((part, partIndex) => {
    const partKey = Object.keys(part).find(key => key.startsWith('Part'));
    const partMessages = part[partKey];
    
    if (Array.isArray(partMessages)) {
      partMessages.forEach((content, msgIndex) => {
        if (content) {
          messages.push({
            content,
            isFromRecipient: !part.isFromUs,
            sender: part.sender,
            isConsecutive: msgIndex > 0,
            order: messages.length + 1,
            partIndex: partIndex + 1,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  });

  return messages;
}

function getExchanges() {
  const messages = Array.from(document.querySelectorAll(SELECTORS.MESSAGE_ITEM));
  const conversationParts = [];
  let currentGroup = null;
  let lastSender = null;

  // Process messages from newest (bottom) to oldest (top)
  for (let i = messages.length - 1; i >= 0 && conversationParts.length < 4; i--) {
    const messageElement = messages[i];
    const isFromUs = !messageElement.classList.contains(SELECTORS.OTHER_MESSAGE.slice(1));
    let sender = isFromUs ? 'You' : null;

    // Get sender name if it's not us
    if (!isFromUs) {
      // First try to get the name from the current message's group
      const currentNameElement = messageElement.closest(SELECTORS.MESSAGE_GROUP)?.querySelector(SELECTORS.MESSAGE_SENDER_NAME);
      if (currentNameElement) {
        sender = currentNameElement.textContent.trim();
      } else if (lastSender && lastSender !== 'You') {
        // If we can't find the name but the last sender was someone else, use that name
        sender = lastSender;
      } else {
        // Fallback to looking in nearby message groups
        const nearbyGroup = messageElement.closest(SELECTORS.MESSAGE_GROUP)?.previousElementSibling?.querySelector(SELECTORS.MESSAGE_SENDER_NAME);
        if (nearbyGroup) {
          sender = nearbyGroup.textContent.trim();
        } else {
          sender = 'Other';
        }
      }
    }

    // If this is a new sender or first message
    if (sender !== lastSender) {
      // Save previous group if exists
      if (currentGroup) {
        conversationParts.unshift(currentGroup);
      }

      // Start new group if we haven't collected 4 parts yet
      if (conversationParts.length < 4) {
        currentGroup = {
          sender,
          messages: [messageElement],
          isFromUs
        };
        lastSender = sender;
      }
    } else if (currentGroup) {
      // Add to current group
      currentGroup.messages.unshift(messageElement);
    }
  }

  // Add the last group if we haven't reached 4 parts
  if (currentGroup && conversationParts.length < 4) {
    conversationParts.unshift(currentGroup);
  }

  return conversationParts;
} 