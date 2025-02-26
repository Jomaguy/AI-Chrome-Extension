// Debug mode flag
window.RECIPIENT_DEBUG = true;

// Debug logging utility with timestamps
function debugLog(...args) {
  if (!window.RECIPIENT_DEBUG) return;
  const timestamp = new Date().toISOString();
  const prefix = `[Recipient ${timestamp}]`;
  console.log(prefix, ...args);
}

debugLog('🚀 RecipientDetector script starting...');

// Guard against multiple initializations
if (window.RecipientDetector && window.RecipientDetector.isInitialized) {
  debugLog('⚠️ RecipientDetector already initialized, skipping...');
} else {
  const RecipientDetector = {
    // Initialization flag
    isInitialized: false,
    
    // Current recipient data
    currentRecipient: {
      name: null,
      headline: null,
      conversationType: null,
      lastDetected: null
    },

    // New conversation selectors
    newConversationSelectors: {
      container: '.artdeco-entity-lockup__content',
      nameContainer: '.artdeco-entity-lockup__title .truncate',
      headlineContainer: '.artdeco-entity-lockup__subtitle'
    },

    // Retry configuration
    retryConfig: {
      maxAttempts: 5,
      delayMs: 1000
    },

    // Observer instance
    observer: null,

    // Initialize the detector
    initialize() {
      if (this.isInitialized) {
        debugLog('Already initialized, skipping...');
        return;
      }
      
      debugLog('Initializing RecipientDetector');
      this.setupUrlMonitoring();
      
      // Initial check if we're already on a messaging page
      if (this.isMessagingPage()) {
        debugLog('Initially on messaging page, detecting recipient');
        this.detectRecipient();
      }
      
      this.isInitialized = true;
      debugLog('✅ RecipientDetector initialization complete');
    },

    // Set up URL monitoring
    setupUrlMonitoring() {
      debugLog('Setting up URL monitoring');
      let lastUrl = window.location.href;
      
      // Monitor URL changes using multiple methods
      // 1. Watch for popstate events (browser back/forward)
      window.addEventListener('popstate', () => {
        this.checkUrlChange(lastUrl);
        lastUrl = window.location.href;
      });

      // 2. Watch for pushState/replaceState
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function() {
        originalPushState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
      };

      window.history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
      };

      window.addEventListener('locationchange', () => {
        this.checkUrlChange(lastUrl);
        lastUrl = window.location.href;
      });

      // 3. Still keep mutation observer as backup
      this.observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          this.checkUrlChange(lastUrl);
          lastUrl = window.location.href;
        }
      });

      // Start observing
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Initial check
      this.checkUrlChange(lastUrl);
      
      debugLog('URL monitoring setup completed');
    },

    // Helper to handle URL changes
    checkUrlChange(previousUrl) {
      const currentUrl = window.location.href;
      debugLog('Checking URL change:', {
        from: previousUrl,
        to: currentUrl
      });

      if (currentUrl !== previousUrl) {
        debugLog('URL changed from', previousUrl, 'to', currentUrl);
        
        // Add debounce to prevent rapid detections
        if (this._debounceTimeout) {
          clearTimeout(this._debounceTimeout);
        }
        
        this._debounceTimeout = setTimeout(async () => {
          if (this.isMessagingPage()) {
            debugLog('New URL is messaging page, waiting for DOM update before detection');
            // Add delay to ensure DOM has updated (proven timing from content.js)
            await this.wait(1000);
            debugLog('DOM update wait complete, starting detection');
            await this.detectRecipient();
          } else {
            debugLog('New URL is not messaging page, clearing recipient');
            this.clearRecipient();
          }
        }, 500); // 500ms debounce
      } else {
        debugLog('URL unchanged, skipping detection');
      }
    },

    // Helper method to wait
    async wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Helper to get all text nodes from an element
    getAllTextNodes(element) {
      const textNodes = [];
      const walk = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walk.nextNode()) {
        const text = node.textContent.trim();
        if (text) textNodes.push(text);
      }

      return textNodes;
    },

    // Check if current page is a messaging page
    isMessagingPage() {
      return window.location.href.includes('linkedin.com/messaging');
    },

    // Extract headline text while handling presence status
    extractHeadlineText(headlineElement) {
      if (!headlineElement) return null;

      // First try to get text from presence status div if it exists
      const presenceStatus = headlineElement.querySelector('.msg-entity-lockup__presence-status');
      if (presenceStatus) {
        // Get all text nodes from the presence status div
        const textNodes = this.getAllTextNodes(presenceStatus);
        
        // Filter out any nodes that contain status information
        const filteredNodes = textNodes.filter(text => !text.toLowerCase().includes('status'));
        
        if (filteredNodes.length > 0) {
          return filteredNodes[filteredNodes.length - 1];
        }
      }

      // If no presence status or no valid headline found, get all text nodes from the main element
      const allTextNodes = this.getAllTextNodes(headlineElement);

      // Filter out status-related text and empty strings
      const filteredNodes = allTextNodes.filter(text => 
        !text.toLowerCase().includes('status') && 
        text.length > 0
      );

      if (filteredNodes.length > 0) {
        // Join all remaining text nodes, in case the headline is split
        return filteredNodes.join(' ').trim();
      }

      return null;
    },

    // Helper to extract new conversation recipient name
    extractNewRecipientName(container) {
      const nameElement = container.querySelector(this.newConversationSelectors.nameContainer);
      return nameElement ? nameElement.textContent.trim() : null;
    },

    // Helper to extract new conversation recipient headline
    extractNewRecipientHeadline(container) {
      const headlineElement = container.querySelector(this.newConversationSelectors.headlineContainer);
      return headlineElement ? headlineElement.textContent.trim() : null;
    },

    // New conversation recipient detection
    async detectNewConversationRecipient(attempt = 0) {
      debugLog(`🔍 Starting new conversation recipient detection (attempt ${attempt + 1}/${this.retryConfig.maxAttempts})`);
      
      try {
        const container = document.querySelector(this.newConversationSelectors.container);
        
        if (!container && attempt < this.retryConfig.maxAttempts - 1) {
          debugLog(`⏳ New conversation container not found, waiting ${this.retryConfig.delayMs}ms before retry...`);
          await this.wait(this.retryConfig.delayMs);
          return this.detectNewConversationRecipient(attempt + 1);
        }

        if (container) {
          const name = this.extractNewRecipientName(container);
          const headline = this.extractNewRecipientHeadline(container);
          
          debugLog('🔍 Found new conversation recipient elements:', { name, headline });

          if (name && headline) {
            debugLog('✅ New conversation recipient found:', { name, headline });
            this.updateInternalState(name, headline, 'NEW');
            this.emitRecipientUpdate(name, headline, 'NEW');
            return this.currentRecipient;
          }
        }

        debugLog('❌ No recipient found in new conversation');
        return null;
      } catch (error) {
        debugLog('❌ Error detecting new conversation recipient:', error.message);
        return null;
      }
    },

    // Main detection method with retry logic
    async detectRecipient(attempt = 0) {
      const detectionId = Date.now();
      debugLog(`🔍 Starting recipient detection (attempt ${attempt + 1}/${this.retryConfig.maxAttempts})`);
      
      try {
        // Check conversation type first
        if (window.ConversationDetector) {
          const conversationType = window.ConversationDetector.detectConversationType();
          debugLog('🔍 Conversation type detected:', { type: conversationType });

          // If it's a new conversation, use new detection method
          if (conversationType === 'NEW') {
            debugLog('✨ New conversation detected, using new conversation detection');
            return this.detectNewConversationRecipient(attempt);
          }
        }

        const nameSelector = '.msg-entity-lockup__entity-title';
        const headlineSelector = '.msg-entity-lockup__entity-info';
        
        debugLog('🔍 Looking for elements:', { nameSelector, headlineSelector });
        
        const nameElement = document.querySelector(nameSelector);
        const headlineElement = document.querySelector(headlineSelector);
        
        debugLog('🔍 Elements found:', { 
          hasNameElement: !!nameElement, 
          hasHeadlineElement: !!headlineElement,
          nameText: nameElement?.textContent?.trim(),
          headlineExists: !!headlineElement
        });
        
        // If elements not found and we haven't exceeded max attempts, retry
        if (!nameElement && attempt < this.retryConfig.maxAttempts - 1) {
          debugLog(`⏳ Elements not found, waiting ${this.retryConfig.delayMs}ms before retry...`);
          await this.wait(this.retryConfig.delayMs);
          return this.detectRecipient(attempt + 1);
        }
        
        if (nameElement) {
          // Extract name and headline
          const name = nameElement.textContent.trim();
          const headline = this.extractHeadlineText(headlineElement);
          
          debugLog('✅ Recipient found:', { name, headline });
          
          // Update internal state with ONGOING type
          this.updateInternalState(name, headline, 'ONGOING');
          
          // Emit event for any listeners
          this.emitRecipientUpdate(name, headline, 'ONGOING');
          
          return this.currentRecipient;
        } else {
          debugLog('❌ No recipient found after all attempts');
          this.clearRecipient();
        }
      } catch (error) {
        debugLog('❌ Error detecting recipient:', error.message);
        this.clearRecipient();
      }
      
      return null;
    },

    // Update internal state
    updateInternalState(name, headline, conversationType = null) {
      debugLog('Updating internal state:', { name, headline, conversationType });
      this.currentRecipient = {
        name,
        headline,
        conversationType,
        lastDetected: new Date().toISOString()
      };
      
      // Also update RecipientStorage if available
      if (window.RecipientStorage) {
        window.RecipientStorage.updateRecipient(name, headline, conversationType);
      } else {
        debugLog('Warning: RecipientStorage not available');
      }
    },

    // Emit recipient update event
    emitRecipientUpdate(name, headline, conversationType = null) {
      debugLog('Emitting recipient update event');
      const event = new CustomEvent('recipientDetected', {
        detail: { name, headline, conversationType }
      });
      document.dispatchEvent(event);
      debugLog('Event emitted successfully');
    },

    // Clear recipient data
    clearRecipient() {
      debugLog('Clearing recipient data');
      this.currentRecipient = {
        name: null,
        headline: null,
        conversationType: null,
        lastDetected: null
      };
      
      // Clear RecipientStorage as well
      if (window.RecipientStorage) {
        window.RecipientStorage.clearRecipient();
      } else {
        debugLog('Warning: RecipientStorage not available for clearing');
      }
      
      // Emit clear event
      const event = new CustomEvent('recipientCleared');
      document.dispatchEvent(event);
    },

    // Check if we have valid recipient data
    hasValidRecipient() {
      return Boolean(this.currentRecipient.name);
    },

    // Verify detector is working
    verifyDetector() {
      console.log('[Verification] RecipientDetector state:', {
        isOnMessagingPage: this.isMessagingPage(),
        currentRecipient: this.currentRecipient,
        hasObserver: !!this.observer,
        selectors: {
          nameFound: !!document.querySelector('.msg-entity-lockup__entity-title'),
          headlineFound: !!document.querySelector('.msg-entity-lockup__entity-info')
        }
      });

      // Test detection immediately
      if (this.isMessagingPage()) {
        console.log('[Verification] Testing detection on current page...');
        this.detectRecipient().then(result => {
          console.log('[Verification] Detection test result:', {
            success: !!result,
            detectedData: result
          });
        });
      }
    },

    // Cleanup method for observer
    cleanup() {
      if (this.observer) {
        debugLog('Cleaning up URL observer');
        this.observer.disconnect();
        this.observer = null;
      }
    }
  };

  // Export for use in other files
  window.RecipientDetector = RecipientDetector;
  debugLog('✅ RecipientDetector exported to window');

  // Initialize immediately when on a messaging page
  if (document.readyState === 'loading') {
    debugLog('📝 Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
      debugLog('📝 DOMContentLoaded, initializing RecipientDetector');
      RecipientDetector.initialize();
    });
  } else {
    debugLog('📝 Document already loaded, initializing RecipientDetector immediately');
    RecipientDetector.initialize();
  }
}

// Handle cleanup on page unload
window.addEventListener('unload', () => {
  debugLog('🧹 Page unloading, cleaning up RecipientDetector');
  RecipientDetector.cleanup();
}); 