// Debug mode flag
const STORAGE_MANAGER_DEBUG = true;

// Utility function for logging
function debugLog(...args) {
  if (!STORAGE_MANAGER_DEBUG) return;
  console.log('[Storage]', ...args);
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
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          const dataToStore = {
            ...profileData,
            lastUpdated: new Date().toISOString(),
            version: STORAGE_KEYS.VERSION
          };

          debugLog('Saving profile data:', dataToStore);
          
          await chrome.storage.local.set({
            [STORAGE_KEYS.PROFILE]: dataToStore
          });
          
          debugLog('Profile data saved successfully');
          return true;
        } catch (error) {
          debugLog('Error saving profile:', error);
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
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          debugLog('Loading profile data');
          
          const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
          const profileData = result[STORAGE_KEYS.PROFILE];
          
          if (!profileData) {
            debugLog('No stored profile data found');
            return null;
          }

          debugLog('Profile data loaded:', profileData);
          return profileData;
        } catch (error) {
          debugLog('Error loading profile:', error);
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
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          debugLog('Clearing profile data');
          
          await chrome.storage.local.remove(STORAGE_KEYS.PROFILE);
          
          debugLog('Profile data cleared successfully');
          return true;
        } catch (error) {
          debugLog('Error clearing profile:', error);
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
    return ErrorRecovery.retryOperation(
      async () => {
        try {
          const profileData = await this.loadProfile();
          
          if (!profileData) {
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

          debugLog('Profile validation:', {
            exists: !!profileData,
            isValid,
            version: profileData.version
          });

          return isValid;
        } catch (error) {
          debugLog('Error checking profile validity:', error);
          return false;
        }
      },
      'storage-validate-profile'
    );
  }
};

// Export the storage manager
window.StorageManager = StorageManager; 