/**
 * Render Module - DOM manipulation functions for TaskFlow Lite
 * Handles dynamic rendering of task lists and UI updates
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Create a task element with all necessary attributes and event handlers
 * @param {Object} task - Task object
 * @returns {HTMLElement} - Task list item element
 */
export const createTaskElement = (task) => {
    const taskElement = document.createElement('li');
    taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
    taskElement.dataset.id = task.id;
    taskElement.dataset.completed = task.completed;
    
    // Set ARIA attributes for accessibility
    taskElement.setAttribute('role', 'listitem');
    taskElement.setAttribute('aria-label', `Task: ${escapeHTML(task.text)}`);
    
    taskElement.innerHTML = `
        <div class="task-content">
            <input 
                type="checkbox" 
                class="task-checkbox" 
                ${task.completed ? 'checked' : ''}
                aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}"
            >
            <span class="task-text">${escapeHTML(task.text)}</span>
        </div>
        <div class="task-actions">
            <button class="action-btn edit-btn" aria-label="Edit task" title="Edit task">
                ✏️
            </button>
            <button class="action-btn delete-btn" aria-label="Delete task" title="Delete task">
                🗑️
            </button>
        </div>
    `;
    
    return taskElement;
};

/**
 * Render the complete task list with efficient DOM updates
 * @param {HTMLElement} taskListElement - The task list container
 * @param {Array} tasks - Array of task objects
 * @param {string} filter - Current filter ('all', 'active', 'completed')
 */
export const renderTaskList = (taskListElement, tasks, filter = 'all') => {
    if (!taskListElement) {
        console.error('Task list element not found');
        return;
    }
    
    // Filter tasks based on current filter
    const filteredTasks = filterTasks(tasks, filter);
    
    // Clear existing content
    taskListElement.innerHTML = '';
    
    // Show empty state if no tasks
    if (filteredTasks.length === 0) {
        showEmptyState(taskListElement, filter);
        return;
    }
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Render each task
    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        fragment.appendChild(taskElement);
    });
    
    // Append all tasks at once
    taskListElement.appendChild(fragment);
    
    // Update task count display
    updateTaskCount(tasks);
    
    console.log(`Rendered ${filteredTasks.length} tasks (filter: ${filter})`);
};

/**
 * Filter tasks based on completion status
 * @param {Array} tasks - Array of task objects
 * @param {string} filter - Filter type ('all', 'active', 'completed')
 * @returns {Array} - Filtered tasks
 */
export const filterTasks = (tasks, filter) => {
    switch (filter) {
        case 'active':
            return tasks.filter(task => !task.completed);
        case 'completed':
            return tasks.filter(task => task.completed);
        case 'all':
        default:
            return tasks;
    }
};

/**
 * Show empty state message
 * @param {HTMLElement} taskListElement - The task list container
 * @param {string} filter - Current filter
 */
export const showEmptyState = (taskListElement, filter) => {
    const emptyStateElement = document.getElementById('empty-state');
    
    if (emptyStateElement) {
        const icon = emptyStateElement.querySelector('.empty-state-icon');
        const title = emptyStateElement.querySelector('.empty-state-title');
        const description = emptyStateElement.querySelector('.empty-state-description');
        
        // Update empty state based on filter
        switch (filter) {
            case 'active':
                icon.textContent = '📝';
                title.textContent = 'No active tasks';
                description.textContent = 'All tasks are completed!';
                break;
            case 'completed':
                icon.textContent = '✅';
                title.textContent = 'No completed tasks';
                description.textContent = 'Complete some tasks to see them here.';
                break;
            default:
                icon.textContent = '📝';
                title.textContent = 'No tasks yet';
                description.textContent = 'Add your first task to get started!';
        }
        
        emptyStateElement.hidden = false;
    }
    
    // Hide the task list
    taskListElement.style.display = 'none';
};

/**
 * Hide empty state and show task list
 * @param {HTMLElement} taskListElement - The task list container
 */
export const hideEmptyState = (taskListElement) => {
    const emptyStateElement = document.getElementById('empty-state');
    if (emptyStateElement) {
        emptyStateElement.hidden = true;
    }
    
    taskListElement.style.display = 'block';
};

/**
 * Update task count display
 * @param {Array} tasks - Array of task objects
 */
export const updateTaskCount = (tasks) => {
    const totalTasksElement = document.getElementById('total-tasks');
    const completedTasksElement = document.getElementById('completed-tasks');
    
    if (totalTasksElement) {
        totalTasksElement.textContent = tasks.length;
    }
    
    if (completedTasksElement) {
        const completedCount = tasks.filter(task => task.completed).length;
        completedTasksElement.textContent = completedCount;
    }
};

/**
 * Update filter buttons state
 * @param {string} activeFilter - Currently active filter
 */
export const updateFilterButtons = (activeFilter) => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        const filter = button.dataset.filter;
        if (filter === activeFilter) {
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
        } else {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false');
        }
    });
};

