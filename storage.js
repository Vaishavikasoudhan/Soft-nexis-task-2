/**
 * Storage Module - localStorage abstraction for TaskFlow Lite
 * Handles data persistence with JSON serialization/deserialization
 */

const STORAGE_KEY = 'taskflow_tasks';
const STORAGE_VERSION = '1.0';

/**
 * Save tasks to localStorage with error handling
 * @param {Array} tasks - Array of task objects
 * @returns {boolean} - Success status
 */
export const saveTasks = (tasks) => {
    try {
        const dataToStore = {
            version: STORAGE_VERSION,
            timestamp: Date.now(),
            tasks: tasks
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
        
        // Verify the data was saved correctly
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) {
            console.error('Failed to save tasks: localStorage returned null');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error saving tasks to localStorage:', error);
        
        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Attempting to clear old data...');
            try {
                // Clear old data and retry
                localStorage.clear();
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    version: STORAGE_VERSION,
                    timestamp: Date.now(),
                    tasks: tasks
                }));
                return true;
            } catch (retryError) {
                console.error('Failed to save even after clearing localStorage:', retryError);
                return false;
            }
        }
        
        return false;
    }
};

/**
 * Load tasks from localStorage with error handling and data validation
 * @returns {Array} - Array of task objects or empty array if error
 */
export const loadTasks = () => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        
        if (!storedData) {
            console.log('No stored tasks found, returning empty array');
            return [];
        }
        
        const parsedData = JSON.parse(storedData);
        
        // Validate data structure
        if (!parsedData || typeof parsedData !== 'object') {
            console.warn('Invalid stored data format, returning empty array');
            return [];
        }
        
        // Check if data has the expected structure
        if (!parsedData.tasks || !Array.isArray(parsedData.tasks)) {
            console.warn('Stored data missing tasks array, returning empty array');
            return [];
        }
        
        // Validate each task object
        const validTasks = parsedData.tasks.filter(task => {
            return task && 
                   typeof task === 'object' &&
                   typeof task.id === 'number' &&
                   typeof task.text === 'string' &&
                   typeof task.completed === 'boolean';
        });
        
        if (validTasks.length !== parsedData.tasks.length) {
            console.warn(`Filtered out ${parsedData.tasks.length - validTasks.length} invalid tasks`);
        }
        
        console.log(`Loaded ${validTasks.length} tasks from localStorage`);
        return validTasks;
        
    } catch (error) {
        console.error('Error loading tasks from localStorage:', error);
        
        // If JSON parsing fails, try to clear corrupted data
        if (error instanceof SyntaxError) {
            console.warn('Corrupted data in localStorage, clearing...');
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (clearError) {
                console.error('Failed to clear corrupted localStorage data:', clearError);
            }
        }
        
        return [];
    }
};

/**
 * Clear all stored tasks
 * @returns {boolean} - Success status
 */
export const clearTasks = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('Tasks cleared from localStorage');
        return true;
    } catch (error) {
        console.error('Error clearing tasks from localStorage:', error);
        return false;
    }
};

/**
 * Get storage statistics
 * @returns {Object} - Storage info including size and task count
 */
export const getStorageInfo = () => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (!storedData) {
            return {
                hasData: false,
                size: 0,
                taskCount: 0,
                lastModified: null
            };
        }
        
        const parsedData = JSON.parse(storedData);
        const tasks = parsedData.tasks || [];
        
        return {
            hasData: true,
            size: storedData.length,
            taskCount: tasks.length,
            lastModified: parsedData.timestamp || null,
            version: parsedData.version || 'unknown'
        };
    } catch (error) {
        console.error('Error getting storage info:', error);
        return {
            hasData: false,
            size: 0,
            taskCount: 0,
            lastModified: null,
            error: error.message
        };
    }
};

/**
 * Export tasks as JSON string
 * @param {Array} tasks - Array of task objects
 * @returns {string} - JSON string representation
 */
export const exportTasks = (tasks) => {
    try {
        const exportData = {
            version: STORAGE_VERSION,
            exportedAt: new Date().toISOString(),
            taskCount: tasks.length,
            tasks: tasks
        };
        
        return JSON.stringify(exportData, null, 2);
    } catch (error) {
        console.error('Error exporting tasks:', error);
        throw new Error('Failed to export tasks');
    }
};

/**
 * Import tasks from JSON string
 * @param {string} jsonString - JSON string containing tasks
 * @returns {Array} - Array of validated task objects
 */
export const importTasks = (jsonString) => {
    try {
        const importedData = JSON.parse(jsonString);
        
        if (!importedData || typeof importedData !== 'object') {
            throw new Error('Invalid import data format');
        }
        
        if (!importedData.tasks || !Array.isArray(importedData.tasks)) {
            throw new Error('Import data missing tasks array');
        }
        
        // Validate and clean imported tasks
        const validTasks = importedData.tasks.filter(task => {
            return task && 
                   typeof task === 'object' &&
                   typeof task.text === 'string' &&
                   task.text.trim().length > 0;
        }).map(task => ({
            id: task.id || Date.now() + Math.random(),
            text: task.text.trim(),
            completed: Boolean(task.completed),
            createdAt: task.createdAt || new Date().toISOString()
        }));
        
        console.log(`Imported ${validTasks.length} valid tasks`);
        return validTasks;
        
    } catch (error) {
        console.error('Error importing tasks:', error);
        throw new Error(`Import failed: ${error.message}`);
    }
};

/**
 * Check if localStorage is available and working
 * @returns {boolean} - Availability status
 */
export const isStorageAvailable = () => {
    try {
        const testKey = '__taskflow_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.error('localStorage is not available:', error);
        return false;
    }
};

/**
 * Get available storage space (approximate)
 * @returns {Object} - Storage space info
 */
export const getStorageSpace = () => {
    try {
        let totalSpace = 0;
        let usedSpace = 0;
        
        // Estimate total space (varies by browser)
        const testData = 'x'.repeat(1024); // 1KB
        const testKey = '__space_test__';
        
        // Try to fill localStorage to estimate total space
        for (let i = 0; i < 1000; i++) {
            try {
                localStorage.setItem(testKey + i, testData);
                totalSpace += 1024;
            } catch (e) {
                break;
            }
        }
        
        // Clear test data
        for (let i = 0; i < 1000; i++) {
            try {
                localStorage.removeItem(testKey + i);
            } catch (e) {
                break;
            }
        }
        
        // Calculate used space
        const storedData = localStorage.getItem(STORAGE_KEY);
        usedSpace = storedData ? storedData.length : 0;
        
        return {
            total: totalSpace,
            used: usedSpace,
            available: totalSpace - usedSpace,
            percentage: totalSpace > 0 ? (usedSpace / totalSpace) * 100 : 0
        };
        
    } catch (error) {
        console.error('Error calculating storage space:', error);
        return {
            total: 0,
            used: 0,
            available: 0,
            percentage: 0,
            error: error.message
        };
    }
}; 