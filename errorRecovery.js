// Debug mode flag
const ERROR_RECOVERY_DEBUG = true;

// Debug logging utility
function debugLog(...args) {
  if (!ERROR_RECOVERY_DEBUG) return;
  console.log('[ErrorRecovery]', ...args);
}

// Error Types
const StorageErrors = {
  QUOTA_EXCEEDED: 'QuotaExceededError',
  INVALID_DATA: 'InvalidDataError',
  API_ERROR: 'StorageAPIError',
  NETWORK_ERROR: 'NetworkError',
  TIMEOUT_ERROR: 'TimeoutError'
};

// Configuration
const Config = {
  debug: true,
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms
  maxDelay: 5000,   // Maximum delay in ms
  timeout: 5000,    // Operation timeout
  backoffFactor: 2  // Exponential backoff multiplier
};

// Error Handler
const ErrorHandler = {
  init() {
    debugLog('Error Handler Initialized');
    this.lastError = null;
    this.errorCount = 0;
  },
  
  handleError(error, context) {
    this.lastError = error;
    this.errorCount++;
    
    debugLog('Error occurred:', { 
      error, 
      context,
      count: this.errorCount 
    });

    return {
      type: this.classifyError(error),
      shouldRetry: this.shouldRetryError(error),
      context,
      timestamp: new Date().toISOString()
    };
  },

  classifyError(error) {
    // Check for specific error types
    if (error.name === 'QuotaExceededError') return StorageErrors.QUOTA_EXCEEDED;
    if (error.message?.includes('timeout')) return StorageErrors.TIMEOUT_ERROR;
    if (error.message?.includes('network')) return StorageErrors.NETWORK_ERROR;
    if (error.message?.includes('invalid') || error.message?.includes('format')) return StorageErrors.INVALID_DATA;
    
    // Default to API error
    return StorageErrors.API_ERROR;
  },

  shouldRetryError(error) {
    const errorType = this.classifyError(error);
    
    // Define which errors should not be retried
    const nonRetryableErrors = [
      StorageErrors.QUOTA_EXCEEDED,
      StorageErrors.INVALID_DATA
    ];

    return !nonRetryableErrors.includes(errorType);
  },

  getErrorStats() {
    return {
      lastError: this.lastError,
      errorCount: this.errorCount,
      timestamp: new Date().toISOString()
    };
  },

  reset() {
    this.lastError = null;
    this.errorCount = 0;
    debugLog('Error handler reset');
  }
};

// Retry logic with exponential backoff
async function retryOperation(operation, context = 'unknown', attempt = 1) {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = ErrorHandler.handleError(error, context);
    
    // Check if we should retry
    if (!errorInfo.shouldRetry || attempt >= Config.maxRetries) {
      debugLog('Will not retry operation:', {
        context,
        attempt,
        shouldRetry: errorInfo.shouldRetry,
        error: error.message
      });
      throw error;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      Config.retryDelay * Math.pow(Config.backoffFactor, attempt - 1),
      Config.maxDelay
    );

    debugLog('Retrying operation:', {
      context,
      attempt,
      delay,
      nextAttempt: attempt + 1
    });

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Recursive retry
    return retryOperation(operation, context, attempt + 1);
  }
}

// Export the module
window.ErrorRecovery = {
  Config,
  StorageErrors,
  ErrorHandler,
  debugLog,
  retryOperation
}; 