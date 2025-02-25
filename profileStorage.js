// Debug mode flag - disabled for production
const PROFILE_STORAGE_DEBUG = false;

// Debug logging utility with more detailed information
function debugLog(...args) {
  if (!PROFILE_STORAGE_DEBUG) return;
  
  const [message, ...rest] = args;
  const prefix = '[ProfileStorage]';
  const timestamp = new Date().toISOString();
  
  console.log(prefix, `(${timestamp})`, message, ...(rest.length ? rest : []));
}

class ProfileStorage {
  constructor() {
    debugLog('Starting ProfileStorage initialization');
    
    this.profileData = {
      name: null,
      headline: null,
      currentRole: null,
      company: null,
      lastUpdated: null
    };

    this.isValid = false;
    debugLog('ProfileStorage base state initialized');

    // Check StorageManager availability
    const hasStorageManager = typeof window.StorageManager !== 'undefined';
    debugLog('StorageManager availability check:', { available: hasStorageManager });

    if (!hasStorageManager) {
      debugLog('Warning: StorageManager not available, initiating wait sequence');
      this.waitForStorageManager();
    } else {
      debugLog('StorageManager available, proceeding with storage load');
      this.loadFromStorage();
    }
  }

  // Wait for StorageManager to be available
  async waitForStorageManager() {
    const maxAttempts = 5;
    let attempts = 0;
    
    debugLog('Starting StorageManager availability check sequence');
    
    const checkStorageManager = () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const hasStorageManager = typeof window.StorageManager !== 'undefined';
          debugLog('Checking StorageManager availability:', { 
            attempt: attempts + 1, 
            maxAttempts,
            available: hasStorageManager 
          });

          if (hasStorageManager) {
            debugLog('StorageManager now available, proceeding with storage load');
            this.loadFromStorage();
            resolve(true);
          } else if (attempts < maxAttempts) {
            attempts++;
            debugLog(`Waiting for StorageManager... Attempt ${attempts}/${maxAttempts}`);
            checkStorageManager().then(resolve);
          } else {
            debugLog('StorageManager not available after maximum attempts, initialization may be incomplete');
            resolve(false);
          }
        }, 500);
      });
    };

    return checkStorageManager();
  }

  // Load profile data from storage
  async loadFromStorage() {
    try {
      debugLog('Initiating profile load from storage');
      
      if (typeof window.StorageManager === 'undefined') {
        throw new Error('StorageManager is still undefined during load attempt');
      }

      debugLog('Calling StorageManager.loadProfile()');
      const storedProfile = await StorageManager.loadProfile();
      
      if (storedProfile) {
        debugLog('Found stored profile, updating local state:', storedProfile);
        // Update profile data with stored values
        this.updateProfile({
          name: storedProfile.name,
          headline: storedProfile.headline,
          currentRole: storedProfile.currentRole,
          company: storedProfile.company
        });
      } else {
        debugLog('No stored profile found in storage');
      }
    } catch (error) {
      debugLog('Error loading from storage:', error.message, error.stack);
    }
  }

  // Update profile data
  async updateProfile(newData) {
    try {
      debugLog('Starting profile update process with new data:', newData);
      
      // Update only provided fields
      Object.keys(newData).forEach(key => {
        if (key in this.profileData && newData[key] !== undefined) {
          this.profileData[key] = newData[key];
        }
      });

      this.profileData.lastUpdated = new Date().toISOString();
      debugLog('In-memory profile data updated:', this.profileData);

      // Validate the updated profile
      const isValid = this.validateProfile();
      debugLog('Profile validation result:', { isValid, profile: this.profileData });

      if (isValid) {
        debugLog('Profile is valid, attempting to save to StorageManager');
        try {
          const saveResult = await StorageManager.saveProfile(this.profileData);
          debugLog('StorageManager save result:', saveResult);
        } catch (storageError) {
          debugLog('Error saving to StorageManager:', storageError.message);
          return false;
        }
      } else {
        debugLog('Profile is not valid, skipping save to StorageManager');
      }

      return true;
    } catch (error) {
      debugLog('Error in updateProfile:', error.message, error.stack);
      return false;
    }
  }

  // Get current profile data
  getProfile() {
    return {
      ...this.profileData,
      isValid: this.isValid
    };
  }

  // Clear profile data
  clearProfile() {
    this.profileData = {
      name: null,
      headline: null,
      currentRole: null,
      company: null,
      lastUpdated: null
    };
    this.isValid = false;
    debugLog('Profile data cleared');
  }

  // Validate profile data
  validateProfile() {
    const requiredFields = ['name', 'headline', 'currentRole', 'company'];
    const missingFields = requiredFields.filter(field => !this.profileData[field]);
    
    this.isValid = missingFields.length === 0;
    
    debugLog('Profile validation:', {
      isValid: this.isValid,
      missingFields
    });
    
    return this.isValid;
  }
}

// Create and export a single instance
const profileStorage = new ProfileStorage();
window.ProfileStorage = profileStorage; 