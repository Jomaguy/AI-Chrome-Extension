// Debug mode flag
window.RECIPIENT_DEBUG = true;

// Debug logging utility with timestamps
function debugLog(...args) {
  if (!window.RECIPIENT_DEBUG) return;
  const timestamp = new Date().toISOString();
  const prefix = `[Recipient ${timestamp}]`;
  console.log(prefix, ...args);
}

// DOM state check utility
function logDOMState() {
  debugLog('DOM State Check:', {
    readyState: document.readyState,
    hasMessagingContainer: !!document.querySelector('.msg-messaging-container'),
    hasEntityLockup: !!document.querySelector('.msg-entity-lockup'),
    hasEntityInfo: !!document.querySelector('.msg-entity-lockup__entity-info'),
    hasEntityTitle: !!document.querySelector('.msg-entity-lockup__entity-title')
  });
}

const RecipientDetector = {
  // Current recipient data
  currentRecipient: {
    name: null,
    headline: null,
    lastDetected: null
  },

  // Retry configuration
  retryConfig: {
    maxAttempts: 5,
    delayMs: 1000
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
    const isMessaging = window.location.href.includes('linkedin.com/messaging');
    debugLog('Checking if messaging page:', {
      currentURL: window.location.href,
      isMessaging,
      pathname: window.location.pathname
    });
    return isMessaging;
  },

  // Extract headline text while handling presence status
  extractHeadlineText(headlineElement) {
    if (!headlineElement) {
      debugLog('No headline element provided');
      return null;
    }

    debugLog('Extracting headline from element:', {
      elementHTML: headlineElement.outerHTML,
      elementClasses: headlineElement.className,
      childNodeCount: headlineElement.childNodes.length
    });

    // First try to get text from presence status div if it exists
    const presenceStatus = headlineElement.querySelector('.msg-entity-lockup__presence-status');
    if (presenceStatus) {
      debugLog('Found presence status element:', {
        presenceHTML: presenceStatus.outerHTML,
        presenceClasses: presenceStatus.className
      });

      // Get all text nodes from the presence status div
      const textNodes = this.getAllTextNodes(presenceStatus);
      debugLog('Text nodes from presence status:', textNodes);

      // Filter out any nodes that contain status information
      const filteredNodes = textNodes.filter(text => !text.toLowerCase().includes('status'));
      
      if (filteredNodes.length > 0) {
        const headline = filteredNodes[filteredNodes.length - 1];
        debugLog('Found headline from presence status:', headline);
        return headline;
      }
    }

    // If no presence status or no valid headline found, get all text nodes from the main element
    const allTextNodes = this.getAllTextNodes(headlineElement);
    debugLog('All text nodes from headline element:', allTextNodes);

    // Filter out status-related text and empty strings
    const filteredNodes = allTextNodes.filter(text => 
      !text.toLowerCase().includes('status') && 
      text.length > 0
    );

    if (filteredNodes.length > 0) {
      // Join all remaining text nodes, in case the headline is split
      const headline = filteredNodes.join(' ').trim();
      debugLog('Found headline from main element:', headline);
      return headline;
    }

    debugLog('No valid headline found');
    return null;
  },

  // Main detection method with retry logic
  async detectRecipient(attempt = 0) {
    debugLog(`Attempting to detect recipient (attempt ${attempt + 1}/${this.retryConfig.maxAttempts})`);
    logDOMState();
    
    try {
      // Updated LinkedIn messaging selectors
      const nameSelector = '.msg-entity-lockup__entity-title';
      const headlineSelector = '.msg-entity-lockup__entity-info';
      
      debugLog('Looking for elements with selectors:', { 
        nameSelector, 
        headlineSelector,
        isMessagingPage: this.isMessagingPage()
      });
      
      const nameElement = document.querySelector(nameSelector);
      const headlineElement = document.querySelector(headlineSelector);
      
      debugLog('Elements found:', { 
        nameFound: !!nameElement, 
        headlineFound: !!headlineElement,
        nameElementHTML: nameElement?.outerHTML,
        headlineElementHTML: headlineElement?.outerHTML
      });
      
      // If elements not found and we haven't exceeded max attempts, retry
      if (!nameElement && attempt < this.retryConfig.maxAttempts - 1) {
        debugLog(`Elements not found, retrying in ${this.retryConfig.delayMs}ms...`);
        await this.wait(this.retryConfig.delayMs);
        return this.detectRecipient(attempt + 1);
      }
      
      if (nameElement) {
        // Extract name
        const name = nameElement.textContent.trim();
        debugLog('Extracted name:', name);
        this.currentRecipient.name = name;
        
        // Extract headline using the new extraction method
        const headline = this.extractHeadlineText(headlineElement);
        debugLog('Extracted headline:', headline);
        this.currentRecipient.headline = headline;
        
        this.currentRecipient.lastDetected = new Date().toISOString();
        
        debugLog('Recipient detected:', {
          name: this.currentRecipient.name,
          headline: this.currentRecipient.headline,
          timestamp: this.currentRecipient.lastDetected,
          attempt: attempt + 1
        });
        
        return this.currentRecipient;
      } else {
        debugLog('No recipient found after all attempts');
        this.clearRecipient();
      }
    } catch (error) {
      debugLog('Error detecting recipient:', {
        error: error.message,
        stack: error.stack,
        attempt: attempt + 1
      });
      this.clearRecipient();
    }
    
    return null;
  },

  // Clear recipient data
  clearRecipient() {
    debugLog('Clearing recipient data');
    this.currentRecipient = {
      name: null,
      headline: null,
      lastDetected: null
    };
  },

  // Check if we have valid recipient data
  hasValidRecipient() {
    const hasRecipient = Boolean(this.currentRecipient.name);
    debugLog('Checking if has valid recipient:', {
      hasRecipient,
      currentRecipient: this.currentRecipient
    });
    return hasRecipient;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecipientDetector;
} 