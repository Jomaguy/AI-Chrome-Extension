// Error Recovery Test Suite
const ErrorRecoveryTests = {
  async runTests() {
    console.log('=== Starting Error Recovery Tests ===');
    
    try {
      await this.testDebugLogging();
      await this.testErrorHandling();
      await this.testRetryOperation();
      console.log('✅ All tests completed successfully');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  },

  async testDebugLogging() {
    console.log('\n🔍 Testing Debug Logging');
    try {
      ErrorRecovery.debugLog('Test debug message');
      console.log('✅ Debug logging test passed');
    } catch (error) {
      throw new Error(`Debug logging test failed: ${error.message}`);
    }
  },

  async testErrorHandling() {
    console.log('\n🔍 Testing Error Handling');
    try {
      ErrorRecovery.ErrorHandler.init();
      const result = ErrorRecovery.ErrorHandler.handleError(
        new Error('test network error'),
        'test-context'
      );
      
      // Verify error classification
      if (result.type !== ErrorRecovery.StorageErrors.NETWORK_ERROR) {
        throw new Error(`Expected NETWORK_ERROR but got ${result.type}`);
      }
      
      // Verify retry decision
      if (!result.shouldRetry) {
        throw new Error('Expected shouldRetry to be true for network error');
      }
      
      console.log('✅ Error handling test passed');
    } catch (error) {
      throw new Error(`Error handling test failed: ${error.message}`);
    }
  },

  async testRetryOperation() {
    console.log('\n🔍 Testing Retry Operation');
    try {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('test retry error');
        }
        return 'success';
      };

      const result = await ErrorRecovery.retryOperation(
        operation,
        'retry-test'
      );

      if (result !== 'success') {
        throw new Error(`Expected 'success' but got ${result}`);
      }

      if (attempts !== 3) {
        throw new Error(`Expected 3 attempts but got ${attempts}`);
      }

      console.log('✅ Retry operation test passed');
    } catch (error) {
      throw new Error(`Retry operation test failed: ${error.message}`);
    }
  }
};

// Auto-run tests when in development mode
if (ErrorRecovery.Config.debug) {
  setTimeout(() => {
    ErrorRecoveryTests.runTests();
  }, 1000); // Small delay to ensure ErrorRecovery is fully initialized
}

// Export for manual testing
window.ErrorRecoveryTests = ErrorRecoveryTests; 