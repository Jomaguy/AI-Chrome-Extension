// Debug mode flag
const STORAGE_LAYER_DEBUG = true;

// Debug logging utility
function debugLog(...args) {
  if (!STORAGE_LAYER_DEBUG) return;
  console.log('[StorageLayer]', ...args);
}

// Storage layer configuration
const StorageLayers = {
  PRIMARY: 'chrome.storage.local',
  SECONDARY: 'localStorage',
  TERTIARY: 'sessionStorage'
};

// Storage layer status
const LayerStatus = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  FULL: 'full',
  ERROR: 'error'
};

// Storage layer manager
const StorageLayerManager = {
  // Track the health of each storage layer
  layerHealth: {
    [StorageLayers.PRIMARY]: LayerStatus.AVAILABLE,
    [StorageLayers.SECONDARY]: LayerStatus.AVAILABLE,
    [StorageLayers.TERTIARY]: LayerStatus.AVAILABLE
  },

  // Initialize storage layers
  async init() {
    debugLog('Initializing storage layers');
    await this.checkLayerHealth();
    debugLog('Storage layers health:', this.layerHealth);
  },

  // Check health of all storage layers
  async checkLayerHealth() {
    try {
      // Check chrome.storage.local
      await this.checkChromeStorage();
      
      // Check localStorage
      this.checkLocalStorage();
      
      // Check sessionStorage
      this.checkSessionStorage();
    } catch (error) {
      debugLog('Error checking layer health:', error);
    }
  },

  // Check chrome.storage.local availability and capacity
  async checkChromeStorage() {
    try {
      const testKey = '_test_chrome_storage';
      await chrome.storage.local.set({ [testKey]: true });
      await chrome.storage.local.remove(testKey);
      this.layerHealth[StorageLayers.PRIMARY] = LayerStatus.AVAILABLE;
    } catch (error) {
      debugLog('Chrome storage check failed:', error);
      this.layerHealth[StorageLayers.PRIMARY] = LayerStatus.ERROR;
    }
  },

  // Check localStorage availability and capacity
  checkLocalStorage() {
    try {
      const testKey = '_test_local_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.layerHealth[StorageLayers.SECONDARY] = LayerStatus.AVAILABLE;
    } catch (error) {
      debugLog('localStorage check failed:', error);
      this.layerHealth[StorageLayers.SECONDARY] = LayerStatus.ERROR;
    }
  },

  // Check sessionStorage availability and capacity
  checkSessionStorage() {
    try {
      const testKey = '_test_session_storage';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      this.layerHealth[StorageLayers.TERTIARY] = LayerStatus.AVAILABLE;
    } catch (error) {
      debugLog('sessionStorage check failed:', error);
      this.layerHealth[StorageLayers.TERTIARY] = LayerStatus.ERROR;
    }
  },

  // Save data with fallback
  async saveData(key, data) {
    debugLog('Attempting to save data:', { key, storageHealth: this.layerHealth });
    
    // Try PRIMARY storage
    if (this.layerHealth[StorageLayers.PRIMARY] === LayerStatus.AVAILABLE) {
      try {
        await chrome.storage.local.set({ [key]: data });
        debugLog('Data saved to PRIMARY storage');
        return true;
      } catch (error) {
        debugLog('PRIMARY storage save failed:', error);
        this.layerHealth[StorageLayers.PRIMARY] = LayerStatus.ERROR;
      }
    }

    // Try SECONDARY storage
    if (this.layerHealth[StorageLayers.SECONDARY] === LayerStatus.AVAILABLE) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        debugLog('Data saved to SECONDARY storage');
        return true;
      } catch (error) {
        debugLog('SECONDARY storage save failed:', error);
        this.layerHealth[StorageLayers.SECONDARY] = LayerStatus.ERROR;
      }
    }

    // Try TERTIARY storage
    if (this.layerHealth[StorageLayers.TERTIARY] === LayerStatus.AVAILABLE) {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
        debugLog('Data saved to TERTIARY storage');
        return true;
      } catch (error) {
        debugLog('TERTIARY storage save failed:', error);
        this.layerHealth[StorageLayers.TERTIARY] = LayerStatus.ERROR;
      }
    }

    throw new Error('All storage layers failed');
  },

  // Load data with fallback
  async loadData(key) {
    debugLog('Attempting to load data:', { key, storageHealth: this.layerHealth });
    
    // Try PRIMARY storage
    if (this.layerHealth[StorageLayers.PRIMARY] === LayerStatus.AVAILABLE) {
      try {
        const result = await chrome.storage.local.get(key);
        if (result[key]) {
          debugLog('Data loaded from PRIMARY storage');
          return result[key];
        }
      } catch (error) {
        debugLog('PRIMARY storage load failed:', error);
        this.layerHealth[StorageLayers.PRIMARY] = LayerStatus.ERROR;
      }
    }

    // Try SECONDARY storage
    if (this.layerHealth[StorageLayers.SECONDARY] === LayerStatus.AVAILABLE) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          debugLog('Data loaded from SECONDARY storage');
          return JSON.parse(data);
        }
      } catch (error) {
        debugLog('SECONDARY storage load failed:', error);
        this.layerHealth[StorageLayers.SECONDARY] = LayerStatus.ERROR;
      }
    }

    // Try TERTIARY storage
    if (this.layerHealth[StorageLayers.TERTIARY] === LayerStatus.AVAILABLE) {
      try {
        const data = sessionStorage.getItem(key);
        if (data) {
          debugLog('Data loaded from TERTIARY storage');
          return JSON.parse(data);
        }
      } catch (error) {
        debugLog('TERTIARY storage load failed:', error);
        this.layerHealth[StorageLayers.TERTIARY] = LayerStatus.ERROR;
      }
    }

    debugLog('Data not found in any storage layer');
    return null;
  },

  // Clear data from all storage layers
  async clearData(key) {
    debugLog('Attempting to clear data:', { key });
    
    const results = await Promise.allSettled([
      this.clearChromeStorage(key),
      this.clearLocalStorage(key),
      this.clearSessionStorage(key)
    ]);

    debugLog('Clear operations results:', results);
    return results.some(result => result.status === 'fulfilled' && result.value === true);
  },

  // Helper methods for clearing specific storage layers
  async clearChromeStorage(key) {
    try {
      await chrome.storage.local.remove(key);
      return true;
    } catch (error) {
      debugLog('Error clearing chrome storage:', error);
      return false;
    }
  },

  clearLocalStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      debugLog('Error clearing localStorage:', error);
      return false;
    }
  },

  clearSessionStorage(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      debugLog('Error clearing sessionStorage:', error);
      return false;
    }
  }
};

// Export the storage layer manager
window.StorageLayerManager = StorageLayerManager; 