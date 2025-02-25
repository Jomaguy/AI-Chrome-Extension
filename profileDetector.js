// Change from DEBUG to PROFILE_DEBUG
const PROFILE_DEBUG = false;

// Debug logging utility
function debugLog(...args) {
  if (!PROFILE_DEBUG) return;
  
  const [message, ...rest] = args;
  const prefix = '[Profile]';
  
  console.log(prefix, message, ...(rest.length ? rest : []));
}

// Profile state tracking
const profileState = {
  currentProfile: null,
  lastUpdate: null,
  isOwnProfile: false,
  pageType: null, // 'profile', 'feed', 'messages', 'jobs'
  urlPattern: null,
  currentURL: null,
  // Add name information structure
  nameInfo: {
    fullName: null,
    firstName: null,
    lastName: null,
    displayName: null,
    lastUpdated: null,
    extractionSuccess: false,
    extractionMethod: null
  },
  // Add headline information structure
  headlineInfo: {
    text: null,           // The actual headline text
    lastUpdated: null,    // When the headline was last extracted
    extractionSuccess: false,  // Whether extraction was successful
    extractionMethod: null,    // Method used to extract the headline
    // Additional metadata
    isCustom: false,      // Whether it's a custom headline or default
    length: 0,           // Length of the headline
    language: null       // Language of the headline (for future use)
  },
  // Add current position information structure
  currentPositionInfo: {
    role: {
      title: null,          // Current job title
      startDate: null,      // When role started
      isPresent: true,      // If this is current role
      department: null,     // Department/team if available
      location: null,       // Job location if available
      lastUpdated: null     // When we last extracted
    },
    company: {
      name: null,           // Company name
      linkedInId: null,     // Company LinkedIn ID if available
      url: null,            // Company LinkedIn URL
      verified: false,      // If company page exists
      industry: null        // Company industry if available
    },
    extractionSuccess: false,
    extractionMethod: null,
    lastUpdated: new Date().toISOString()
  }
};

// Add near other state tracking
const ownProfileState = {
  username: null,
  lastVerified: null,
  verificationMethod: null
};

// URL Pattern definitions
const URL_PATTERNS = {
  PROFILE: /linkedin\.com\/in\/([^\/]+)/,
  FEED: /linkedin\.com\/feed\/?$/,
  MESSAGES: /linkedin\.com\/messaging\//,
  JOBS: /linkedin\.com\/(jobs|hiring)\//
};

// Detect current page type from URL
function detectPageType(url) {
  try {
    if (!url) {
      debugLog('No URL provided for detection');
      return null;
    }

    // Check each pattern
    if (URL_PATTERNS.PROFILE.test(url)) {
      const match = url.match(URL_PATTERNS.PROFILE);
      return {
        type: 'profile',
        username: match ? match[1] : null
      };
    }
    
    if (URL_PATTERNS.FEED.test(url)) return { type: 'feed' };
    if (URL_PATTERNS.MESSAGES.test(url)) return { type: 'messages' };
    if (URL_PATTERNS.JOBS.test(url)) return { type: 'jobs' };

    return { type: 'other' };
  } catch (error) {
    debugLog('Error in page type detection:', error);
    return { type: 'error', error: error.message };
  }
}

// Update detectOwnProfile function with new selectors
function detectOwnProfile() {
  try {
    // Method 1: Check for Edit intro button with new selector
    const editIntroButton = document.querySelector('[aria-label="Edit intro"]');
    
    // Method 2: Check for edit buttons with specific class combination
    const editButtons = document.querySelectorAll('.artdeco-button--tertiary.ember-view');
    const hasEditButtons = Array.from(editButtons).some(button => 
      button.textContent.toLowerCase().includes('edit'));
    
    // Method 3: Check for profile edit URL pattern
    const isEditUrl = window.location.href.includes('/edit/intro');

    const isOwn = !!(editIntroButton || hasEditButtons || isEditUrl);

    debugLog('Own profile detection:', {
      hasEditIntroButton: !!editIntroButton,
      hasEditButtons: hasEditButtons,
      isEditUrl: isEditUrl,
      isOwnProfile: isOwn,
      currentUrl: window.location.href
    });

    return isOwn;
  } catch (error) {
    debugLog('Error in own profile detection:', error);
    return false;
  }
}