/**
 * Add a single task to the list (for performance when adding new tasks)
 * @param {HTMLElement} taskListElement - The task list container
 * @param {Object} task - Task object to add
 * @param {string} filter - Current filter
 */
export const addTaskToList = (taskListElement, task, filter = 'all') => {
    // Hide empty state if it's showing
    hideEmptyState(taskListElement);
    
    // Check if task should be visible with current filter
    const shouldShow = filter === 'all' || 
                      (filter === 'active' && !task.completed) ||
                      (filter === 'completed' && task.completed);
    
    if (shouldShow) {
        const taskElement = createTaskElement(task);
        
        // Add to beginning of list for new tasks
        if (taskListElement.firstChild) {
            taskListElement.insertBefore(taskElement, taskListElement.firstChild);
        } else {
            taskListElement.appendChild(taskElement);
        }
    }
    
    // Update task count
    const currentTasks = Array.from(taskListElement.children).map(el => ({
        id: Number(el.dataset.id),
        text: el.querySelector('.task-text').textContent,
        completed: el.dataset.completed === 'true'
    }));
    
    updateTaskCount(currentTasks);
};

/**
 * Remove a task from the list
 * @param {HTMLElement} taskListElement - The task list container
 * @param {number} taskId - ID of task to remove
 */
export const removeTaskFromList = (taskListElement, taskId) => {
    const taskElement = taskListElement.querySelector(`[data-id="${taskId}"]`);
    
    if (taskElement) {
        // Add removal animation
        taskElement.style.transition = 'all 0.3s ease';
        taskElement.style.opacity = '0';
        taskElement.style.transform = 'translateX(-100%)';
        
        setTimeout(() => {
            taskElement.remove();
            
            // Check if list is now empty
            if (taskListElement.children.length === 0) {
                showEmptyState(taskListElement, 'all');
            }
            
            // Update task count
            const currentTasks = Array.from(taskListElement.children).map(el => ({
                id: Number(el.dataset.id),
                text: el.querySelector('.task-text').textContent,
                completed: el.dataset.completed === 'true'
            }));
            
            updateTaskCount(currentTasks);
        }, 300);
    }
};

/**
 * Update a task's completion status in the DOM
 * @param {HTMLElement} taskElement - The task element to update
 * @param {boolean} completed - New completion status
 */
export const updateTaskCompletion = (taskElement, completed) => {
    if (!taskElement) return;
    
    const checkbox = taskElement.querySelector('.task-checkbox');
    const taskText = taskElement.querySelector('.task-text');
    
    if (checkbox) {
        checkbox.checked = completed;
        checkbox.setAttribute('aria-label', `Mark task as ${completed ? 'incomplete' : 'complete'}`);
    }
    
    if (taskText) {
        if (completed) {
            taskElement.classList.add('completed');
            taskText.style.textDecoration = 'line-through';
            taskText.style.color = 'var(--text-muted)';
        } else {
            taskElement.classList.remove('completed');
            taskText.style.textDecoration = 'none';
            taskText.style.color = 'var(--text-primary)';
        }
    }
    
    taskElement.dataset.completed = completed;
};

/**
 * Show validation message
 * @param {string} message - Validation message to display
 * @param {string} type - Message type ('error', 'warning', 'success')
 */
export const showValidationMessage = (message, type = 'error') => {
    const validationElement = document.getElementById('validation-message');
    
    if (validationElement) {
        validationElement.textContent = message;
        validationElement.className = `validation-message validation-${type}`;
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                validationElement.textContent = '';
            }, 3000);
        }
    }
};

/**
 * Clear validation message
 */
export const clearValidationMessage = () => {
    const validationElement = document.getElementById('validation-message');
    if (validationElement) {
        validationElement.textContent = '';
    }
};

/**
 * Show loading state
 * @param {HTMLElement} element - Element to show loading state for
 */
export const showLoading = (element) => {
    if (element) {
        element.classList.add('loading');
        element.setAttribute('aria-busy', 'true');
    }
};

/**
 * Hide loading state
 * @param {HTMLElement} element - Element to hide loading state for
 */
export const hideLoading = (element) => {
    if (element) {
        element.classList.remove('loading');
        element.setAttribute('aria-busy', 'false');
    }
};

/**
 * Animate element entrance
 * @param {HTMLElement} element - Element to animate
 * @param {string} animation - Animation type ('fade', 'slide', 'scale')
 */
export const animateElement = (element, animation = 'fade') => {
    if (!element) return;
    
    element.style.opacity = '0';
    element.style.transform = animation === 'slide' ? 'translateY(20px)' : 
                             animation === 'scale' ? 'scale(0.9)' : 'none';
    
    // Trigger animation
    requestAnimationFrame(() => {
        element.style.transition = 'all 0.3s ease';
        element.style.opacity = '1';
        element.style.transform = 'none';
        
        // Clean up after animation
        setTimeout(() => {
            element.style.transition = '';
        }, 300);
    });
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function for performance optimization
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}; 