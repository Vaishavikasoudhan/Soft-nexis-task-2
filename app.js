/**
 * TaskFlow Lite - Main Application Entry Point
 * Implements MVC-like pattern with modular architecture
 */

// Import modules
import { loadTasks, saveTasks, clearTasks, isStorageAvailable } from './modules/storage.js';
import { 
    renderTaskList, 
    updateTaskCount, 
    updateFilterButtons, 
    showValidationMessage, 
    clearValidationMessage,
    addTaskToList,
    removeTaskFromList,
    updateTaskCompletion
} from './modules/render.js';
import { 
    validateTaskText, 
    validateTaskObject, 
    setupRealTimeValidation,
    checkForDuplicates,
    sanitizeTaskForStorage
} from './modules/validation.js';

/**
 * TaskFlow Lite Application Class
 * Manages application state and coordinates between modules
 */
class TaskFlowApp {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.isInitialized = false;

        // DOM elements
        this.elements = {
            taskForm: null,
            taskInput: null,
            taskList: null,
            filterButtons: null,
            clearCompletedBtn: null
        };

        // Bind methods to preserve context
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleTaskListClick = this.handleTaskListClick.bind(this);
        this.handleFilterClick = this.handleFilterClick.bind(this);
        this.handleClearCompleted = this.handleClearCompleted.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing TaskFlow Lite...');

            if (!isStorageAvailable()) {
                throw new Error('localStorage is not available');
            }

            this.initializeElements();
            this.tasks = loadTasks();
            this.setupEventListeners();
            this.render();
            this.setupValidation();

            this.isInitialized = true;
            console.log('TaskFlow Lite initialized successfully');

        } catch (error) {
            console.error('Failed to initialize TaskFlow Lite:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    initializeElements() {
        this.elements.taskForm = document.getElementById('task-form');
        this.elements.taskInput = document.getElementById('task-input');
        this.elements.taskList = document.getElementById('task-list');
        this.elements.filterButtons = document.querySelectorAll('.filter-btn');
        this.elements.clearCompletedBtn = document.getElementById('clear-completed');
    }

    setupEventListeners() {
        this.elements.taskForm.addEventListener('submit', this.handleFormSubmit);
        this.elements.taskList.addEventListener('click', this.handleTaskListClick);
        this.elements.filterButtons.forEach(button => button.addEventListener('click', this.handleFilterClick));
        this.elements.clearCompletedBtn.addEventListener('click', this.handleClearCompleted);
        document.addEventListener('keydown', this.handleKeydown);

        window.addEventListener('beforeunload', () => this.saveTasks());
    }

    setupValidation() {
        if (!this.elements.taskInput) return;

        const cleanup = setupRealTimeValidation(this.elements.taskInput, (validation) => {
            if (validation.isValid) {
                clearValidationMessage();
            } else {
                showValidationMessage(validation.message, 'error');
            }
        });

        this.validationCleanup = cleanup;
    }

    createTask(text) {
        return {
            id: Date.now() + Math.random(),
            text: text.trim(),
            completed: false,
            createdAt: new Date().toISOString()
        };
    }

    addTask(text) {
        try {
            const validation = validateTaskText(text);
            if (!validation.isValid) {
                showValidationMessage(validation.message, 'error');
                return false;
            }

            const duplicateCheck = checkForDuplicates(validation.sanitizedText, this.tasks);
            if (duplicateCheck.hasDuplicates) {
                showValidationMessage('This task already exists', 'warning');
                return false;
            }

            const newTask = this.createTask(validation.sanitizedText);
            const taskValidation = validateTaskObject(newTask);

            if (!taskValidation.isValid) {
                showValidationMessage(taskValidation.message, 'error');
                return false;
            }

            this.tasks.unshift(taskValidation.sanitizedTask);
            this.saveTasks();
            this.render();
            showValidationMessage('Task added successfully!', 'success');

            return true;

        } catch (error) {
            console.error('Error adding task:', error);
            showValidationMessage('Failed to add task. Please try again.', 'error');
            return false;
        }
    }

    removeTask(taskId) {
        const index = this.tasks.findIndex(task => task.id === taskId);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            this.saveTasks();
            this.render();
        }
    }

    toggleTaskCompletion(taskId) {
        const task = this.tasks.find(task => task.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.render();
        }
    }

    clearCompletedTasks() {
        const completedCount = this.tasks.filter(task => task.completed).length;

        if (completedCount === 0) {
            showValidationMessage('No completed tasks to clear', 'warning');
            return;
        }

        showConfirmation(`Are you sure you want to clear ${completedCount} completed task(s)?`, () => {
            this.tasks = this.tasks.filter(task => !task.completed);
            this.saveTasks();
            this.render();
            showValidationMessage(`${completedCount} completed task(s) cleared`, 'success');
        }, () => {
            console.log('User cancelled clear completed');
        });
    }

    saveTasks() {
        try {
            const success = saveTasks(this.tasks);
            if (!success) {
                console.warn('Failed to save tasks to storage');
            }
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }

    render() {
        renderTaskList(this.elements.taskList, this.tasks, this.currentFilter);
        updateTaskCount(this.tasks);
        updateFilterButtons(this.currentFilter);
    }

    handleFormSubmit(event) {
        event.preventDefault();
        const taskText = this.elements.taskInput.value;
        if (this.addTask(taskText)) {
            this.elements.taskInput.value = '';
            this.elements.taskInput.focus();
        }
    }

    handleTaskListClick(event) {
        const taskElement = event.target.closest('.task-item');
        if (!taskElement) return;
        const taskId = Number(taskElement.dataset.id);

        if (event.target.classList.contains('task-checkbox')) {
            event.preventDefault();
            this.toggleTaskCompletion(taskId);
        } else if (event.target.classList.contains('delete-btn')) {
            const task = this.tasks.find(t => t.id === taskId);
            const message = `Are you sure you want to delete \"${task.text}\"?`;
            showConfirmation(message, () => {
                this.removeTask(taskId);
            }, () => {
                console.log('Delete cancelled');
            });
        }
    }

    handleFilterClick(event) {
        const filter = event.target.dataset.filter;
        if (filter && filter !== this.currentFilter) {
            this.currentFilter = filter;
            this.render();
        }
    }

    handleClearCompleted() {
        this.clearCompletedTasks();
    }

    handleKeydown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            if (document.activeElement === this.elements.taskInput) {
                this.elements.taskForm.dispatchEvent(new Event('submit'));
            }
        }
        if ((event.ctrlKey || event.metaKey) && event.key === '/') {
            event.preventDefault();
            this.elements.taskInput.focus();
        }
    }

    destroy() {
        if (this.validationCleanup) {
            this.validationCleanup();
        }
        this.saveTasks();
        console.log('TaskFlow Lite destroyed');
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.taskFlowApp = new TaskFlowApp();
});

