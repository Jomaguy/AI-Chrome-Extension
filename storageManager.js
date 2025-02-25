// Environment detection - browser-safe check
const isTestEnvironment = () => {
  try {
    return window.isTestEnvironment === true;
  } catch (e) {
    return false;
  }
};

// Debug mode flag - disabled for production
const STORAGE_MANAGER_DEBUG = false;

// Enhanced logging utility with operation tracking
function debugLog(...args) {
  if (!STORAGE_MANAGER_DEBUG) return;
  const timestamp = new Date().toISOString();
  console.log('[Storage]', `(${timestamp})`, ...args);
}

// Storage keys
const STORAGE_KEYS = {
  PROFILE: 'linkedInProfile',
  VERSION: '1.0'
};

// Storage interface for LinkedIn profile data
const StorageManager = {
  /**
   * Save profile data to Chrome storage
   * @param {Object} profileData - Profile data to store
   * @returns {Promise} - Resolves when data is stored
   */
  saveProfile: async function(profileData) {
    debugLog('saveProfile called with:', profileData);
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          const dataToStore = {
            ...profileData,
            lastUpdated: new Date().toISOString(),
            version: STORAGE_KEYS.VERSION
          };

          debugLog('Attempting to save profile data:', dataToStore);
          
          await chrome.storage.local.set({
            [STORAGE_KEYS.PROFILE]: dataToStore
          });
          
          debugLog('Profile data saved successfully to chrome.storage.local');
          return true;
        } catch (error) {
          debugLog('Error in saveProfile:', error.message, error.stack);
          throw error;
        }
      },
      'storage-save-profile'
    );
  },

  /**
   * Load profile data from Chrome storage
   * @returns {Promise<Object|null>} - Resolves with profile data or null if not found
   */
  loadProfile: async function() {
    debugLog('loadProfile called');
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          debugLog('Attempting to load profile data from chrome.storage.local');
          
          const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
          const profileData = result[STORAGE_KEYS.PROFILE];
          
          if (!profileData) {
            debugLog('No profile data found in storage');
            return null;
          }

          debugLog('Successfully loaded profile data:', profileData);
          return profileData;
        } catch (error) {
          debugLog('Error in loadProfile:', error.message, error.stack);
          throw error;
        }
      },
      'storage-load-profile'
    );
  },

  /**
   * Clear stored profile data
   * @returns {Promise} - Resolves when data is cleared
   */
  clearProfile: async function() {
    debugLog('clearProfile called');
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          debugLog('Attempting to clear profile data');
          
          await chrome.storage.local.remove(STORAGE_KEYS.PROFILE);
          
          debugLog('Profile data cleared successfully');
          return true;
        } catch (error) {
          debugLog('Error in clearProfile:', error.message, error.stack);
          throw error;
        }
      },
      'storage-clear-profile'
    );
  },

  /**
   * Check if stored profile data exists and is valid
   * @returns {Promise<boolean>} - Resolves with true if valid profile exists
   */
  hasValidProfile: async function() {
    debugLog('hasValidProfile called');
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          const profileData = await this.loadProfile();
          
          if (!profileData) {
            debugLog('No profile data found during validation');
            return false;
          }

          const isValid = (
            profileData.version === STORAGE_KEYS.VERSION &&
            profileData.name &&
            profileData.headline &&
            profileData.currentRole &&
            profileData.company &&
            profileData.lastUpdated
          );

          debugLog('Profile validation result:', {
            exists: true,
            isValid,
            version: profileData.version
          });

          return isValid;
        } catch (error) {
          debugLog('Error in hasValidProfile:', error.message, error.stack);
          return false;
        }
      },
      'storage-validate-profile'
    );
  }
};

// Export the storage manager
debugLog('Exporting StorageManager to window');
window.StorageManager = StorageManager;

// Only expose test utilities in test environment
if (isTestEnvironment()) {
  debugLog('Test environment detected, exposing test utilities');
  window.StorageManagerTest = {
    clearAllData: async () => {
      await StorageManager.clearProfile();
    },
    resetTestState: async () => {
      await StorageManager.clearProfile();
    }
  };
} 