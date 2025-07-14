/**
 * Validation Module - Form validation and input sanitization for TaskFlow Lite
 * Handles task input validation, error feedback, and data sanitization
 */

// Validation constants
const VALIDATION_RULES = {
    MIN_LENGTH: 1,
    MAX_LENGTH: 200,
    ALLOWED_CHARS: /^[a-zA-Z0-9\s\-_.,!?@#$%&*()+=:;"'<>[\]{}|\\/~`]+$/,
    FORBIDDEN_WORDS: ['script', 'javascript', 'onload', 'onerror', 'onclick']
};

/**
 * Validate task text input
 * @param {string} text - Task text to validate
 * @returns {Object} - Validation result with isValid and message
 */
export const validateTaskText = (text) => {
    // Check if input is provided
    if (!text || typeof text !== 'string') {
        return {
            isValid: false,
            message: 'Please enter a task description'
        };
    }
    
    // Trim whitespace
    const trimmedText = text.trim();
    
    // Check minimum length
    if (trimmedText.length < VALIDATION_RULES.MIN_LENGTH) {
        return {
            isValid: false,
            message: 'Task description cannot be empty'
        };
    }
    
    // Check maximum length
    if (trimmedText.length > VALIDATION_RULES.MAX_LENGTH) {
        return {
            isValid: false,
            message: `Task description cannot exceed ${VALIDATION_RULES.MAX_LENGTH} characters`
        };
    }
    
    // Check for forbidden characters (basic XSS prevention)
    if (!VALIDATION_RULES.ALLOWED_CHARS.test(trimmedText)) {
        return {
            isValid: false,
            message: 'Task description contains invalid characters'
        };
    }
    
    // Check for forbidden words (additional XSS prevention)
    const lowerText = trimmedText.toLowerCase();
    for (const forbiddenWord of VALIDATION_RULES.FORBIDDEN_WORDS) {
        if (lowerText.includes(forbiddenWord)) {
            return {
                isValid: false,
                message: 'Task description contains forbidden content'
            };
        }
    }
    
    // Check for excessive whitespace
    if (/\s{3,}/.test(trimmedText)) {
        return {
            isValid: false,
            message: 'Task description contains excessive whitespace'
        };
    }
    
    // Check for repetitive characters
    if (/(.)\1{4,}/.test(trimmedText)) {
        return {
            isValid: false,
            message: 'Task description contains too many repeated characters'
        };
    }
    
    return {
        isValid: true,
        message: '',
        sanitizedText: trimmedText
    };
};

/**
 * Sanitize task text input
 * @param {string} text - Raw task text
 * @returns {string} - Sanitized task text
 */
export const sanitizeTaskText = (text) => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    return text
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, VALIDATION_RULES.MAX_LENGTH); // Limit length
};

/**
 * Validate task object structure
 * @param {Object} task - Task object to validate
 * @returns {Object} - Validation result
 */
export const validateTaskObject = (task) => {
    if (!task || typeof task !== 'object') {
        return {
            isValid: false,
            message: 'Invalid task object'
        };
    }
    
    // Check required properties
    if (typeof task.id !== 'number' || task.id <= 0) {
        return {
            isValid: false,
            message: 'Task must have a valid ID'
        };
    }
    
    if (typeof task.text !== 'string' || task.text.trim().length === 0) {
        return {
            isValid: false,
            message: 'Task must have a valid text description'
        };
    }
    
    if (typeof task.completed !== 'boolean') {
        return {
            isValid: false,
            message: 'Task must have a valid completion status'
        };
    }
    
    // Validate text content
    const textValidation = validateTaskText(task.text);
    if (!textValidation.isValid) {
        return textValidation;
    }
    
    return {
        isValid: true,
        message: '',
        sanitizedTask: {
            ...task,
            text: textValidation.sanitizedText
        }
    };
};

/**
 * Validate task array
 * @param {Array} tasks - Array of task objects
 * @returns {Object} - Validation result
 */
export const validateTaskArray = (tasks) => {
    if (!Array.isArray(tasks)) {
        return {
            isValid: false,
            message: 'Tasks must be an array',
            validTasks: []
        };
    }
    
    const validTasks = [];
    const errors = [];
    
    tasks.forEach((task, index) => {
        const validation = validateTaskObject(task);
        if (validation.isValid) {
            validTasks.push(validation.sanitizedTask);
        } else {
            errors.push(`Task ${index + 1}: ${validation.message}`);
        }
    });
    
    return {
        isValid: validTasks.length > 0,
        message: errors.length > 0 ? errors.join('; ') : '',
        validTasks: validTasks,
        errorCount: errors.length
    };
};

/**
 * Real-time input validation with debouncing
 * @param {HTMLInputElement} inputElement - Input element to validate
 * @param {Function} callback - Callback function for validation result
 * @returns {Function} - Cleanup function
 */
export const setupRealTimeValidation = (inputElement, callback) => {
    if (!inputElement || typeof callback !== 'function') {
        return () => {};
    }
    
    let validationTimeout;
    
    const validateInput = () => {
        const value = inputElement.value;
        const validation = validateTaskText(value);
        
        // Update input styling
        if (value.length > 0) {
            if (validation.isValid) {
                inputElement.classList.remove('invalid');
                inputElement.classList.add('valid');
            } else {
                inputElement.classList.remove('valid');
                inputElement.classList.add('invalid');
            }
        } else {
            inputElement.classList.remove('valid', 'invalid');
        }
        
        // Call callback with validation result
        callback(validation);
    };
    
    const debouncedValidation = () => {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(validateInput, 300);
    };
    
    // Add event listeners
    inputElement.addEventListener('input', debouncedValidation);
    inputElement.addEventListener('blur', validateInput);
    inputElement.addEventListener('focus', () => {
        inputElement.classList.remove('valid', 'invalid');
    });
    
    // Return cleanup function
    return () => {
        clearTimeout(validationTimeout);
        inputElement.removeEventListener('input', debouncedValidation);
        inputElement.removeEventListener('blur', validateInput);
        inputElement.removeEventListener('focus', () => {});
    };
};

