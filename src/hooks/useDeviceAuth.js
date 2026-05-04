// Backwards-compat shim. Real implementation in ./useStudentAuth.js.
// Keeps old import { useDeviceAuth } from './hooks/useDeviceAuth' working.
export { useStudentAuth as useDeviceAuth } from './useStudentAuth.js';