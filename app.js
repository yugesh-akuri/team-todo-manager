// Application Data and State
let appData = {
    sections: [],
    todos: [],
    teamMembers: [],
    settings: {
        theme: 'light'
    }
};

// Default data from the provided JSON
const defaultData = {
    sections: [
        {"id": "finance", "name": "Finance", "color": "#4CAF50", "isDefault": true},
        {"id": "it", "name": "IT", "color": "#2196F3", "isDefault": true},
        {"id": "management", "name": "Management", "color": "#FF9800", "isDefault": true},
        {"id": "legal", "name": "Legal Approvals", "color": "#9C27B0", "isDefault": true},
        {"id": "designing", "name": "Designing", "color": "#E91E63", "isDefault": true}
    ],
    todos: [
        {
            "id": "todo1",
            "title": "Review Q4 Budget",
            "description": "Analyze quarterly expenses and prepare budget report",
            "sectionId": "finance",
            "status": "todo",
            "assignedTo": "john@example.com",
            "createdAt": "2024-01-15T10:00:00Z",
            "modifiedAt": "2024-01-15T10:00:00Z"
        },
        {
            "id": "todo2", 
            "title": "Server Maintenance",
            "description": "Schedule monthly server updates and security patches",
            "sectionId": "it",
            "status": "in-progress",
            "assignedTo": "sarah@example.com",
            "createdAt": "2024-01-14T14:30:00Z",
            "modifiedAt": "2024-01-16T09:15:00Z"
        },
        {
            "id": "todo3",
            "title": "Team Performance Review",
            "description": "Conduct quarterly performance evaluations",
            "sectionId": "management", 
            "status": "completed",
            "assignedTo": "mike@example.com",
            "createdAt": "2024-01-10T11:00:00Z",
            "modifiedAt": "2024-01-18T16:45:00Z"
        }
    ],
    teamMembers: [
        {"id": "1", "name": "John Doe", "email": "john@example.com", "online": true},
        {"id": "2", "name": "Sarah Smith", "email": "sarah@example.com", "online": false},
        {"id": "3", "name": "Mike Johnson", "email": "mike@example.com", "online": true}
    ]
};

const statusOptions = [
    {"value": "todo", "label": "To Do", "color": "#f44336"},
    {"value": "in-progress", "label": "In Progress", "color": "#ff9800"},  
    {"value": "completed", "label": "Completed", "color": "#4caf50"}
];

// Utility Functions
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function saveData() {
    localStorage.setItem('teamTodoApp', JSON.stringify(appData));
}

function loadData() {
    const saved = localStorage.getItem('teamTodoApp');
    if (saved) {
        appData = JSON.parse(saved);
    } else {
        // Initialize with default data
        appData = {
            sections: [...defaultData.sections],
            todos: [...defaultData.todos],
            teamMembers: [...defaultData.teamMembers],
            settings: { theme: 'light' }
        };
        saveData();
    }
}

// Theme Management
function initTheme() {
    const savedTheme = appData.settings.theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    document.documentElement.setAttribute('data-color-scheme', theme);
    appData.settings.theme = theme;
    updateThemeIcon(theme);
}

function toggleTheme() {
    const currentTheme = appData.settings.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-color-scheme', newTheme);
    appData.settings.theme = newTheme;
    updateThemeIcon(newTheme);
    saveData();
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });
}

// Section Management
function renderSections() {
    const container = document.getElementById('sectionsContainer');
    if (!container) return;
    
    container.innerHTML = '';

    const filteredSections = getFilteredSections();
    
    filteredSections.forEach(section => {
        const sectionElement = createSectionElement(section);
        container.appendChild(sectionElement);
    });
}

function getFilteredSections() {
    return appData.sections.filter(section => {
        const sectionTodos = getTodosForSection(section.id);
        return sectionTodos.length > 0 || section.isDefault;
    });
}