// Update updateProfileState function to clear storage when leaving profile page
async function updateProfileState() {
  try {
    const currentURL = window.location.href;
    const pageInfo = detectPageType(currentURL);

    debugLog('Updating profile state:', {
      url: currentURL,
      detected: pageInfo
    });

    // Update state
    profileState.currentURL = currentURL;
    profileState.pageType = pageInfo.type;
    profileState.urlPattern = pageInfo;
    profileState.lastUpdate = new Date().toISOString();

    // Handle profile pages
    if (pageInfo.type === 'profile') {
      // Add delay to allow page to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const isOwnProfile = detectOwnProfile();
      profileState.isOwnProfile = isOwnProfile;
      
      // First update verification if it's own profile
      if (isOwnProfile && pageInfo.username) {
        ownProfileState.username = pageInfo.username;
        ownProfileState.lastVerified = new Date().toISOString();
        ownProfileState.verificationMethod = 'ui-detection';
        
        debugLog('Own profile verified:', {
          username: pageInfo.username,
          method: 'ui-detection'
        });

        // Only attempt extractions after verification is complete
        debugLog('Starting profile data extraction');
        await Promise.all([
          extractProfileName(),
          extractProfileHeadline(),
          extractCurrentPosition()
        ]);
        debugLog('Profile data extraction complete');
      }
    } else if (!currentURL.includes('linkedin.com')) {
      // Only clear data when leaving LinkedIn entirely
      debugLog('Leaving LinkedIn, clearing profile data');
      profileState.currentProfile = null;
      profileState.isOwnProfile = false;
      
      // Clear all state info
      profileState.nameInfo = {
        fullName: null,
        firstName: null,
        lastName: null,
        displayName: null,
        lastUpdated: null,
        extractionSuccess: false,
        extractionMethod: null
      };
      
      profileState.headlineInfo = {
        text: null,
        lastUpdated: null,
        extractionSuccess: false,
        extractionMethod: null,
        isCustom: false,
        length: 0,
        language: null
      };
      
      profileState.currentPositionInfo = {
        role: {
          title: null,
          startDate: null,
          isPresent: true,
          department: null,
          location: null,
          lastUpdated: null
        },
        company: {
          name: null,
          linkedInId: null,
          url: null,
          verified: false,
          industry: null
        },
        extractionSuccess: false,
        extractionMethod: null,
        lastUpdated: new Date().toISOString()
      };

      // Clear ProfileStorage when leaving LinkedIn
      window.ProfileStorage.clearProfile();
    }

    debugLog('Profile state updated:', profileState);
  } catch (error) {
    debugLog('Error updating profile state:', error);
  }
}

// Listen for URL changes
function initializeURLMonitoring() {
  // Initial check
  updateProfileState();

  // Watch for URL changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(async () => {
      if (window.location.href !== profileState.currentURL) {
        debugLog('URL changed, updating state');
        await updateProfileState();
      }
    });
  });

  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  debugLog('URL monitoring initialized');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initializeURLMonitoring();
});

// Export for use in content.js
window.ProfileDetector = {
  profileState,
  detectPageType,
  updateProfileState
};

// Update the initialization function
(function initializeProfileDetector() {
  try {
    // Ensure initialization happens
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        initializeURLMonitoring();
      });
    } else {
      initializeURLMonitoring();
    }
  } catch (error) {
    console.error('[Profile] Initialization failed:', error);
  }
})();

// Add name extraction function
async function extractProfileName() {
  // First check if this is our own profile
  if (!profileState.isOwnProfile) {
    debugLog('Skipping name extraction - not own profile');
    return null;
  }

  // Fix verification check using ownProfileState and correct operator precedence
  if (ownProfileState.verificationMethod !== 'ui-detection') {
    debugLog('Skipping name extraction - profile ownership not verified');
    return null;
  }

  try {
    // Try multiple selectors for the name
    const nameSelectors = [
      '.text-heading-xlarge',               // New LinkedIn profile layout
      '.pv-text-details__left-panel h1',    // Alternative location
      '.ph5 h1',                            // Another common location
      '[data-section="identity"] h1',       // Generic identity section
      'h1.top-card-layout__title'           // Older layout
    ];

    let nameElement = null;
    for (const selector of nameSelectors) {
      nameElement = document.querySelector(selector);
      if (nameElement) {
        debugLog('Found name element with selector:', selector);
        break;
      }
    }

    if (!nameElement) {
      debugLog('Name element not found with any selector');
      profileState.nameInfo.extractionSuccess = false;
      profileState.nameInfo.extractionMethod = null;
      return null;
    }

    const fullName = nameElement.textContent.trim();
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    // Update state
    profileState.nameInfo = {
      fullName,
      firstName,
      lastName,
      displayName: fullName,
      lastUpdated: new Date().toISOString(),
      extractionSuccess: true,
      extractionMethod: 'dom-selector'
    };

    // Store in ProfileStorage
    debugLog('Attempting to store name in ProfileStorage:', fullName);
    const storageResult = await window.ProfileStorage.updateProfile({
      name: fullName
    });
    debugLog('Name storage result:', storageResult);

    debugLog('Name extraction successful:', profileState.nameInfo);
    return profileState.nameInfo;
  } catch (error) {
    debugLog('Error extracting name:', error);
    profileState.nameInfo.extractionSuccess = false;
    profileState.nameInfo.extractionMethod = null;
    return null;
  }
}