/**
 * Validate form submission
 * @param {HTMLFormElement} form - Form element to validate
 * @returns {Object} - Validation result
 */
export const validateFormSubmission = (form) => {
    if (!form || !(form instanceof HTMLFormElement)) {
        return {
            isValid: false,
            message: 'Invalid form element'
        };
    }
    
    const formData = new FormData(form);
    const taskText = formData.get('task-input') || '';
    
    return validateTaskText(taskText);
};

/**
 * Check for duplicate tasks
 * @param {string} newTaskText - New task text
 * @param {Array} existingTasks - Array of existing tasks
 * @returns {Object} - Duplicate check result
 */
export const checkForDuplicates = (newTaskText, existingTasks) => {
    if (!Array.isArray(existingTasks)) {
        return {
            hasDuplicates: false,
            duplicates: []
        };
    }
    
    const normalizedNewText = newTaskText.trim().toLowerCase();
    const duplicates = existingTasks.filter(task => 
        task.text.trim().toLowerCase() === normalizedNewText
    );
    
    return {
        hasDuplicates: duplicates.length > 0,
        duplicates: duplicates
    };
};

/**
 * Validate task ID
 * @param {number} id - Task ID to validate
 * @returns {boolean} - Whether ID is valid
 */
export const validateTaskId = (id) => {
    return typeof id === 'number' && 
           Number.isInteger(id) && 
           id > 0 && 
           id <= Number.MAX_SAFE_INTEGER;
};

/**
 * Validate task completion status
 * @param {boolean} completed - Completion status to validate
 * @returns {boolean} - Whether status is valid
 */
export const validateCompletionStatus = (completed) => {
    return typeof completed === 'boolean';
};

/**
 * Get validation error message for specific field
 * @param {string} fieldName - Name of the field
 * @param {string} errorType - Type of error
 * @returns {string} - Localized error message
 */
export const getValidationMessage = (fieldName, errorType) => {
    const messages = {
        'task-input': {
            'required': 'Please enter a task description',
            'minLength': `Task description must be at least ${VALIDATION_RULES.MIN_LENGTH} character`,
            'maxLength': `Task description cannot exceed ${VALIDATION_RULES.MAX_LENGTH} characters`,
            'invalidChars': 'Task description contains invalid characters',
            'forbiddenContent': 'Task description contains forbidden content',
            'excessiveWhitespace': 'Task description contains excessive whitespace',
            'repetitiveChars': 'Task description contains too many repeated characters'
        }
    };
    
    return messages[fieldName]?.[errorType] || 'Invalid input';
};

/**
 * Create a comprehensive validation report
 * @param {Object} data - Data to validate
 * @param {string} dataType - Type of data ('task', 'taskArray', 'form')
 * @returns {Object} - Detailed validation report
 */
export const createValidationReport = (data, dataType) => {
    const report = {
        isValid: false,
        errors: [],
        warnings: [],
        suggestions: [],
        timestamp: new Date().toISOString()
    };
    
    try {
        switch (dataType) {
            case 'task':
                const taskValidation = validateTaskObject(data);
                report.isValid = taskValidation.isValid;
                if (!taskValidation.isValid) {
                    report.errors.push(taskValidation.message);
                }
                break;
                
            case 'taskArray':
                const arrayValidation = validateTaskArray(data);
                report.isValid = arrayValidation.isValid;
                if (arrayValidation.errorCount > 0) {
                    report.errors.push(arrayValidation.message);
                }
                if (arrayValidation.validTasks.length < data.length) {
                    report.warnings.push(`${data.length - arrayValidation.validTasks.length} tasks were filtered out due to validation errors`);
                }
                break;
                
            case 'form':
                const formValidation = validateFormSubmission(data);
                report.isValid = formValidation.isValid;
                if (!formValidation.isValid) {
                    report.errors.push(formValidation.message);
                }
                break;
                
            default:
                report.errors.push('Unknown data type for validation');
        }
    } catch (error) {
        report.errors.push(`Validation error: ${error.message}`);
    }
    
    return report;
};

/**
 * Validate and sanitize task data for storage
 * @param {Object} taskData - Raw task data
 * @returns {Object} - Sanitized and validated task object
 */
export const sanitizeTaskForStorage = (taskData) => {
    if (!taskData || typeof taskData !== 'object') {
        throw new Error('Invalid task data');
    }
    
    const sanitizedTask = {
        id: validateTaskId(taskData.id) ? taskData.id : Date.now(),
        text: sanitizeTaskText(taskData.text || ''),
        completed: validateCompletionStatus(taskData.completed) ? taskData.completed : false,
        createdAt: taskData.createdAt || new Date().toISOString()
    };
    
    // Final validation
    const validation = validateTaskObject(sanitizedTask);
    if (!validation.isValid) {
        throw new Error(`Task validation failed: ${validation.message}`);
    }
    
    return sanitizedTask;
}; 