function createSectionElement(section) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'section';
    sectionDiv.style.setProperty('--section-color', section.color);

    const todos = getTodosForSection(section.id);
    const todoCount = todos.length;

    sectionDiv.innerHTML = `
        <div class="section__header">
            <h3 class="section__title">
                ${section.name}
                <span class="section__count">${todoCount}</span>
            </h3>
            <div class="section__actions">
                <button class="section__toggle" data-section-id="${section.id}">−</button>
                ${!section.isDefault ? `<button class="section__delete" data-section-id="${section.id}" title="Delete Section">🗑️</button>` : ''}
            </div>
        </div>
        <div class="section__content" id="content_${section.id}">
            <button class="section__add" data-section-id="${section.id}">+ Add Todo</button>
            <div class="todos" id="todos_${section.id}">
                ${todos.map(todo => createTodoElement(todo)).join('')}
            </div>
        </div>
    `;

    return sectionDiv;
}

function getTodosForSection(sectionId) {
    return getFilteredTodos().filter(todo => todo.sectionId === sectionId);
}

function getFilteredTodos() {
    let filtered = [...appData.todos];

    // Apply search filter
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filtered = filtered.filter(todo => 
            todo.title.toLowerCase().includes(searchTerm) ||
            (todo.description && todo.description.toLowerCase().includes(searchTerm))
        );
    }

    // Apply status filter
    const statusFilter = document.getElementById('statusFilter');
    const statusValue = statusFilter ? statusFilter.value : '';
    if (statusValue) {
        filtered = filtered.filter(todo => todo.status === statusValue);
    }

    // Apply member filter
    const memberFilter = document.getElementById('memberFilter');
    const memberValue = memberFilter ? memberFilter.value : '';
    if (memberValue) {
        filtered = filtered.filter(todo => todo.assignedTo === memberValue);
    }

    // Apply sorting
    const sortBy = document.getElementById('sortBy');
    const sortValue = sortBy ? sortBy.value : 'created';
    filtered.sort((a, b) => {
        switch (sortValue) {
            case 'created':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'modified':
                return new Date(b.modifiedAt) - new Date(a.modifiedAt);
            case 'title':
                return a.title.localeCompare(b.title);
            default:
                return 0;
        }
    });

    return filtered;
}

function toggleSection(sectionId) {
    const content = document.getElementById(`content_${sectionId}`);
    const toggle = document.querySelector(`[data-section-id="${sectionId}"].section__toggle`);
    
    if (content && toggle) {
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            toggle.textContent = '−';
        } else {
            content.classList.add('collapsed');
            toggle.textContent = '+';
        }
    }
}

function deleteSection(sectionId) {
    const section = appData.sections.find(s => s.id === sectionId);
    const todosInSection = appData.todos.filter(t => t.sectionId === sectionId);
    
    if (todosInSection.length > 0) {
        alert(`Cannot delete "${section.name}" because it contains ${todosInSection.length} todo(s). Please move or delete the todos first.`);
        return;
    }

    if (confirm(`Are you sure you want to delete the section "${section.name}"?`)) {
        appData.sections = appData.sections.filter(s => s.id !== sectionId);
        saveData();
        renderSections();
    }
}

