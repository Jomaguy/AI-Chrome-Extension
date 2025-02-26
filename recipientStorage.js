// Debug mode flag
window.RECIPIENT_STORAGE_DEBUG = true;

// Debug logging utility with timestamps
function debugLog(...args) {
  if (!window.RECIPIENT_STORAGE_DEBUG) return;
  const timestamp = new Date().toISOString();
  const prefix = `[RecipientStorage ${timestamp}]`;
  console.log(prefix, ...args);
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
    debugLog('🚀 Initializing RecipientStorage...');
    
    // Listen for recipient detected events
    document.addEventListener('recipientDetected', (event) => {
      debugLog('📥 Received recipientDetected event:', event.detail);
      const { name, headline } = event.detail;
      this.updateRecipient(name, headline);
    });

    // Listen for recipient cleared events
    document.addEventListener('recipientCleared', () => {
      debugLog('🗑️ Received recipientCleared event');
      this.clearRecipient();
    });
    
    debugLog('✅ Event listeners set up successfully');
    debugLog('Current state:', this.currentRecipient);
  },

  // Update recipient data
  updateRecipient(name, headline) {
    debugLog('📝 Updating recipient data');
    debugLog('Previous state:', { ...this.currentRecipient });
    debugLog('New data:', { name, headline });
    
    this.currentRecipient = {
      name,
      headline,
      lastUpdated: new Date().toISOString()
    };
    
    debugLog('✅ Recipient updated successfully');
    debugLog('Current state:', this.currentRecipient);
  },

  // Get current recipient
  getRecipient() {
    debugLog('📖 Getting current recipient');
    debugLog('Current state:', this.currentRecipient);
    return this.currentRecipient;
  },

  // Clear recipient data
  clearRecipient() {
    debugLog('🗑️ Clearing recipient data');
    debugLog('Previous state:', { ...this.currentRecipient });
    
    this.currentRecipient = {
      name: null,
      headline: null,
      lastUpdated: null
    };
    
    debugLog('✅ Recipient data cleared');
    debugLog('Current state:', this.currentRecipient);
  },

  // Verify storage is working
  verifyStorage() {
    debugLog('🔍 Running storage verification');
    debugLog('Has recipient data:', this.currentRecipient.name !== null);
    debugLog('Current state:', this.currentRecipient);
    debugLog('Last updated:', this.currentRecipient.lastUpdated);
    return this.currentRecipient;
  }
};

// Export for use in other files
window.RecipientStorage = RecipientStorage;
debugLog('✅ RecipientStorage exported to window');

// Initialize immediately
RecipientStorage.initialize();
debugLog('✅ RecipientStorage initialization complete'); 