// Storage Layer Manager Test Suite
const StorageLayerTests = {
  async runTests() {
    console.log('=== Starting Storage Layer Tests ===');
    
    try {
      await this.testInitialization();
      await this.testBasicOperations();
      await this.testFallbackMechanism();
      await this.testLayerRecovery();
      console.log('✅ All Storage Layer tests completed successfully');
    } catch (error) {
      console.error('❌ Storage Layer test suite failed:', error);
    }
  },

  async testInitialization() {
    console.log('\n🔍 Testing Storage Layer Initialization');
    try {
      await StorageLayerManager.init();
      
      // Verify all layers are checked
      const health = StorageLayerManager.layerHealth;
      const layers = Object.keys(health);
      
      if (layers.length !== 3) {
        throw new Error('Expected 3 storage layers');
      }

      console.log('Storage health after initialization:', health);
      console.log('✅ Initialization test passed');
    } catch (error) {
      throw new Error(`Initialization test failed: ${error.message}`);
    }
  },

  async testBasicOperations() {
    console.log('\n🔍 Testing Basic Storage Operations');
    try {
      const testKey = '_test_storage_layer';
      const testData = {
        id: 1,
        name: 'Test Data',
        timestamp: new Date().toISOString()
      };

      // Test save
      console.log('Testing save operation...');
      const saveResult = await StorageLayerManager.saveData(testKey, testData);
      if (!saveResult) {
        throw new Error('Save operation failed');
      }
      console.log('✅ Save operation successful');

      // Test load
      console.log('Testing load operation...');
      const loadedData = await StorageLayerManager.loadData(testKey);
      if (!loadedData || loadedData.id !== testData.id) {
        throw new Error('Load operation failed or data mismatch');
      }
      console.log('✅ Load operation successful');

      // Test clear
      console.log('Testing clear operation...');
      const clearResult = await StorageLayerManager.clearData(testKey);
      if (!clearResult) {
        throw new Error('Clear operation failed');
      }
      console.log('✅ Clear operation successful');

      // Verify data is cleared
      const clearedData = await StorageLayerManager.loadData(testKey);
      if (clearedData !== null) {
        throw new Error('Data still exists after clear operation');
      }

      console.log('✅ Basic operations test passed');
    } catch (error) {
      throw new Error(`Basic operations test failed: ${error.message}`);
    }
  },

  async testFallbackMechanism() {
    console.log('\n🔍 Testing Fallback Mechanism');
    try {
      const testKey = '_test_fallback';
      const testData = { message: 'fallback test' };

      // Simulate PRIMARY storage failure
      StorageLayerManager.layerHealth[StorageLayers.PRIMARY] = LayerStatus.ERROR;
      
      // Should fall back to SECONDARY storage
      console.log('Testing save with PRIMARY storage failure...');
      const saveResult = await StorageLayerManager.saveData(testKey, testData);
      if (!saveResult) {
        throw new Error('Fallback save failed');
      }

      // Verify data was saved to SECONDARY storage
      const secondaryData = localStorage.getItem(testKey);
      if (!secondaryData) {
        throw new Error('Data not found in SECONDARY storage');
      }

      // Clear test data
      await StorageLayerManager.clearData(testKey);
      
      // Reset health status
      StorageLayerManager.layerHealth[StorageLayers.PRIMARY] = LayerStatus.AVAILABLE;
      
      console.log('✅ Fallback mechanism test passed');
    } catch (error) {
      // Reset health status
      StorageLayerManager.layerHealth[StorageLayers.PRIMARY] = LayerStatus.AVAILABLE;
      throw new Error(`Fallback mechanism test failed: ${error.message}`);
    }
  },

  async testLayerRecovery() {
    console.log('\n🔍 Testing Layer Recovery');
    try {
      // Simulate all layers being down
      StorageLayerManager.layerHealth = {
        [StorageLayers.PRIMARY]: LayerStatus.ERROR,
        [StorageLayers.SECONDARY]: LayerStatus.ERROR,
        [StorageLayers.TERTIARY]: LayerStatus.ERROR
      };

      // Check health should recover available layers
      await StorageLayerManager.checkLayerHealth();
      
      // At least one layer should be available
      const hasAvailableLayer = Object.values(StorageLayerManager.layerHealth)
        .some(status => status === LayerStatus.AVAILABLE);
      
      if (!hasAvailableLayer) {
        throw new Error('No storage layer recovered');
      }

      console.log('✅ Layer recovery test passed');
    } catch (error) {
      throw new Error(`Layer recovery test failed: ${error.message}`);
    }
  }
};

// Auto-run tests when in development mode
if (STORAGE_LAYER_DEBUG) {
  setTimeout(() => {
    StorageLayerTests.runTests();
  }, 1000); // Small delay to ensure StorageLayerManager is fully initialized
}

// Export for manual testing
window.StorageLayerTests = StorageLayerTests; 