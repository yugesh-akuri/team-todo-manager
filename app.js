// Firebase v9 Modular SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  enableNetwork,
  disableNetwork,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCU_gj_SKAzLGu498JMxRbZZJiuYjvmkZs",
  authDomain: "team-todo-manager.firebaseapp.com",
  projectId: "team-todo-manager",
  storageBucket: "team-todo-manager.firebasestorage.app",
  messagingSenderId: "1092735143588",
  appId: "1:1092735143588:web:f6ba1ea9acb6146e8ee031",
  measurementId: "G-SXE5QMQPP8",
};

// Check if Firebase config is properly set
const isFirebaseConfigured =
  firebaseConfig.apiKey !== "AIzaSyCU_gj_SKAzLGu498JMxRbZZJiuYjvmkZs";

// Initialize Firebase (only if configured)
let app, auth, db;
let isUsingMockData = false;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    isUsingMockData = true;
  }
} else {
  console.log("Firebase not configured - using demo mode with mock data");
  isUsingMockData = true;
}

// Application State
let appState = {
  currentUser: null,
  sections: [],
  todos: [],
  teamMembers: [],
  settings: { theme: "light" },
  isOnline: navigator.onLine,
  unsubscribers: [],
  lastSync: null,
  isAuthenticated: false,
};

// Default sections data
const defaultSections = [
  { id: "finance", name: "Finance", color: "#4CAF50", isDefault: true },
  { id: "it", name: "IT", color: "#2196F3", isDefault: true },
  { id: "management", name: "Management", color: "#FF9800", isDefault: true },
  { id: "legal", name: "Legal Approvals", color: "#9C27B0", isDefault: true },
  { id: "designing", name: "Designing", color: "#E91E63", isDefault: true },
];

// Mock data for demo mode
const mockData = {
  sections: [...defaultSections],
  todos: [
    {
      id: "todo1",
      title: "Review Q4 Budget",
      description: "Analyze quarterly expenses and prepare budget report",
      sectionId: "finance",
      status: "todo",
      assignedTo: "john@example.com",
      createdAt: new Date("2024-01-15T10:00:00Z"),
      modifiedAt: new Date("2024-01-15T10:00:00Z"),
      createdBy: "demo-user",
    },
    {
      id: "todo2",
      title: "Server Maintenance",
      description: "Schedule monthly server updates and security patches",
      sectionId: "it",
      status: "in-progress",
      assignedTo: "sarah@example.com",
      createdAt: new Date("2024-01-14T14:30:00Z"),
      modifiedAt: new Date("2024-01-16T09:15:00Z"),
      createdBy: "demo-user",
    },
    {
      id: "todo3",
      title: "Team Performance Review",
      description: "Conduct quarterly performance evaluations",
      sectionId: "management",
      status: "completed",
      assignedTo: "mike@example.com",
      createdAt: new Date("2024-01-10T11:00:00Z"),
      modifiedAt: new Date("2024-01-18T16:45:00Z"),
      createdBy: "demo-user",
    },
  ],
  teamMembers: [
    {
      id: "1",
      uid: "demo-user",
      name: "Demo User",
      email: "demo@example.com",
      online: true,
    },
    {
      id: "2",
      uid: "user2",
      name: "John Doe",
      email: "john@example.com",
      online: true,
    },
    {
      id: "3",
      uid: "user3",
      name: "Sarah Smith",
      email: "sarah@example.com",
      online: false,
    },
    {
      id: "4",
      uid: "user4",
      name: "Mike Johnson",
      email: "mike@example.com",
      online: true,
    },
  ],
};

const statusOptions = [
  { value: "todo", label: "To Do", color: "#f44336" },
  { value: "in-progress", label: "In Progress", color: "#ff9800" },
  { value: "completed", label: "Completed", color: "#4caf50" },
];