// Todo Management
function createTodoElement(todo) {
    const assignedMember = appData.teamMembers.find(m => m.email === todo.assignedTo);
    const memberName = assignedMember ? assignedMember.name : todo.assignedTo || 'Unassigned';

    return `
        <div class="todo" data-id="${todo.id}">
            <div class="todo__header">
                <textarea class="todo__title" data-todo-id="${todo.id}" data-field="title">${todo.title}</textarea>
                <div class="todo__actions">
                    <button class="todo__delete" data-todo-id="${todo.id}" title="Delete Todo">🗑️</button>
                </div>
            </div>
            <textarea class="todo__description" placeholder="Add description..." 
                      data-todo-id="${todo.id}" data-field="description">${todo.description || ''}</textarea>
            <div class="todo__meta">
                <select class="todo__status" data-status="${todo.status}" data-todo-id="${todo.id}">
                    ${statusOptions.map(option => 
                        `<option value="${option.value}" ${option.value === todo.status ? 'selected' : ''}>${option.label}</option>`
                    ).join('')}
                </select>
                <select class="todo__assigned" data-todo-id="${todo.id}">
                    <option value="">Unassigned</option>
                    ${appData.teamMembers.map(member => 
                        `<option value="${member.email}" ${member.email === todo.assignedTo ? 'selected' : ''}>${member.name}</option>`
                    ).join('')}
                </select>
                <div class="todo__timestamps">
                    <div>Created: ${formatDate(todo.createdAt)}</div>
                    <div>Modified: ${formatDate(todo.modifiedAt)}</div>
                </div>
            </div>
        </div>
    `;
}

function addTodo(sectionId) {
    const newTodo = {
        id: generateId(),
        title: 'New Todo',
        description: '',
        sectionId: sectionId,
        status: 'todo',
        assignedTo: '',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
    };

    appData.todos.push(newTodo);
    saveData();
    renderSections();
    updateFilters();

    // Focus on the new todo title
    setTimeout(() => {
        const todoElement = document.querySelector(`[data-id="${newTodo.id}"] .todo__title`);
        if (todoElement) {
            todoElement.select();
            todoElement.focus();
        }
    }, 100);
}

function updateTodo(todoId, field, value) {
    const todo = appData.todos.find(t => t.id === todoId);
    if (!todo) return;

    todo[field] = value;
    todo.modifiedAt = new Date().toISOString();
    
    saveData();
    
    // Re-render if status changed (affects filtering and display)
    if (field === 'status' || field === 'assignedTo') {
        renderSections();
        updateFilters();
    }
}

function deleteTodo(todoId) {
    const todo = appData.todos.find(t => t.id === todoId);
    if (confirm(`Are you sure you want to delete "${todo.title}"?`)) {
        appData.todos = appData.todos.filter(t => t.id !== todoId);
        saveData();
        renderSections();
        updateFilters();
    }
}

// Team Management
function renderTeamList() {
    const container = document.getElementById('teamList');
    if (!container) return;
    
    container.innerHTML = '';

    appData.teamMembers.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'team-member';
        memberDiv.innerHTML = `
            <div class="team-member__info">
                <div class="team-member__name">${member.name}</div>
                <div class="team-member__email">${member.email}</div>
            </div>
            <div class="team-member__status">
                <div class="status-indicator ${member.online ? 'online' : ''}"></div>
                <span>${member.online ? 'Online' : 'Offline'}</span>
                <button class="team-member__remove" data-member-id="${member.id}" title="Remove Member">🗑️</button>
            </div>
        `;
        container.appendChild(memberDiv);
    });
}

function addMember() {
    const nameInput = document.getElementById('memberName');
    const emailInput = document.getElementById('memberEmail');
    
    if (!nameInput || !emailInput) return;
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name || !email) {
        alert('Please enter both name and email');
        return;
    }

    if (appData.teamMembers.find(m => m.email === email)) {
        alert('Member with this email already exists');
        return;
    }

    const newMember = {
        id: generateId(),
        name: name,
        email: email,
        online: Math.random() > 0.5 // Random online status for demo
    };

    appData.teamMembers.push(newMember);
    saveData();
    renderTeamList();
    updateFilters();

    // Clear form
    nameInput.value = '';
    emailInput.value = '';
}

function removeMember(memberId) {
    const member = appData.teamMembers.find(m => m.id === memberId);
    if (confirm(`Are you sure you want to remove ${member.name} from the team?`)) {
        appData.teamMembers = appData.teamMembers.filter(m => m.id !== memberId);
        
        // Unassign todos from removed member
        appData.todos.forEach(todo => {
            if (todo.assignedTo === member.email) {
                todo.assignedTo = '';
                todo.modifiedAt = new Date().toISOString();
            }
        });

        saveData();
        renderTeamList();
        renderSections();
        updateFilters();
    }
}

