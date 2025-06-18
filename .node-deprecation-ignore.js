/**
 * Node.js deprecation warning suppression
 * 
 * This file is loaded via the NODE_OPTIONS environment variable
 * to suppress specific deprecation warnings that are coming from
 * dependencies and cannot be fixed directly.
 */

const originalEmit = process.emit;

// Override the emit function to filter out specific deprecation warnings
process.emit = function(name, ...args) {
  if (
    name === 'warning' &&
    args[0] &&
    args[0].name === 'DeprecationWarning' &&
    (
      // Filter out punycode deprecation warning
      args[0].code === 'DEP0040' || 
      args[0].message.includes('punycode') ||
      // Filter out other common deprecation warnings
      args[0].code === 'DEP0148' || // Use of deprecated url.parse()
      args[0].code === 'DEP0137' // Use of deprecated Buffer constructor
    )
  ) {
    // Silently ignore the warning
    return false;
  }
  
  // Call the original emit with all other events
  return originalEmit.apply(process, [name, ...args]);
};