async function extractProfileHeadline() {
  // First check if this is our own profile
  if (!profileState.isOwnProfile) {
    debugLog('Skipping headline extraction - not own profile');
    return null;
  }

  // Verify ownership through UI detection
  if (ownProfileState.verificationMethod !== 'ui-detection') {
    debugLog('Skipping headline extraction - profile ownership not verified');
    return null;
  }

  try {
    // Try multiple selectors for the headline
    const headlineSelectors = [
      '.text-body-medium.break-words',                // Primary selector from DOM
      '[data-generated-suggestion-target]',           // Alternative using data attribute
      '.pv-text-details__left-panel .text-body-medium', // Another common location
      '.ph5 .text-body-medium'                        // Backup selector
    ];

    let headlineElement = null;
    for (const selector of headlineSelectors) {
      headlineElement = document.querySelector(selector);
      if (headlineElement) {
        debugLog('Found headline element with selector:', selector);
        break;
      }
    }

    if (!headlineElement) {
      debugLog('Headline element not found with any selector');
      profileState.headlineInfo.extractionSuccess = false;
      profileState.headlineInfo.extractionMethod = null;
      return null;
    }

    const headlineText = headlineElement.textContent.trim();

    // Update state
    profileState.headlineInfo = {
      text: headlineText,
      lastUpdated: new Date().toISOString(),
      extractionSuccess: true,
      extractionMethod: 'dom-selector',
      isCustom: true, // Assuming all headlines are custom for now
      length: headlineText.length,
      language: null // Language detection could be added later
    };

    // Store in ProfileStorage
    debugLog('Attempting to store headline in ProfileStorage:', headlineText);
    const storageResult = await window.ProfileStorage.updateProfile({
      headline: headlineText
    });
    debugLog('Headline storage result:', storageResult);

    debugLog('Headline extraction successful:', profileState.headlineInfo);
    return profileState.headlineInfo;
  } catch (error) {
    debugLog('Error extracting headline:', error);
    profileState.headlineInfo.extractionSuccess = false;
    profileState.headlineInfo.extractionMethod = null;
    return null;
  }
}

async function extractCurrentPosition() {
  // First check if this is our own profile
  if (!profileState.isOwnProfile) {
    debugLog('Skipping position extraction - not own profile');
    return null;
  }

  // Verify ownership through UI detection
  if (ownProfileState.verificationMethod !== 'ui-detection') {
    debugLog('Skipping position extraction - profile ownership not verified');
    return null;
  }

  try {
    // Try multiple selectors for the position title
    const positionSelectors = [
      '.artdeco-list__item:first-child .display-flex.align-items-center.mr1.t-bold span[aria-hidden="true"]',    // Primary selector
      '.pvs-list__item:first-child .mr1.t-bold span[aria-hidden="true"]',                                        // Alternative selector
      '.experience-section li:first-child .mr1.t-bold span[aria-hidden="true"]'                                  // Backup selector
    ];

    // Add company name selectors
    const companySelectors = [
      '.artdeco-list__item:first-child .t-14.t-normal span[aria-hidden="true"]',      // Primary selector
      '.pvs-list__item:first-child .t-14.t-normal span[aria-hidden="true"]',          // Alternative
      '.experience-section li:first-child .t-14.t-normal span[aria-hidden="true"]'     // Backup
    ];

    let titleElement = null;
    for (const selector of positionSelectors) {
      titleElement = document.querySelector(selector);
      if (titleElement) {
        debugLog('Found position title element with selector:', selector);
        break;
      }
    }

    // Extract company
    let companyElement = null;
    for (const selector of companySelectors) {
      companyElement = document.querySelector(selector);
      if (companyElement) {
        debugLog('Found company element with selector:', selector);
        break;
      }
    }

    if (!titleElement || !companyElement) {
      debugLog('Position elements not found');
      profileState.currentPositionInfo.extractionSuccess = false;
      profileState.currentPositionInfo.extractionMethod = null;
      return null;
    }

    const titleText = titleElement.textContent.trim();
    const companyText = companyElement.textContent.trim().split(' · ')[0]; // Remove additional info after dot

    // Update state
    profileState.currentPositionInfo.role.title = titleText;
    profileState.currentPositionInfo.role.lastUpdated = new Date().toISOString();
    profileState.currentPositionInfo.company.name = companyText;
    profileState.currentPositionInfo.extractionSuccess = true;
    profileState.currentPositionInfo.extractionMethod = 'dom-selector';

    // Store in ProfileStorage
    debugLog('Attempting to store position in ProfileStorage:', { role: titleText, company: companyText });
    const storageResult = await window.ProfileStorage.updateProfile({
      currentRole: titleText,
      company: companyText
    });
    debugLog('Position storage result:', storageResult);

    debugLog('Position extraction successful:', profileState.currentPositionInfo);
    return profileState.currentPositionInfo;
  } catch (error) {
    debugLog('Error extracting position:', error);
    profileState.currentPositionInfo.extractionSuccess = false;
    profileState.currentPositionInfo.extractionMethod = null;
    return null;
  }
} 