// Utility Functions
function generateId() {
  return "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function showNotification(message, type = "info") {
  const notification = document.getElementById("realtimeNotification");
  const text = document.getElementById("notificationText");

  if (notification && text) {
    text.textContent = message;
    notification.classList.remove("hidden");

    // Auto hide after 3 seconds
    setTimeout(() => {
      notification.classList.add("hidden");
    }, 3000);
  }
}

function updateConnectionStatus(status, message) {
  const statusEl = document.getElementById("connectionStatus");
  const textEl = document.getElementById("connectionText");

  if (statusEl && textEl) {
    textEl.textContent = message;
    statusEl.className = `connection-status ${status}`;

    if (status === "hidden") {
      statusEl.classList.add("hidden");
    } else {
      statusEl.classList.remove("hidden");
    }
  }
}

// Mock Firebase Service (for demo mode)
class MockFirebaseService {
  static async signUp(email, password, name) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (email === "error@test.com") {
      throw new Error("Demo error: Email already in use");
    }

    const user = {
      uid: generateId(),
      email: email,
      displayName: name,
    };

    return user;
  }

  static async signIn(email, password) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (password === "wrong") {
      throw new Error("Demo error: Incorrect password");
    }

    const user = {
      uid: "demo-user",
      email: email,
    };

    return user;
  }

  static async signOut() {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  }

  static async createTodo(todoData) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    appState.todos.push({
      ...todoData,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    renderSections();
    return todoData.id;
  }

  static async updateTodo(todoId, updates) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const todoIndex = appState.todos.findIndex((t) => t.id === todoId);
    if (todoIndex !== -1) {
      appState.todos[todoIndex] = {
        ...appState.todos[todoIndex],
        ...updates,
        modifiedAt: new Date(),
      };
      renderSections();
    }
  }

  static async deleteTodo(todoId) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    appState.todos = appState.todos.filter((t) => t.id !== todoId);
    renderSections();
  }

  static async createSection(sectionData) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    appState.sections.push({
      ...sectionData,
      createdAt: new Date(),
    });
    renderSections();
    return sectionData.id;
  }

  static async deleteSection(sectionId) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    appState.sections = appState.sections.filter((s) => s.id !== sectionId);
    renderSections();
  }

  static getUserName(userId) {
    const user = appState.teamMembers.find((u) => u.uid === userId);
    return user ? user.name : "Team member";
  }
}

// Firebase Service Functions
class FirebaseService {
  // Authentication Methods
  static async signUp(email, password, name) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        online: true,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      return user;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  static async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      return userCredential.user;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  static async signOut() {
    try {
      if (appState.currentUser) {
        await updateDoc(doc(db, "users", appState.currentUser.uid), {
          online: false,
          lastSeen: serverTimestamp(),
        });
      }
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  static getAuthErrorMessage(errorCode) {
    switch (errorCode) {
      case "auth/user-not-found":
        return "No account found with this email address.";
      case "auth/wrong-password":
        return "Incorrect password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/invalid-email":
        return "Invalid email address.";
      default:
        return "An error occurred. Please try again.";
    }
  }

  static getUserName(userId) {
    const user = appState.teamMembers.find((u) => u.uid === userId);
    return user ? user.name : "Team member";
  }
}

// Choose the appropriate service based on configuration
const ServiceAPI = isUsingMockData ? MockFirebaseService : FirebaseService;

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme || (prefersDark ? "dark" : "light");

  document.documentElement.setAttribute("data-color-scheme", theme);
  appState.settings.theme = theme;
  updateThemeIcon(theme);
}

function toggleTheme() {
  const currentTheme = appState.settings.theme;
  const newTheme = currentTheme === "light" ? "dark" : "light";

  document.documentElement.setAttribute("data-color-scheme", newTheme);
  appState.settings.theme = newTheme;
  updateThemeIcon(newTheme);
  localStorage.setItem("theme", newTheme);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById("themeIcon");
  if (themeIcon) {
    themeIcon.textContent = theme === "light" ? "🌙" : "☀️";
  }
}

// Authentication UI Management
function showAuthScreen() {
  document.getElementById("authContainer").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
}

function showMainApp() {
  document.getElementById("authContainer").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
}

function toggleAuthForm() {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const toggleText = document.getElementById("authToggleText");

  if (loginForm.classList.contains("hidden")) {
    // Show login form
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    toggleText.innerHTML =
      'Don\'t have an account? <button type="button" class="auth-link" id="authToggleBtn">Sign up</button>';

    // Clear signup errors
    hideAuthErrors();
  } else {
    // Show signup form
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
    toggleText.innerHTML =
      'Already have an account? <button type="button" class="auth-link" id="authToggleBtn">Sign in</button>';

    // Clear login errors
    hideAuthErrors();
  }
}

function showAuthError(message, formType = "login") {
  const errorElement = document.getElementById(
    formType === "login" ? "authError" : "signupError"
  );
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
  }
}

