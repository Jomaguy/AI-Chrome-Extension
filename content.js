console.log('%c AI Autocomplete Extension loaded ', 'background: #222; color: #bada55');

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounce the input handler (300ms delay)
const debouncedHandleInput = debounce((e) => {
  console.log('Debounced text changed:', {
    element: e.target,
    value: e.target.value,
    selectionStart: e.target.selectionStart,
    selectionEnd: e.target.selectionEnd
  });
}, 300);

function isTextField(element) {
  try {
    // Debug log
    console.log('Checking element:', {
      tagName: element.tagName,
      type: element.type,
      className: element.className
    });

    // Basic text input types
    if (element.tagName === 'INPUT') {
      const textInputTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
      return textInputTypes.includes(element.type);
    }
    
    // Textarea elements
    if (element.tagName === 'TEXTAREA') {
      return true;
    }
    
    // Contenteditable elements
    if (element.getAttribute('contenteditable') === 'true') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in isTextField:', error);
    return false;
  }
}

// Track the current active text field
let activeTextField = null;

// Focus detection
document.addEventListener('focusin', (e) => {
  try {
    const target = e.target;
    if (isTextField(target)) {
      console.log('Text field focused:', {
        element: target,
        value: target.value
      });
      activeTextField = target;
      
      // Add input listener when field is focused
      target.addEventListener('input', handleInput);
    }
  } catch (error) {
    console.error('Error in focus handler:', error);
  }
});

// Remove input listener when field is blurred
document.addEventListener('focusout', (e) => {
  if (activeTextField) {
    activeTextField.removeEventListener('input', handleInput);
    activeTextField = null;
  }
});

// Handle text input
function handleInput(e) {
  // Log immediately for debugging
  console.log('Raw input event received');
  debouncedHandleInput(e);
} 