// Filter and Search
function updateFilters() {
    const memberFilter = document.getElementById('memberFilter');
    if (!memberFilter) return;
    
    const currentValue = memberFilter.value;
    
    memberFilter.innerHTML = '<option value="">All Members</option>';
    appData.teamMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.email;
        option.textContent = member.name;
        if (member.email === currentValue) option.selected = true;
        memberFilter.appendChild(option);
    });
}

function applyFilters() {
    renderSections();
}

// Statistics
function showStatistics() {
    const container = document.getElementById('statsContent');
    if (!container) return;
    
    const stats = calculateStatistics();
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-card__value">${stats.totalTodos}</div>
            <div class="stat-card__label">Total Todos</div>
        </div>
        <div class="stat-card">
            <div class="stat-card__value">${stats.completedTodos}</div>
            <div class="stat-card__label">Completed</div>
        </div>
        <div class="stat-card">
            <div class="stat-card__value">${stats.inProgressTodos}</div>
            <div class="stat-card__label">In Progress</div>
        </div>
        <div class="stat-card">
            <div class="stat-card__value">${stats.todoTodos}</div>
            <div class="stat-card__label">To Do</div>
        </div>
        <div class="stat-card">
            <div class="stat-card__value">${stats.completionRate}%</div>
            <div class="stat-card__label">Completion Rate</div>
        </div>
        <div class="stat-card">
            <div class="stat-card__value">${stats.activeSections}</div>
            <div class="stat-card__label">Active Sections</div>
        </div>
    `;
    
    showModal('statsModal');
}

function calculateStatistics() {
    const totalTodos = appData.todos.length;
    const completedTodos = appData.todos.filter(t => t.status === 'completed').length;
    const inProgressTodos = appData.todos.filter(t => t.status === 'in-progress').length;
    const todoTodos = appData.todos.filter(t => t.status === 'todo').length;
    const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    const activeSections = appData.sections.filter(s => appData.todos.some(t => t.sectionId === s.id)).length;

    return {
        totalTodos,
        completedTodos,
        inProgressTodos,
        todoTodos,
        completionRate,
        activeSections
    };
}

// Data Import/Export
function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-todo-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}

function importData() {
    const fileInput = document.getElementById('importFile');
    if (fileInput) {
        fileInput.click();
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Validate imported data structure
            if (importedData.sections && importedData.todos && importedData.teamMembers) {
                if (confirm('This will replace all current data. Are you sure?')) {
                    appData = importedData;
                    saveData();
                    initApp();
                }
            } else {
                alert('Invalid file format');
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('This will delete all sections, todos, and team members. This action cannot be undone.')) {
        localStorage.removeItem('teamTodoApp');
        appData = {
            sections: [...defaultData.sections],
            todos: [],
            teamMembers: [],
            settings: { theme: appData.settings.theme }
        };
        saveData();
        initApp();
    }
}

// Event Listeners
function setupEventListeners() {
    // Theme toggle
    document.addEventListener('click', (e) => {
        if (e.target.id === 'themeToggle' || e.target.closest('#themeToggle')) {
            toggleTheme();
        }
        
        // Team button
        if (e.target.id === 'teamButton') {
            showModal('teamModal');
            renderTeamList();
        }
        
        // Settings button
        if (e.target.id === 'settingsButton') {
            showModal('settingsModal');
        }
        
        // Stats button
        if (e.target.id === 'statsButton') {
            showStatistics();
        }
        
        // Add section button
        if (e.target.id === 'addSectionBtn') {
            showModal('addSectionModal');
            const input = document.getElementById('newSectionName');
            if (input) input.focus();
        }
        
        // Section toggle
        if (e.target.classList.contains('section__toggle')) {
            const sectionId = e.target.dataset.sectionId;
            toggleSection(sectionId);
        }
        
        // Section delete
        if (e.target.classList.contains('section__delete')) {
            const sectionId = e.target.dataset.sectionId;
            deleteSection(sectionId);
        }
        
        // Add todo
        if (e.target.classList.contains('section__add')) {
            const sectionId = e.target.dataset.sectionId;
            addTodo(sectionId);
        }
        
        // Delete todo
        if (e.target.classList.contains('todo__delete')) {
            const todoId = e.target.dataset.todoId;
            deleteTodo(todoId);
        }
        
        // Add member
        if (e.target.id === 'addMemberBtn') {
            addMember();
        }
        
        // Remove member
        if (e.target.classList.contains('team-member__remove')) {
            const memberId = e.target.dataset.memberId;
            removeMember(memberId);
        }
        
        // Modal close buttons
        if (e.target.classList.contains('modal__close') || e.target.classList.contains('modal__overlay')) {
            hideAllModals();
        }
        
        // Export/Import/Clear buttons
        if (e.target.id === 'exportBtn') {
            exportData();
        }
        if (e.target.id === 'importBtn') {
            importData();
        }
        if (e.target.id === 'clearDataBtn') {
            clearAllData();
        }
        
        // Add section modal buttons
        if (e.target.id === 'cancelAddSection') {
            hideModal('addSectionModal');
        }
        if (e.target.id === 'confirmAddSection') {
            const nameInput = document.getElementById('newSectionName');
            const colorInput = document.getElementById('selectedColor');
            
            if (!nameInput || !colorInput) return;
            
            const name = nameInput.value.trim();
            const color = colorInput.value;
            
            if (!name) {
                alert('Please enter a section name');
                return;
            }
            
            const newSection = {
                id: generateId(),
                name: name,
                color: color,
                isDefault: false
            };
            
            appData.sections.push(newSection);
            saveData();
            renderSections();
            
            hideModal('addSectionModal');
            nameInput.value = '';
        }
        
        // Color picker
        if (e.target.classList.contains('color-option')) {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            const selectedColorInput = document.getElementById('selectedColor');
            if (selectedColorInput) {
                selectedColorInput.value = e.target.dataset.color;
            }
        }
    });
    
    // Change events for todo fields
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('todo__status')) {
            const todoId = e.target.dataset.todoId;
            updateTodo(todoId, 'status', e.target.value);
        }
        
        if (e.target.classList.contains('todo__assigned')) {
            const todoId = e.target.dataset.todoId;
            updateTodo(todoId, 'assignedTo', e.target.value);
        }
        
        // Filter changes
        if (e.target.id === 'statusFilter' || e.target.id === 'memberFilter' || e.target.id === 'sortBy') {
            applyFilters();
        }
        
        // Import file
        if (e.target.id === 'importFile') {
            handleFileImport(e);
        }
    });
    
    // Input events
    document.addEventListener('input', (e) => {
        if (e.target.id === 'searchInput') {
            applyFilters();
        }
    });
    
    // Blur events for todo text fields
    document.addEventListener('blur', (e) => {
        if (e.target.classList.contains('todo__title')) {
            const todoId = e.target.dataset.todoId;
            updateTodo(todoId, 'title', e.target.value);
        }
        
        if (e.target.classList.contains('todo__description')) {
            const todoId = e.target.dataset.todoId;
            updateTodo(todoId, 'description', e.target.value);
        }
    });
    
    // Keydown events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllModals();
        }
        
        if (e.target.classList.contains('todo__title') && e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
    });
}

// Application Initialization
function initApp() {
    loadData();
    initTheme();
    setupEventListeners();
    renderSections();
    updateFilters();
    
    // Set default color selection in add section modal
    const firstColorOption = document.querySelector('.color-option');
    if (firstColorOption) {
        firstColorOption.classList.add('selected');
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initApp);