function hideAuthErrors() {
  const authError = document.getElementById("authError");
  const signupError = document.getElementById("signupError");
  if (authError) authError.classList.add("hidden");
  if (signupError) signupError.classList.add("hidden");
}

function showAuthLoading(show) {
  const loading = document.getElementById("authLoading");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const toggleSection = document.querySelector(".auth-toggle");

  if (show) {
    loading.classList.remove("hidden");
    loginForm.classList.add("hidden");
    signupForm.classList.add("hidden");
    toggleSection.classList.add("hidden");
  } else {
    loading.classList.add("hidden");
    // Show the appropriate form
    if (
      document
        .getElementById("authToggleText")
        .textContent.includes("Don't have an account?")
    ) {
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    } else {
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
    }
    toggleSection.classList.remove("hidden");
  }
}

// Modal Management
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

function hideAllModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  });
}

// User Info Updates
function updateUserInfo(user) {
  const nameElement = document.getElementById("currentUserName");
  if (nameElement && user) {
    const userData = appState.teamMembers.find((u) => u.uid === user.uid);
    nameElement.textContent = userData
      ? userData.name
      : user.email || "Demo User";
  }
}

function updateTeamInfo() {
  const onlineCount = appState.teamMembers.filter((m) => m.online).length;
  const onlineCountElement = document.getElementById("onlineCount");
  if (onlineCountElement) {
    onlineCountElement.textContent = onlineCount;
  }
}

function updateSettingsInfo() {
  const userIdDisplay = document.getElementById("userIdDisplay");
  const dbStatus = document.getElementById("dbStatus");
  const lastSyncDisplay = document.getElementById("lastSync");

  if (userIdDisplay && appState.currentUser) {
    userIdDisplay.textContent =
      appState.currentUser.uid.substring(0, 8) + "...";
  }

  if (dbStatus) {
    dbStatus.textContent = isUsingMockData
      ? "Demo Mode"
      : appState.isOnline
      ? "Connected"
      : "Offline";
  }

  if (lastSyncDisplay && appState.lastSync) {
    lastSyncDisplay.textContent = appState.lastSync.toLocaleTimeString();
  }
}

// Initialize demo data
function initializeDemoData() {
  appState.sections = [...mockData.sections];
  appState.todos = [...mockData.todos];
  appState.teamMembers = [...mockData.teamMembers];
  appState.lastSync = new Date();
}

// Section Management
function renderSections() {
  const container = document.getElementById("sectionsContainer");
  if (!container) return;

  // Clear loading state
  container.innerHTML = "";

  const filteredSections = getFilteredSections();

  if (filteredSections.length === 0) {
    container.innerHTML =
      '<div class="loading-sections"><p>No sections found. Add some todos to get started!</p></div>';
    return;
  }

  filteredSections.forEach((section) => {
    const sectionElement = createSectionElement(section);
    container.appendChild(sectionElement);
  });
}

function getFilteredSections() {
  return appState.sections.filter((section) => {
    const sectionTodos = getTodosForSection(section.id);
    return sectionTodos.length > 0 || section.isDefault;
  });
}

