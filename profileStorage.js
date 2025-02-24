// Debug mode flag
const STORAGE_DEBUG = true;

// Debug logging utility
function debugLog(...args) {
  if (!STORAGE_DEBUG) return;
  
  const [message, ...rest] = args;
  const prefix = '[ProfileStorage]';
  
  console.log(prefix, message, ...(rest.length ? rest : []));
}

class ProfileStorage {
  constructor() {
    this.profileData = {
      name: null,
      headline: null,
      currentRole: null,
      company: null,
      lastUpdated: null
    };

    this.isValid = false;
    debugLog('ProfileStorage initialized');
  }

  // Update profile data
  updateProfile(newData) {
    try {
      debugLog('Updating profile data:', newData);
      
      // Update only provided fields
      Object.keys(newData).forEach(key => {
        if (key in this.profileData && newData[key] !== undefined) {
          this.profileData[key] = newData[key];
        }
      });

      this.profileData.lastUpdated = new Date().toISOString();
      this.validateProfile();

      debugLog('Profile updated:', this.profileData);
      return true;
    } catch (error) {
      debugLog('Error updating profile:', error);
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