window.addEventListener('beforeunload', () => {
    if (window.taskFlowApp) {
        window.taskFlowApp.destroy();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskFlowApp;
}












































































































// /**
//  * TaskFlow Lite - Main Application Entry Point
//  * Implements MVC-like pattern with modular architecture
//  */

// // Import modules
// import { loadTasks, saveTasks, clearTasks, isStorageAvailable } from './modules/storage.js';
// import { 
//     renderTaskList, 
//     updateTaskCount, 
//     updateFilterButtons, 
//     showValidationMessage, 
//     clearValidationMessage,
//     addTaskToList,
//     removeTaskFromList,
//     updateTaskCompletion
// } from './modules/render.js';
// import { 
//     validateTaskText, 
//     validateTaskObject, 
//     setupRealTimeValidation,
//     checkForDuplicates,
//     sanitizeTaskForStorage
// } from './modules/validation.js';

// /**
//  * TaskFlow Lite Application Class
//  * Manages application state and coordinates between modules
//  */
// class TaskFlowApp {
//     constructor() {
//         this.tasks = [];
//         this.currentFilter = 'all';
//         this.isInitialized = false;
        
//         // DOM elements
//         this.elements = {
//             taskForm: null,
//             taskInput: null,
//             taskList: null,
//             filterButtons: null,
//             clearCompletedBtn: null,
//             confirmModal: null,
//             modalMessage: null,
//             modalConfirm: null,
//             modalCancel: null
//         };
        
//         // Bind methods to preserve context
//         this.handleFormSubmit = this.handleFormSubmit.bind(this);
//         this.handleTaskListClick = this.handleTaskListClick.bind(this);
//         this.handleFilterClick = this.handleFilterClick.bind(this);
//         this.handleClearCompleted = this.handleClearCompleted.bind(this);
//         this.handleModalConfirm = this.handleModalConfirm.bind(this);
//         this.handleModalCancel = this.handleModalCancel.bind(this);
//         this.handleKeydown = this.handleKeydown.bind(this);
        
//         // Initialize the application
//         this.init();
//     }
    
//     /**
//      * Initialize the application
//      */
//     async init() {
//         try {
//             console.log('Initializing TaskFlow Lite...');
            
//             // Check storage availability
//             if (!isStorageAvailable()) {
//                 throw new Error('localStorage is not available');
//             }
            
//             // Initialize DOM elements
//             this.initializeElements();
            
//             // Load tasks from storage
//             this.tasks = loadTasks();
//             console.log(`Loaded ${this.tasks.length} tasks from storage`);
            
//             // Set up event listeners
//             this.setupEventListeners();
            
//             // Render initial state
//             this.render();
            
//             // Set up real-time validation
//             this.setupValidation();
            
//             this.isInitialized = true;
//             console.log('TaskFlow Lite initialized successfully');
            
//         } catch (error) {
//             console.error('Failed to initialize TaskFlow Lite:', error);
//             this.showError('Failed to initialize application. Please refresh the page.');
//         }
//     }
    
//     /**
//      * Initialize DOM element references
//      */
//     initializeElements() {
//         this.elements.taskForm = document.getElementById('task-form');
//         this.elements.taskInput = document.getElementById('task-input');
//         this.elements.taskList = document.getElementById('task-list');
//         this.elements.filterButtons = document.querySelectorAll('.filter-btn');
//         this.elements.clearCompletedBtn = document.getElementById('clear-completed');
//         this.elements.confirmModal = document.getElementById('confirm-modal');
//         this.elements.modalMessage = document.getElementById('modal-message');
//         this.elements.modalConfirm = document.getElementById('modal-confirm');
//         this.elements.modalCancel = document.getElementById('modal-cancel');
        
//         // Validate required elements
//         const requiredElements = [
//             'taskForm', 'taskInput', 'taskList', 'clearCompletedBtn',
//             'confirmModal', 'modalMessage', 'modalConfirm', 'modalCancel'
//         ];
        
//         for (const elementName of requiredElements) {
//             if (!this.elements[elementName]) {
//                 throw new Error(`Required element not found: ${elementName}`);
//             }
//         }
//     }
    
//     /**
//      * Set up event listeners
//      */
//     setupEventListeners() {
//         // Form submission
//         this.elements.taskForm.addEventListener('submit', this.handleFormSubmit);
        
//         // Task list event delegation
//         this.elements.taskList.addEventListener('click', this.handleTaskListClick);
        
//         // Filter buttons
//         this.elements.filterButtons.forEach(button => {
//             button.addEventListener('click', this.handleFilterClick);
//         });
        
//         // Clear completed button
//         this.elements.clearCompletedBtn.addEventListener('click', this.handleClearCompleted);
        
//         // Modal events
//         this.elements.modalConfirm.addEventListener('click', this.handleModalConfirm);
//         this.elements.modalCancel.addEventListener('click', this.handleModalCancel);
        
//         // Keyboard shortcuts
//         document.addEventListener('keydown', this.handleKeydown);
        
//         // Window events
//         window.addEventListener('beforeunload', () => {
//             this.saveTasks();
//         });
//     }
    
//     /**
//      * Set up real-time validation
//      */
//     setupValidation() {
//         if (!this.elements.taskInput) return;
        
//         const cleanup = setupRealTimeValidation(this.elements.taskInput, (validation) => {
//             if (validation.isValid) {
//                 clearValidationMessage();
//             } else {
//                 showValidationMessage(validation.message, 'error');
//             }
//         });
        
//         // Store cleanup function for later use
//         this.validationCleanup = cleanup;
//     }
    
//     /**
//      * Create a new task object
//      * @param {string} text - Task text
//      * @returns {Object} - Task object
//      */
//     createTask(text) {
//         return {
//             id: Date.now() + Math.random(), // Ensure unique ID
//             text: text.trim(),
//             completed: false,
//             createdAt: new Date().toISOString()
//         };
//     }
    
//     /**
//      * Add a new task
//      * @param {string} text - Task text
//      * @returns {boolean} - Success status
//      */
//     addTask(text) {
//         try {
//             // Validate input
//             const validation = validateTaskText(text);
//             if (!validation.isValid) {
//                 showValidationMessage(validation.message, 'error');
//                 return false;
//             }
            
//             // Check for duplicates
//             const duplicateCheck = checkForDuplicates(validation.sanitizedText, this.tasks);
//             if (duplicateCheck.hasDuplicates) {
//                 showValidationMessage('This task already exists', 'warning');
//                 return false;
//             }
            
//             // Create and validate task
//             const newTask = this.createTask(validation.sanitizedText);
//             const taskValidation = validateTaskObject(newTask);
            
//             if (!taskValidation.isValid) {
//                 showValidationMessage(taskValidation.message, 'error');
//                 return false;
//             }
            
//             // Add to tasks array
//             this.tasks.unshift(taskValidation.sanitizedTask);
            
//             // Save to storage
//             this.saveTasks();
            
//             // Update UI
//             this.render();
            
//             // Show success message
//             showValidationMessage('Task added successfully!', 'success');
            
//             console.log('Task added:', newTask);
//             return true;
            
//         } catch (error) {
//             console.error('Error adding task:', error);
//             showValidationMessage('Failed to add task. Please try again.', 'error');
//             return false;
//         }
//     }
    
//     /**
//      * Remove a task
//      * @param {number} taskId - Task ID to remove
//      * @returns {boolean} - Success status
//      */
//     removeTask(taskId) {
//         try {
//             const taskIndex = this.tasks.findIndex(task => task.id === taskId);
            
//             if (taskIndex === -1) {
//                 console.warn('Task not found:', taskId);
//                 return false;
//             }
            
//             const removedTask = this.tasks.splice(taskIndex, 1)[0];
            
//             // Save to storage
//             this.saveTasks();
            
//             // Update UI
//             this.render();
            
//             console.log('Task removed:', removedTask);
//             return true;
            
//         } catch (error) {
//             console.error('Error removing task:', error);
//             return false;
//         }
//     }
    
//     /**
//      * Toggle task completion status
//      * @param {number} taskId - Task ID to toggle
//      * @returns {boolean} - Success status
//      */
//     toggleTaskCompletion(taskId) {
//         try {
//             const task = this.tasks.find(task => task.id === taskId);
            
//             if (!task) {
//                 console.warn('Task not found:', taskId);
//                 return false;
//             }
            
//             // Toggle completion status
//             task.completed = !task.completed;
            
//             // Save to storage
//             this.saveTasks();
            
//             // Update UI
//             this.render();
            
//             console.log('Task completion toggled:', task);
//             return true;
            
//         } catch (error) {
//             console.error('Error toggling task completion:', error);
//             return false;
//         }
//     }
    
//     /**
//      * Clear all completed tasks
//      * @returns {boolean} - Success status
//      */
//     clearCompletedTasks() {
//         try {
//             const completedCount = this.tasks.filter(task => task.completed).length;
            
//             if (completedCount === 0) {
//                 showValidationMessage('No completed tasks to clear', 'warning');
//                 return false;
//             }
            
//             // Remove completed tasks
//             this.tasks = this.tasks.filter(task => !task.completed);
            
//             // Save to storage
//             this.saveTasks();
            
//             // Update UI
//             this.render();
            
//             showValidationMessage(`${completedCount} completed task(s) cleared`, 'success');
//             console.log('Completed tasks cleared:', completedCount);
//             return true;
            
//         } catch (error) {
//             console.error('Error clearing completed tasks:', error);
//             showValidationMessage('Failed to clear completed tasks', 'error');
//             return false;
//         }
//     }
    
//     /**
//      * Save tasks to storage
//      */
//     saveTasks() {
//         try {
//             const success = saveTasks(this.tasks);
//             if (!success) {
//                 console.warn('Failed to save tasks to storage');
//             }
//         } catch (error) {
//             console.error('Error saving tasks:', error);
//         }
//     }
    
//     /**
//      * Render the application state
//      */
//     render() {
//         try {
//             // Render task list
//             renderTaskList(this.elements.taskList, this.tasks, this.currentFilter);
            
//             // Update task count
//             updateTaskCount(this.tasks);
            
//             // Update filter buttons
//             updateFilterButtons(this.currentFilter);
            
//         } catch (error) {
//             console.error('Error rendering application:', error);
//         }
//     }
    
//     /**
//      * Show confirmation modal
//      * @param {string} message - Modal message
//      * @param {Function} onConfirm - Confirmation callback
//      */
//     showConfirmModal(message, onConfirm) {
//         this.elements.modalMessage.textContent = message;
//         this.elements.confirmModal.hidden = false;
//         this.pendingConfirmAction = onConfirm;
        
//         // Focus modal for accessibility
//         this.elements.modalConfirm.focus();
//     }
    
//     /**
//      * Hide confirmation modal
//      */
//     hideConfirmModal() {
//         this.elements.confirmModal.hidden = true;
//         this.pendingConfirmAction = null;
//     }
    
//     /**
//      * Show error message
//      * @param {string} message - Error message
//      */
//     showError(message) {
//         console.error('Application error:', message);
//         showValidationMessage(message, 'error');
//     }
    
//     // Event Handlers
    
//     /**
//      * Handle form submission
//      * @param {Event} event - Form submit event
//      */
//     handleFormSubmit(event) {
//         event.preventDefault();
        
//         const taskText = this.elements.taskInput.value;
        
//         if (this.addTask(taskText)) {
//             // Clear input on success
//             this.elements.taskInput.value = '';
//             this.elements.taskInput.focus();
//         }
//     }
    
//     /**
//      * Handle task list clicks (event delegation)
//      * @param {Event} event - Click event
//      */
//     handleTaskListClick(event) {
//         const taskElement = event.target.closest('.task-item');
//         if (!taskElement) return;
        
//         const taskId = Number(taskElement.dataset.id);
        
//         // Handle checkbox clicks
//         if (event.target.classList.contains('task-checkbox')) {
//             event.preventDefault(); // Prevent default checkbox behavior
//             this.toggleTaskCompletion(taskId);
//             return;
//         }
        
//         // Handle delete button clicks
//         if (event.target.classList.contains('delete-btn')) {
//             const task = this.tasks.find(t => t.id === taskId);
//             const message = `Are you sure you want to delete "${task.text}"?`;
            
//             this.showConfirmModal(message, () => {
//                 this.removeTask(taskId);
//                 this.hideConfirmModal();
//             });
//             return;
//         }
        
//         // Handle edit button clicks (future enhancement)
//         if (event.target.classList.contains('edit-btn')) {
//             console.log('Edit functionality not implemented yet');
//             showValidationMessage('Edit functionality coming soon!', 'warning');
//             return;
//         }
//     }
    
//     /**
//      * Handle filter button clicks
//      * @param {Event} event - Click event
//      */
//     handleFilterClick(event) {
//         const filter = event.target.dataset.filter;
        
//         if (filter && filter !== this.currentFilter) {
//             this.currentFilter = filter;
//             this.render();
//         }
//     }
    
//     /**
//      * Handle clear completed button click
//      * @param {Event} event - Click event
//      */
//     handleClearCompleted(event) {
//         const completedCount = this.tasks.filter(task => task.completed).length;
        
//         if (completedCount === 0) {
//             showValidationMessage('No completed tasks to clear', 'warning');
//             return;
//         }
        
//         const message = `Are you sure you want to clear ${completedCount} completed task(s)?`;
        
//         this.showConfirmModal(message, () => {
//             this.clearCompletedTasks();
//             this.hideConfirmModal();
//         });
//     }
    
//     /**
//      * Handle modal confirmation
//      * @param {Event} event - Click event
//      */
//     handleModalConfirm(event) {
//         if (this.pendingConfirmAction) {
//             this.pendingConfirmAction();
//         }
//     }
    
//     /**
//      * Handle modal cancellation
//      * @param {Event} event - Click event
//      */
//     handleModalCancel(event) {
//         this.hideConfirmModal();
//     }
    
//     /**
//      * Handle keyboard shortcuts
//      * @param {Event} event - Keydown event
//      */
//     handleKeydown(event) {
//         // Escape key to close modal
//         if (event.key === 'Escape' && !this.elements.confirmModal.hidden) {
//             this.hideConfirmModal();
//             return;
//         }
        
//         // Ctrl/Cmd + Enter to submit form
//         if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
//             if (document.activeElement === this.elements.taskInput) {
//                 this.elements.taskForm.dispatchEvent(new Event('submit'));
//             }
//         }
        
//         // Ctrl/Cmd + / to focus input
//         if ((event.ctrlKey || event.metaKey) && event.key === '/') {
//             event.preventDefault();
//             this.elements.taskInput.focus();
//         }
//     }
    
//     /**
//      * Clean up application resources
//      */
//     destroy() {
//         // Remove event listeners
//         if (this.validationCleanup) {
//             this.validationCleanup();
//         }
        
//         // Save tasks before destroying
//         this.saveTasks();
        
//         console.log('TaskFlow Lite destroyed');
//     }
// }

// // Initialize application when DOM is ready
// document.addEventListener('DOMContentLoaded', () => {
//     window.taskFlowApp = new TaskFlowApp();
// });

// // Handle page unload
// window.addEventListener('beforeunload', () => {
//     if (window.taskFlowApp) {
//         window.taskFlowApp.destroy();
//     }
// });

// // Export for testing/debugging
// if (typeof module !== 'undefined' && module.exports) {
//     module.exports = TaskFlowApp;
// } 