function createSectionElement(section) {
  const sectionDiv = document.createElement("div");
  sectionDiv.className = "section";
  sectionDiv.style.setProperty("--section-color", section.color);

  const todos = getTodosForSection(section.id);
  const todoCount = todos.length;
  const createdBy = section.createdBy
    ? ServiceAPI.getUserName(section.createdBy)
    : "";

  sectionDiv.innerHTML = `
        <div class="section__header">
            <h3 class="section__title">
                ${section.name}
                <span class="section__count">${todoCount}</span>
                ${
                  createdBy
                    ? `<span class="created-by">by ${createdBy}</span>`
                    : ""
                }
            </h3>
            <div class="section__actions">
                <button class="section__toggle" data-section-id="${
                  section.id
                }">−</button>
                ${
                  !section.isDefault
                    ? `<button class="section__delete" data-section-id="${section.id}" title="Delete Section">🗑️</button>`
                    : ""
                }
            </div>
        </div>
        <div class="section__content" id="content_${section.id}">
            <button class="section__add" data-section-id="${
              section.id
            }">+ Add Todo</button>
            <div class="todos" id="todos_${section.id}">
                ${todos.map((todo) => createTodoElement(todo)).join("")}
            </div>
        </div>
    `;

  return sectionDiv;
}

function getTodosForSection(sectionId) {
  return getFilteredTodos().filter((todo) => todo.sectionId === sectionId);
}

