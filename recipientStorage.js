// Debug mode flag
window.RECIPIENT_STORAGE_DEBUG = true;

// Debug logging utility
function debugLog(...args) {
  if (!window.RECIPIENT_STORAGE_DEBUG) return;
  console.log('[Debug][RecipientStorage]', ...args);
}

// Log initialization
debugLog('Initializing RecipientStorage');

const RecipientStorage = {
  // Current recipient data
  currentRecipient: {
    name: null,
    headline: null,
    lastUpdated: null
  },

  // Initialize event listeners
  initialize() {
    debugLog('Setting up event listeners');
    
    // Listen for recipient detected events
    document.addEventListener('recipientDetected', (event) => {
      debugLog('Received recipientDetected event');
      const { name, headline } = event.detail;
      this.updateRecipient(name, headline);
    });

    // Listen for recipient cleared events
    document.addEventListener('recipientCleared', () => {
      debugLog('Received recipientCleared event');
      this.clearRecipient();
    });
    
    debugLog('Event listeners set up successfully');
  },

  // Update recipient data
  updateRecipient(name, headline) {
    debugLog('📝 Updating recipient:', { 
      previous: { ...this.currentRecipient },
      new: { name, headline }
    });
    this.currentRecipient = {
      name,
      headline,
      lastUpdated: new Date().toISOString()
    };
    debugLog('✅ Recipient updated successfully');
  },

  // Get current recipient
  getRecipient() {
    debugLog('📖 Getting current recipient:', this.currentRecipient);
    return this.currentRecipient;
  },

  // Clear recipient data
  clearRecipient() {
    debugLog('🗑️ Clearing recipient data');
    const previousState = { ...this.currentRecipient };
    this.currentRecipient = {
      name: null,
      headline: null,
      lastUpdated: null
    };
    debugLog('✨ Recipient data cleared. Previous state:', previousState);
  },

  // Test method to verify storage is working
  verifyStorage() {
    debugLog('🔍 Storage verification:', {
      hasData: this.currentRecipient.name !== null,
      currentState: this.currentRecipient,
      timestamp: new Date().toISOString()
    });
    return this.currentRecipient;
  }
};

// Export for use in other files
window.RecipientStorage = RecipientStorage;
debugLog('✅ RecipientStorage initialized and exported to window');

// Initialize event listeners
RecipientStorage.initialize();
debugLog('✅ RecipientStorage event listeners initialized'); 