// Set test environment flag
window.isTestEnvironment = true;

// Test runner function
async function runStorageManagerTests() {
  if (!window.isTestEnvironment) {
    console.warn('Tests can only run in test environment');
    return;
  }

  console.log('=== Starting Storage Manager Tests ===');
  
  try {
    // Reset state before tests
    await StorageManagerTest.resetTestState();
    
    await this.testBasicOperations();
    await this.testRetryOnFailure();
    await this.testValidationWithRetry();
    console.log('✅ All Storage Manager tests completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up after tests
    await StorageManagerTest.clearAllData();
  }
}

// Only export in test environment
if (window.isTestEnvironment) {
  window.runStorageManagerTests = runStorageManagerTests;
}

// Storage Manager Test Suite
const StorageManagerTests = {
  async runTests() {
    console.log('=== Starting Storage Manager Tests ===');
    
    try {
      await this.testBasicOperations();
      await this.testRetryOnFailure();
      await this.testValidationWithRetry();
      console.log('✅ All Storage Manager tests completed successfully');
    } catch (error) {
      console.error('❌ Storage Manager test suite failed:', error);
    }
  },

  async testBasicOperations() {
    console.log('\n🔍 Testing Basic Storage Operations');
    try {
      // Test data
      const testProfile = {
        name: 'Test User',
        headline: 'Test Headline',
        currentRole: 'Test Role',
        company: 'Test Company'
      };

      // Test save operation
      console.log('Testing save operation...');
      const saveResult = await StorageManager.saveProfile(testProfile);
      if (!saveResult) {
        throw new Error('Save operation failed');
      }
      console.log('✅ Save operation successful');

      // Test load operation
      console.log('Testing load operation...');
      const loadedProfile = await StorageManager.loadProfile();
      if (!loadedProfile || loadedProfile.name !== testProfile.name) {
        throw new Error('Load operation failed or data mismatch');
      }
      console.log('✅ Load operation successful');

      // Test validation
      console.log('Testing profile validation...');
      const isValid = await StorageManager.hasValidProfile();
      if (!isValid) {
        throw new Error('Profile validation failed');
      }
      console.log('✅ Validation successful');

      // Test clear operation
      console.log('Testing clear operation...');
      const clearResult = await StorageManager.clearProfile();
      if (!clearResult) {
        throw new Error('Clear operation failed');
      }
      console.log('✅ Clear operation successful');

      console.log('✅ Basic operations test passed');
    } catch (error) {
      throw new Error(`Basic operations test failed: ${error.message}`);
    }
  },

  async testRetryOnFailure() {
    console.log('\n🔍 Testing Retry on Failure');
    try {
      // Create a temporary error condition
      const originalSet = chrome.storage.local.set;
      let attempts = 0;
      
      // Mock storage.set to fail twice then succeed
      chrome.storage.local.set = async function(data) {
        attempts++;
        if (attempts < 3) {
          throw new Error('Simulated storage failure');
        }
        // Restore original after test
        chrome.storage.local.set = originalSet;
        return originalSet.call(chrome.storage.local, data);
      };

      // Test profile data
      const testProfile = {
        name: 'Retry Test User',
        headline: 'Retry Test Headline',
        currentRole: 'Retry Test Role',
        company: 'Retry Test Company'
      };

      // Attempt save operation (should retry twice then succeed)
      console.log('Testing retry on save operation...');
      const saveResult = await StorageManager.saveProfile(testProfile);
      
      if (!saveResult || attempts !== 3) {
        throw new Error(`Expected 3 attempts but got ${attempts}`);
      }
      
      console.log('✅ Retry mechanism test passed');
    } catch (error) {
      // Ensure we restore original function even if test fails
      if (chrome.storage.local.set.name === 'set') {
        chrome.storage.local.set = chrome.storage.local.set;
      }
      throw new Error(`Retry test failed: ${error.message}`);
    }
  },

  async testValidationWithRetry() {
    console.log('\n🔍 Testing Validation with Retry');
    try {
      // Test with invalid data first
      const invalidProfile = {
        name: 'Test User',
        // Missing required fields
      };

      await StorageManager.saveProfile(invalidProfile);
      const isValidInvalid = await StorageManager.hasValidProfile();
      
      if (isValidInvalid) {
        throw new Error('Validation should fail for invalid profile');
      }
      
      // Test with valid data
      const validProfile = {
        name: 'Test User',
        headline: 'Test Headline',
        currentRole: 'Test Role',
        company: 'Test Company'
      };

      await StorageManager.saveProfile(validProfile);
      const isValidValid = await StorageManager.hasValidProfile();
      
      if (!isValidValid) {
        throw new Error('Validation should pass for valid profile');
      }

      console.log('✅ Validation with retry test passed');
    } catch (error) {
      throw new Error(`Validation test failed: ${error.message}`);
    }
  }
};

// Export for manual testing
window.StorageManagerTests = StorageManagerTests; 