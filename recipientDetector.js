// Debug mode flag
window.RECIPIENT_DEBUG = true;

// Debug logging utility with timestamps
function debugLog(...args) {
  if (!window.RECIPIENT_DEBUG) return;
  const timestamp = new Date().toISOString();
  const prefix = `[Recipient ${timestamp}]`;
  console.log(prefix, ...args);
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

  // Main detection method with retry logic
  async detectRecipient(attempt = 0) {
    debugLog(`Attempting to detect recipient (attempt ${attempt + 1}/${this.retryConfig.maxAttempts})`);
    
    try {
      const nameSelector = '.msg-entity-lockup__entity-title';
      const headlineSelector = '.msg-entity-lockup__entity-info';
      
      const nameElement = document.querySelector(nameSelector);
      const headlineElement = document.querySelector(headlineSelector);
      
      // If elements not found and we haven't exceeded max attempts, retry
      if (!nameElement && attempt < this.retryConfig.maxAttempts - 1) {
        await this.wait(this.retryConfig.delayMs);
        return this.detectRecipient(attempt + 1);
      }
      
      if (nameElement) {
        // Extract name
        const name = nameElement.textContent.trim();
        this.currentRecipient.name = name;
        
        // Extract headline
        const headline = this.extractHeadlineText(headlineElement);
        this.currentRecipient.headline = headline;
        
        this.currentRecipient.lastDetected = new Date().toISOString();
        
        debugLog('Recipient detected:', this.currentRecipient);
        
        return this.currentRecipient;
      } else {
        debugLog('No recipient found after all attempts');
        this.clearRecipient();
      }
    } catch (error) {
      debugLog('Error detecting recipient:', error.message);
      this.clearRecipient();
    }
    
    return null;
  },

  // Clear recipient data
  clearRecipient() {
    this.currentRecipient = {
      name: null,
      headline: null,
      lastDetected: null
    };
  },

  // Check if we have valid recipient data
  hasValidRecipient() {
    return Boolean(this.currentRecipient.name);
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecipientDetector;
} 