function getFilteredTodos() {
  let filtered = [...appState.todos];

  // Apply search filter
  const searchInput = document.getElementById("searchInput");
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
  if (searchTerm) {
    filtered = filtered.filter(
      (todo) =>
        todo.title.toLowerCase().includes(searchTerm) ||
        (todo.description &&
          todo.description.toLowerCase().includes(searchTerm))
    );
  }

  // Apply status filter
  const statusFilter = document.getElementById("statusFilter");
  const statusValue = statusFilter ? statusFilter.value : "";
  if (statusValue) {
    filtered = filtered.filter((todo) => todo.status === statusValue);
  }

  // Apply member filter
  const memberFilter = document.getElementById("memberFilter");
  const memberValue = memberFilter ? memberFilter.value : "";
  if (memberValue) {
    filtered = filtered.filter((todo) => todo.assignedTo === memberValue);
  }

  // Apply sorting
  const sortBy = document.getElementById("sortBy");
  const sortValue = sortBy ? sortBy.value : "created";
  filtered.sort((a, b) => {
    switch (sortValue) {
      case "created":
        const aCreated = a.createdAt?.seconds || a.createdAt?.getTime() || 0;
        const bCreated = b.createdAt?.seconds || b.createdAt?.getTime() || 0;
        return bCreated - aCreated;
      case "modified":
        const aModified = a.modifiedAt?.seconds || a.modifiedAt?.getTime() || 0;
        const bModified = b.modifiedAt?.seconds || b.modifiedAt?.getTime() || 0;
        return bModified - aModified;
      case "title":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  return filtered;
}

function toggleSection(sectionId) {
  const content = document.getElementById(`content_${sectionId}`);
  const toggle = document.querySelector(
    `[data-section-id="${sectionId}"].section__toggle`
  );

  if (content && toggle) {
    if (content.classList.contains("collapsed")) {
      content.classList.remove("collapsed");
      toggle.textContent = "−";
    } else {
      content.classList.add("collapsed");
      toggle.textContent = "+";
    }
  }
}

async function deleteSection(sectionId) {
  const section = appState.sections.find((s) => s.id === sectionId);
  const todosInSection = appState.todos.filter(
    (t) => t.sectionId === sectionId
  );

  if (todosInSection.length > 0) {
    alert(
      `Cannot delete "${section.name}" because it contains ${todosInSection.length} todo(s). Please move or delete the todos first.`
    );
    return;
  }

  if (
    confirm(`Are you sure you want to delete the section "${section.name}"?`)
  ) {
    try {
      await ServiceAPI.deleteSection(sectionId);
      showNotification(`Section "${section.name}" deleted`, "success");
    } catch (error) {
      alert("Error deleting section: " + error.message);
    }
  }
}

// Todo Management
function createTodoElement(todo) {
  const assignedMember = appState.teamMembers.find(
    (m) => m.email === todo.assignedTo
  );
  const memberName = assignedMember
    ? assignedMember.name
    : todo.assignedTo || "Unassigned";
  const createdBy = todo.createdBy
    ? ServiceAPI.getUserName(todo.createdBy)
    : "Unknown";

  return `
        <div class="todo" data-id="${todo.id}">
            <div class="todo__header">
                <textarea class="todo__title" data-todo-id="${
                  todo.id
                }" data-field="title">${todo.title}</textarea>
                <div class="todo__actions">
                    <button class="todo__delete" data-todo-id="${
                      todo.id
                    }" title="Delete Todo">🗑️</button>
                </div>
            </div>
            <textarea class="todo__description" placeholder="Add description..." 
                      data-todo-id="${todo.id}" data-field="description">${
    todo.description || ""
  }</textarea>
            <div class="todo__meta">
                <select class="todo__status" data-status="${
                  todo.status
                }" data-todo-id="${todo.id}">
                    ${statusOptions
                      .map(
                        (option) =>
                          `<option value="${option.value}" ${
                            option.value === todo.status ? "selected" : ""
                          }>${option.label}</option>`
                      )
                      .join("")}
                </select>
                <select class="todo__assigned" data-todo-id="${todo.id}">
                    <option value="">Unassigned</option>
                    ${appState.teamMembers
                      .map(
                        (member) =>
                          `<option value="${member.email}" ${
                            member.email === todo.assignedTo ? "selected" : ""
                          }>${member.name}</option>`
                      )
                      .join("")}
                </select>
                <div class="todo__timestamps">
                    <div>Created: ${formatDate(
                      todo.createdAt
                    )} by ${createdBy}</div>
                    <div>Modified: ${formatDate(todo.modifiedAt)}</div>
                </div>
            </div>
        </div>
    `;
}

async function addTodo(sectionId) {
  const newTodo = {
    id: generateId(),
    title: "New Todo",
    description: "",
    sectionId: sectionId,
    status: "todo",
    assignedTo: "",
  };

  try {
    await ServiceAPI.createTodo(newTodo);

    // Focus on the new todo title after a short delay
    setTimeout(() => {
      const todoElement = document.querySelector(
        `[data-id="${newTodo.id}"] .todo__title`
      );
      if (todoElement) {
        todoElement.select();
        todoElement.focus();
      }
    }, 300);

    if (isUsingMockData) {
      showNotification("Todo added (Demo Mode)", "success");
    }
  } catch (error) {
    alert("Error creating todo: " + error.message);
  }
}

async function updateTodo(todoId, field, value) {
  const todo = appState.todos.find((t) => t.id === todoId);
  if (!todo) return;

  // Show visual feedback
  const todoElement = document.querySelector(`[data-id="${todoId}"]`);
  if (todoElement) {
    todoElement.classList.add("syncing");
  }

  try {
    await ServiceAPI.updateTodo(todoId, { [field]: value });

    // Remove syncing indicator
    setTimeout(() => {
      if (todoElement) {
        todoElement.classList.remove("syncing");
      }
    }, 500);

    if (isUsingMockData && field === "status") {
      showNotification(`Todo status updated (Demo Mode)`, "success");
    }
  } catch (error) {
    console.error("Error updating todo:", error);
    if (todoElement) {
      todoElement.classList.remove("syncing");
    }
    showNotification("Error updating todo", "error");
  }
}

async function deleteTodo(todoId) {
  const todo = appState.todos.find((t) => t.id === todoId);
  if (confirm(`Are you sure you want to delete "${todo.title}"?`)) {
    try {
      await ServiceAPI.deleteTodo(todoId);
      showNotification(`Todo "${todo.title}" deleted`, "success");
    } catch (error) {
      alert("Error deleting todo: " + error.message);
    }
  }
}

// Team Management
function renderTeamList() {
  const container = document.getElementById("teamList");
  if (!container) return;

  container.innerHTML = "";

  appState.teamMembers.forEach((member) => {
    const memberDiv = document.createElement("div");
    memberDiv.className = "team-member";
    memberDiv.innerHTML = `
            <div class="team-member__info">
                <div class="team-member__name">${member.name}</div>
                <div class="team-member__email">${member.email}</div>
                ${
                  member.lastSeen
                    ? `<div class="last-seen">Last seen: ${formatDate(
                        member.lastSeen
                      )}</div>`
                    : ""
                }
            </div>
            <div class="team-member__status">
                <div class="status-indicator ${
                  member.online ? "online" : ""
                }"></div>
                <span>${member.online ? "Online" : "Offline"}</span>
            </div>
        `;
    container.appendChild(memberDiv);
  });
}

// Filter and Search
function updateFilters() {
  const memberFilter = document.getElementById("memberFilter");
  if (!memberFilter) return;

  const currentValue = memberFilter.value;

  memberFilter.innerHTML = '<option value="">All Members</option>';
  appState.teamMembers.forEach((member) => {
    const option = document.createElement("option");
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
  const container = document.getElementById("statsContent");
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
        <div class="stat-card">
            <div class="stat-card__value">${stats.teamMembers}</div>
            <div class="stat-card__label">Team Members</div>
        </div>
        <div class="stat-card">
            <div class="stat-card__value">${stats.onlineMembers}</div>
            <div class="stat-card__label">Online Now</div>
        </div>
    `;

  showModal("statsModal");
}

function calculateStatistics() {
  const totalTodos = appState.todos.length;
  const completedTodos = appState.todos.filter(
    (t) => t.status === "completed"
  ).length;
  const inProgressTodos = appState.todos.filter(
    (t) => t.status === "in-progress"
  ).length;
  const todoTodos = appState.todos.filter((t) => t.status === "todo").length;
  const completionRate =
    totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  const activeSections = appState.sections.filter((s) =>
    appState.todos.some((t) => t.sectionId === s.id)
  ).length;
  const teamMembers = appState.teamMembers.length;
  const onlineMembers = appState.teamMembers.filter((m) => m.online).length;

  return {
    totalTodos,
    completedTodos,
    inProgressTodos,
    todoTodos,
    completionRate,
    activeSections,
    teamMembers,
    onlineMembers,
  };
}

// Data Import/Export (for backup purposes)
function exportData() {
  const exportData = {
    sections: appState.sections,
    todos: appState.todos,
    teamMembers: appState.teamMembers,
    exportDate: new Date().toISOString(),
    isDemo: isUsingMockData,
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `team-todo-backup-${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();

  URL.revokeObjectURL(url);
}

// Handle successful authentication
function handleAuthSuccess(user, userName = null) {
  appState.currentUser = user;
  appState.isAuthenticated = true;

  // Initialize demo data
  initializeDemoData();

  // Update user info in team members if needed
  if (userName) {
    const demoUser = appState.teamMembers.find((u) => u.uid === user.uid);
    if (demoUser) {
      demoUser.name = userName;
      demoUser.email = user.email;
    }
  }

  // Show main app
  showMainApp();
  updateUserInfo(user);
  updateTeamInfo();
  renderSections();
  updateFilters();
  updateSettingsInfo();

  // Show success message
  updateConnectionStatus(
    "success",
    "Demo Mode - Welcome to Team Todo Manager!"
  );
  setTimeout(() => updateConnectionStatus("hidden", ""), 3000);

  showNotification("Welcome! You can now manage todos in demo mode", "info");
}

// Event Listeners Setup
function setupEventListeners() {
  // Authentication Events - Use event delegation for better reliability
  document.addEventListener("click", function (e) {
    // Auth toggle button
    if (e.target && e.target.id === "authToggleBtn") {
      e.preventDefault();
      toggleAuthForm();
      return;
    }

    // Theme toggle
    if (
      e.target &&
      (e.target.id === "themeToggle" || e.target.closest("#themeToggle"))
    ) {
      e.preventDefault();
      toggleTheme();
      return;
    }

    // Sign out
    if (e.target && e.target.id === "signOutBtn") {
      e.preventDefault();
      if (confirm("Are you sure you want to sign out?")) {
        appState.currentUser = null;
        appState.isAuthenticated = false;
        showAuthScreen();
        showAuthLoading(false);
        updateConnectionStatus("hidden", "");
        showNotification("Signed out from demo mode", "info");
      }
      return;
    }

    // Team button
    if (e.target && e.target.id === "teamButton") {
      e.preventDefault();
      showModal("teamModal");
      renderTeamList();
      return;
    }

    // Settings button
    if (e.target && e.target.id === "settingsButton") {
      e.preventDefault();
      showModal("settingsModal");
      updateSettingsInfo();
      return;
    }

    // Stats button
    if (e.target && e.target.id === "statsButton") {
      e.preventDefault();
      showStatistics();
      return;
    }

    // Add section button
    if (e.target && e.target.id === "addSectionBtn") {
      e.preventDefault();
      showModal("addSectionModal");
      const input = document.getElementById("newSectionName");
      if (input) input.focus();
      return;
    }

    // Section actions
    if (e.target && e.target.classList.contains("section__toggle")) {
      e.preventDefault();
      const sectionId = e.target.dataset.sectionId;
      toggleSection(sectionId);
      return;
    }

    if (e.target && e.target.classList.contains("section__delete")) {
      e.preventDefault();
      const sectionId = e.target.dataset.sectionId;
      deleteSection(sectionId);
      return;
    }

    // Add todo
    if (e.target && e.target.classList.contains("section__add")) {
      e.preventDefault();
      const sectionId = e.target.dataset.sectionId;
      addTodo(sectionId);
      return;
    }

    // Delete todo
    if (e.target && e.target.classList.contains("todo__delete")) {
      e.preventDefault();
      const todoId = e.target.dataset.todoId;
      deleteTodo(todoId);
      return;
    }

    // Modal controls
    if (
      e.target &&
      (e.target.classList.contains("modal__close") ||
        e.target.classList.contains("modal__overlay"))
    ) {
      e.preventDefault();
      hideAllModals();
      return;
    }

    // Notification close
    if (e.target && e.target.id === "closeNotification") {
      e.preventDefault();
      document.getElementById("realtimeNotification").classList.add("hidden");
      return;
    }

    // Export data
    if (e.target && e.target.id === "exportBtn") {
      e.preventDefault();
      exportData();
      return;
    }

    // Add section modal actions
    if (e.target && e.target.id === "cancelAddSection") {
      e.preventDefault();
      hideModal("addSectionModal");
      return;
    }

    if (e.target && e.target.id === "confirmAddSection") {
      e.preventDefault();
      const nameInput = document.getElementById("newSectionName");
      const colorInput = document.getElementById("selectedColor");

      if (!nameInput || !colorInput) return;

      const name = nameInput.value.trim();
      const color = colorInput.value;

      if (!name) {
        alert("Please enter a section name");
        return;
      }

      const newSection = {
        id: generateId(),
        name: name,
        color: color,
        isDefault: false,
      };

      ServiceAPI.createSection(newSection)
        .then(() => {
          hideModal("addSectionModal");
          nameInput.value = "";
          showNotification(`Section "${name}" created`, "success");
        })
        .catch((error) => {
          alert("Error creating section: " + error.message);
        });
      return;
    }

    // Color picker
    if (e.target && e.target.classList.contains("color-option")) {
      e.preventDefault();
      document
        .querySelectorAll(".color-option")
        .forEach((o) => o.classList.remove("selected"));
      e.target.classList.add("selected");
      const selectedColorInput = document.getElementById("selectedColor");
      if (selectedColorInput) {
        selectedColorInput.value = e.target.dataset.color;
      }
      return;
    }
  });

  // Form submission events
  document.addEventListener("submit", async function (e) {
    if (e.target && e.target.id === "loginForm") {
      e.preventDefault();
      hideAuthErrors();
      showAuthLoading(true);

      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        showAuthError("Please enter both email and password", "login");
        showAuthLoading(false);
        return;
      }

      try {
        // Demo mode - accept any credentials
        const user = await ServiceAPI.signIn(email, password);
        handleAuthSuccess(user);
      } catch (error) {
        showAuthError(error.message, "login");
        showAuthLoading(false);
      }
    }

    if (e.target && e.target.id === "signupForm") {
      e.preventDefault();
      hideAuthErrors();
      showAuthLoading(true);

      const name = document.getElementById("signupName").value;
      const email = document.getElementById("signupEmail").value;
      const password = document.getElementById("signupPassword").value;

      if (!name || !email || !password) {
        showAuthError("Please fill in all fields", "signup");
        showAuthLoading(false);
        return;
      }

      if (password.length < 6) {
        showAuthError("Password must be at least 6 characters", "signup");
        showAuthLoading(false);
        return;
      }

      try {
        const user = await ServiceAPI.signUp(email, password, name);
        handleAuthSuccess(user, name);
      } catch (error) {
        showAuthError(error.message, "signup");
        showAuthLoading(false);
      }
    }
  });

  // Change events
  document.addEventListener("change", async function (e) {
    if (e.target && e.target.classList.contains("todo__status")) {
      const todoId = e.target.dataset.todoId;
      await updateTodo(todoId, "status", e.target.value);
    }

    if (e.target && e.target.classList.contains("todo__assigned")) {
      const todoId = e.target.dataset.todoId;
      await updateTodo(todoId, "assignedTo", e.target.value);
    }

    // Filter changes
    if (
      e.target &&
      (e.target.id === "statusFilter" ||
        e.target.id === "memberFilter" ||
        e.target.id === "sortBy")
    ) {
      applyFilters();
    }
  });

  // Input events
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "searchInput") {
      applyFilters();
    }
  });

  // Blur events for todo text fields
  document.addEventListener("blur", async function (e) {
    if (e.target && e.target.classList.contains("todo__title")) {
      const todoId = e.target.dataset.todoId;
      await updateTodo(todoId, "title", e.target.value);
    }

    if (e.target && e.target.classList.contains("todo__description")) {
      const todoId = e.target.dataset.todoId;
      await updateTodo(todoId, "description", e.target.value);
    }
  });

  // Keyboard events
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      hideAllModals();
    }

    if (
      e.target &&
      e.target.classList.contains("todo__title") &&
      e.key === "Enter"
    ) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

// Application Initialization
async function initApp() {
  console.log("Initializing Firebase Team Todo App...");

  if (isUsingMockData) {
    console.log("Running in DEMO MODE - Firebase not configured");
    console.log(
      "To use real Firebase, update the firebaseConfig object with your project details"
    );
  }

  initTheme();
  setupEventListeners();

  // Always show auth screen first in demo mode
  showAuthScreen();
  showAuthLoading(false);

  if (isUsingMockData) {
    updateConnectionStatus(
      "success",
      "Demo Mode Ready - Use any email/password to sign in"
    );
    setTimeout(() => updateConnectionStatus("hidden", ""), 5000);
  }

  // Set default color selection in add section modal
  setTimeout(() => {
    const firstColorOption = document.querySelector(".color-option");
    if (firstColorOption) {
      firstColorOption.classList.add("selected");
    }
  }, 100);

  console.log("App initialization complete");
}

// Start the application
document.addEventListener("DOMContentLoaded", initApp);
