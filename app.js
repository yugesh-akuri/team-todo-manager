// Secure Firebase Configuration - loads from environment variables
let firebaseConfig = {};

// Load Firebase config from environment (injected during build)
if (typeof window !== "undefined" && window.ENV) {
  firebaseConfig = {
    apiKey: window.ENV.FIREBASE_API_KEY,
    authDomain: window.ENV.FIREBASE_AUTH_DOMAIN,
    projectId: window.ENV.FIREBASE_PROJECT_ID,
    storageBucket: window.ENV.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.ENV.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.ENV.FIREBASE_APP_ID,
    measurementId: window.ENV.FIREBASE_MEASUREMENT_ID,
  };
} else {
  // Fallback for local development
  console.warn("Environment variables not found, using fallback config");
  firebaseConfig = {
    apiKey: "AIzaSyCU_gj_SKAzLGu498JMxRbZZJiuYjvmkZs",
    authDomain: "team-todo-manager.firebaseapp.com",
    projectId: "team-todo-manager",
    storageBucket: "team-todo-manager.firebasestorage.app",
    messagingSenderId: "1092735143588",
    appId: "1:1092735143588:web:f6ba1ea9acb6146e8ee031",
    measurementId: "G-SXE5QMQPP8",
  };
}

// Initialize Firebase
let app, db, auth;
try {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Global State
let currentSections = [];
let currentTodos = [];
let currentTeamMembers = [];
let currentComments = [];
let currentUser = null;
let isFirebaseConnected = false;
let editingSection = null;
let editingTodo = null;
let viewingTodo = null;
let statisticsChart = null;
let currentFilter = "all";
let currentAssigneeFilter = "";

// Real-time listeners
let sectionsUnsub = null;
let todosUnsub = null;
let membersUnsub = null;
let commentsUnsub = null;
let authUnsub = null;

// Utility Functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

// Authentication Functions
function initializeAuth() {
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  authUnsub = auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      showMainApp();
      initializeApp();
    } else {
      currentUser = null;
      showLoginScreen();
      cleanup();
    }
  });

  // Google Sign In
  document
    .getElementById("google-signin-btn")
    .addEventListener("click", async () => {
      try {
        await auth.signInWithPopup(googleProvider);
      } catch (error) {
        console.error("Authentication failed:", error);
        alert("Authentication failed. Please try again.");
      }
    });

  // Logout
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
}

function showLoginScreen() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("main-app").classList.add("hidden");
}

function showMainApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");

  if (currentUser) {
    document.getElementById("user-name").textContent = currentUser.displayName;
    document.getElementById("user-avatar").src = currentUser.photoURL || "";
  }
}

function cleanup() {
  if (sectionsUnsub) sectionsUnsub();
  if (todosUnsub) todosUnsub();
  if (membersUnsub) membersUnsub();
  if (commentsUnsub) commentsUnsub();
}

// Firebase Connection Test
async function checkFirebaseConnection() {
  const statusBar = document.getElementById("connection-status");
  const statusMessage = document.getElementById("connection-message");

  if (!statusBar || !statusMessage) {
    console.error("Status elements not found");
    return false;
  }

  try {
    if (!db) {
      throw new Error("Firestore not initialized");
    }

    await db.collection("sections").limit(1).get();
    isFirebaseConnected = true;
    statusMessage.textContent = "🟢 Connected to Firebase successfully!";
    statusBar.className = "connection-status success";
    statusBar.classList.remove("hidden");
    console.log("Firebase connection successful");

    setTimeout(() => {
      statusBar.classList.add("hidden");
    }, 5000);

    return true;
  } catch (error) {
    console.error("Firebase connection failed:", error);
    isFirebaseConnected = false;
    statusMessage.textContent =
      "🔴 Unable to connect to Firebase - Using offline mode";
    statusBar.className = "connection-status error";
    statusBar.classList.remove("hidden");
    return false;
  }
}

// Data Loading Functions with Real-time Updates
function setupRealtimeListeners() {
  if (!isFirebaseConnected || !db) return;

  // Sections listener
  sectionsUnsub = db.collection("sections").onSnapshot((snapshot) => {
    currentSections = [];
    snapshot.forEach((doc) => {
      currentSections.push({ id: doc.id, ...doc.data() });
    });
    renderSidebar();
    updateSectionSelects();
  });

  // Todos listener
  todosUnsub = db.collection("todos").onSnapshot((snapshot) => {
    currentTodos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      currentTodos.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        modifiedAt: data.modifiedAt?.toDate() || new Date(),
      });
    });
    renderKanban();
    updateStatistics();
  });

  // Team members listener
  membersUnsub = db.collection("users").onSnapshot((snapshot) => {
    currentTeamMembers = [];
    snapshot.forEach((doc) => {
      currentTeamMembers.push({ id: doc.id, ...doc.data() });
    });
    updateAssigneeSelects();
    renderTeamMembers();
  });
}

// Comments with Fixed Query
async function loadComments(todoId) {
  try {
    if (isFirebaseConnected && db) {
      // Remove orderBy to avoid index requirement temporarily
      const snapshot = await db
        .collection("comments")
        .where("todoId", "==", todoId)
        .get();

      const comments = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        comments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      // Sort manually in JavaScript instead
      comments.sort((a, b) => b.createdAt - a.createdAt);
      return comments;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading comments:", error);
    return [];
  }
}

// Real-time Comments Listener
function subscribeToComments(todoId) {
  // Unsubscribe from previous listener if any
  if (commentsUnsub) commentsUnsub();

  if (isFirebaseConnected && db) {
    commentsUnsub = db
      .collection("comments")
      .where("todoId", "==", todoId)
      .onSnapshot((snapshot) => {
        currentComments = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          currentComments.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          });
        });

        // Sort manually
        currentComments.sort((a, b) => b.createdAt - a.createdAt);
        renderTodoComments(currentComments);
      });
  }
}

// Comments Management
async function saveComment(commentData) {
  try {
    if (isFirebaseConnected && db && currentUser) {
      const newComment = {
        id: generateId(),
        ...commentData,
        authorName: currentUser.displayName || "Anonymous",
        authorEmail: currentUser.email,
        authorPhoto: currentUser.photoURL || null,
        createdAt: firebase.firestore.Timestamp.fromDate(new Date()),
      };

      await db.collection("comments").doc(newComment.id).set(newComment);

      // Also update todo status if status change was requested
      if (commentData.statusChange && viewingTodo) {
        await updateTodoStatus(viewingTodo.id, commentData.statusChange);
      }
    }
  } catch (error) {
    console.error("Error saving comment:", error);
    alert("Error saving comment. Please try again.");
  }
}

// Section Management
async function saveSection(sectionData) {
  try {
    if (isFirebaseConnected && db && currentUser) {
      const sectionWithUser = {
        ...sectionData,
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.Timestamp.fromDate(new Date()),
      };

      if (editingSection) {
        await db
          .collection("sections")
          .doc(editingSection.id)
          .update({
            ...sectionWithUser,
            modifiedAt: firebase.firestore.Timestamp.fromDate(new Date()),
          });
      } else {
        const newSection = { id: generateId(), ...sectionWithUser };
        await db.collection("sections").doc(newSection.id).set(newSection);
      }
    }
  } catch (error) {
    console.error("Error saving section:", error);
    alert("Error saving section. Please try again.");
  }
}

async function deleteSection(sectionId) {
  if (
    !confirm(
      "Are you sure you want to delete this section? All todos in this section will also be deleted."
    )
  ) {
    return;
  }

  try {
    if (isFirebaseConnected && db) {
      // Delete all todos in this section first
      const todosSnapshot = await db
        .collection("todos")
        .where("sectionId", "==", sectionId)
        .get();

      const batch = db.batch();
      todosSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete the section
      batch.delete(db.collection("sections").doc(sectionId));
      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting section:", error);
    alert("Error deleting section. Please try again.");
  }
}

// Todo Management
async function saveTodo(todoData) {
  try {
    const now = new Date();
    if (isFirebaseConnected && db && currentUser) {
      const todoWithUser = {
        ...todoData,
        createdBy: currentUser.uid,
      };

      if (editingTodo) {
        await db
          .collection("todos")
          .doc(editingTodo.id)
          .update({
            ...todoWithUser,
            modifiedAt: firebase.firestore.Timestamp.fromDate(now),
          });
      } else {
        const newTodo = {
          id: generateId(),
          ...todoWithUser,
          createdAt: firebase.firestore.Timestamp.fromDate(now),
          modifiedAt: firebase.firestore.Timestamp.fromDate(now),
        };
        await db.collection("todos").doc(newTodo.id).set(newTodo);
      }
    }
  } catch (error) {
    console.error("Error saving todo:", error);
    alert("Error saving todo. Please try again.");
  }
}

async function deleteTodo(todoId) {
  if (!confirm("Are you sure you want to delete this todo?")) {
    return;
  }

  try {
    if (isFirebaseConnected && db) {
      await db.collection("todos").doc(todoId).delete();
    }
  } catch (error) {
    console.error("Error deleting todo:", error);
    alert("Error deleting todo. Please try again.");
  }
}

async function updateTodoStatus(todoId, newStatus) {
  try {
    if (isFirebaseConnected && db) {
      await db
        .collection("todos")
        .doc(todoId)
        .update({
          status: newStatus,
          modifiedAt: firebase.firestore.Timestamp.fromDate(new Date()),
        });
    }
  } catch (error) {
    console.error("Error updating todo status:", error);
    alert("Error updating todo status. Please try again.");
  }
}

// Team Management
async function saveTeamMember(memberData) {
  try {
    if (isFirebaseConnected && db) {
      const newMember = {
        id: generateId(),
        ...memberData,
        online: false,
        addedBy: currentUser?.uid || "system",
      };
      await db.collection("users").doc(newMember.id).set(newMember);
    }
  } catch (error) {
    console.error("Error saving team member:", error);
    alert("Error saving team member. Please try again.");
  }
}

async function deleteTeamMember(memberId) {
  if (!confirm("Are you sure you want to remove this team member?")) {
    return;
  }

  try {
    if (isFirebaseConnected && db) {
      await db.collection("users").doc(memberId).delete();
    }
  } catch (error) {
    console.error("Error deleting team member:", error);
    alert("Error deleting team member. Please try again.");
  }
}

// Rendering Functions
function renderSidebar() {
  const sectionsList = document.getElementById("sections-list");
  if (!sectionsList) return;

  sectionsList.innerHTML = "";

  // Update "All Sections" count
  const allCount = document.getElementById("all-count");
  if (allCount) {
    allCount.textContent = currentTodos.length;
  }

  // Render individual sections
  currentSections.forEach((section) => {
    const sectionTodos = currentTodos.filter(
      (todo) => todo.sectionId === section.id
    );
    const sectionElement = document.createElement("div");
    sectionElement.className = `section-item ${
      currentFilter === section.id ? "active" : ""
    }`;
    sectionElement.setAttribute("data-section", section.id);

    sectionElement.innerHTML = `
      <span class="section-dot" style="background-color: ${
        section.color || "#4CAF50"
      };"></span>
      <span class="section-name">${section.name}</span>
      <span class="section-count">${sectionTodos.length}</span>
    `;

    sectionElement.addEventListener("click", () => filterBySection(section.id));
    sectionsList.appendChild(sectionElement);
  });
}

function filterBySection(sectionId) {
  currentFilter = sectionId;

  // Update active state in sidebar
  document.querySelectorAll(".section-item").forEach((item) => {
    item.classList.remove("active");
  });

  const activeItem = document.querySelector(`[data-section="${sectionId}"]`);
  if (activeItem) {
    activeItem.classList.add("active");
  }

  // Update page title
  const pageTitle = document.getElementById("current-section-title");
  if (pageTitle) {
    if (sectionId === "all") {
      pageTitle.textContent = "All Todos";
    } else {
      const section = currentSections.find((s) => s.id === sectionId);
      pageTitle.textContent = section ? section.name : "Section";
    }
  }

  renderKanban();
}

function renderKanban() {
  const todoColumn = document.getElementById("todo-todos");
  const inProgressColumn = document.getElementById("in-progress-todos");
  const completedColumn = document.getElementById("completed-todos");

  if (!todoColumn || !inProgressColumn || !completedColumn) return;

  // Clear columns
  todoColumn.innerHTML = "";
  inProgressColumn.innerHTML = "";
  completedColumn.innerHTML = "";

  // Filter todos based on current filter and assignee filter
  let filteredTodos = currentTodos;

  if (currentFilter !== "all") {
    filteredTodos = filteredTodos.filter(
      (todo) => todo.sectionId === currentFilter
    );
  }

  if (currentAssigneeFilter) {
    filteredTodos = filteredTodos.filter(
      (todo) => todo.assignedTo === currentAssigneeFilter
    );
  }

  // Separate todos by status
  const todoTodos = filteredTodos.filter((todo) => todo.status === "todo");
  const inProgressTodos = filteredTodos.filter(
    (todo) => todo.status === "in-progress"
  );
  const completedTodos = filteredTodos.filter(
    (todo) => todo.status === "completed"
  );

  // Update column counts
  document.getElementById("todo-count").textContent = todoTodos.length;
  document.getElementById("in-progress-count").textContent =
    inProgressTodos.length;
  document.getElementById("completed-count").textContent =
    completedTodos.length;

  // Render todos in each column
  renderTodosInColumn(todoTodos, todoColumn);
  renderTodosInColumn(inProgressTodos, inProgressColumn);
  renderTodosInColumn(completedTodos, completedColumn);
}

function renderTodosInColumn(todos, column) {
  if (todos.length === 0) {
    column.innerHTML =
      '<div class="column-empty-state"><p>No todos yet</p></div>';
    return;
  }

  todos.forEach((todo) => {
    const section = currentSections.find((s) => s.id === todo.sectionId);
    const assignee = currentTeamMembers.find((m) => m.id === todo.assignedTo);

    const todoElement = document.createElement("div");
    todoElement.className = "kanban-todo";
    todoElement.style.setProperty("--todo-color", section?.color || "#4CAF50");

    todoElement.innerHTML = `
      <div class="kanban-todo-header">
        <h4 class="kanban-todo-title">${todo.title}</h4>
        <span class="kanban-todo-section">${
          section?.name || "No Section"
        }</span>
      </div>
      ${
        todo.description
          ? `<p class="kanban-todo-description">${todo.description}</p>`
          : ""
      }
      <div class="kanban-todo-meta">
        <span class="kanban-todo-assignee">${
          assignee ? assignee.name : "Unassigned"
        }</span>
        <div class="kanban-todo-actions">
          <button class="kanban-todo-action" onclick="openTodoDetails('${
            todo.id
          }')">👁️</button>
          <button class="kanban-todo-action" onclick="editTodoModal('${
            todo.id
          }')">✏️</button>
          <button class="kanban-todo-action" onclick="deleteTodo('${
            todo.id
          }')">🗑️</button>
        </div>
      </div>
    `;

    todoElement.addEventListener("click", (e) => {
      if (!e.target.classList.contains("kanban-todo-action")) {
        openTodoDetails(todo.id);
      }
    });

    column.appendChild(todoElement);
  });
}

function renderTodoComments(comments) {
  const commentsList = document.getElementById("todo-comments-list");
  if (!commentsList) return;

  if (comments.length === 0) {
    commentsList.innerHTML =
      '<div class="empty-state"><p>No comments yet</p></div>';
    return;
  }

  commentsList.innerHTML = "";
  comments.forEach((comment) => {
    const commentElement = document.createElement("div");
    commentElement.className = "comment-item";

    commentElement.innerHTML = `
      <div class="comment-header">
        <div class="comment-author">
          <div class="comment-avatar">
            ${
              comment.authorPhoto
                ? `<img src="${comment.authorPhoto}" alt="${comment.authorName}" style="width: 100%; height: 100%; border-radius: 50%;">`
                : getInitials(comment.authorName || "Anonymous")
            }
          </div>
          <div class="comment-info">
            <h5>${comment.authorName || "Anonymous"}</h5>
            <span class="comment-date">${formatDate(comment.createdAt)}</span>
          </div>
        </div>
        ${
          comment.statusChange
            ? `<span class="status-change">Status → ${comment.statusChange}</span>`
            : ""
        }
      </div>
      <div class="comment-body">
        <p>${comment.message || ""}</p>
      </div>
    `;

    commentsList.appendChild(commentElement);
  });
}

// Modal Functions
function openTodoDetails(todoId) {
  const todo = currentTodos.find((t) => t.id === todoId);
  if (!todo) return;

  viewingTodo = todo;

  const section = currentSections.find((s) => s.id === todo.sectionId);
  const assignee = currentTeamMembers.find((m) => m.id === todo.assignedTo);

  document.getElementById("details-todo-title").textContent = todo.title;
  document.getElementById("details-todo-description").textContent =
    todo.description || "No description";
  document.getElementById("details-todo-status").textContent = todo.status;
  document.getElementById("details-todo-assignee").textContent = assignee
    ? assignee.name
    : "Unassigned";

  // Subscribe to real-time comments
  subscribeToComments(todoId);

  openModal("todo-details-modal");
}

function editTodoModal(todoId) {
  const todo = currentTodos.find((t) => t.id === todoId);
  if (!todo) return;

  editingTodo = todo;
  document.getElementById("todo-modal-title").textContent = "Edit Todo";
  document.getElementById("todo-title").value = todo.title;
  document.getElementById("todo-description").value = todo.description || "";
  document.getElementById("todo-status").value = todo.status;
  document.getElementById("todo-assignee").value = todo.assignedTo || "";
  document.getElementById("todo-section").value = todo.sectionId;
  document.getElementById("todo-submit-text").textContent = "Update Todo";

  openModal("todo-modal");
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove("hidden");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");

  // Clean up
  if (modalId === "todo-details-modal") {
    viewingTodo = null;
    if (commentsUnsub) commentsUnsub();
  }

  if (modalId === "todo-modal") {
    editingTodo = null;
    document.getElementById("todo-form").reset();
    document.getElementById("todo-modal-title").textContent = "Add Todo";
    document.getElementById("todo-submit-text").textContent = "Add Todo";
  }

  if (modalId === "section-modal") {
    editingSection = null;
    document.getElementById("section-form").reset();
    document.getElementById("section-modal-title").textContent = "Add Section";
    document.getElementById("section-submit-text").textContent = "Add Section";
  }
}

// Add Comment Function
function addTodoComment() {
  const messageInput = document.getElementById("comment-message");
  const statusSelect = document.getElementById("comment-status-change");

  const message = messageInput.value.trim();
  const statusChange = statusSelect.value;

  if (!message && !statusChange) {
    alert("Please enter a comment or select a status change.");
    return;
  }

  const commentData = {
    todoId: viewingTodo.id,
    message: message,
    statusChange: statusChange || null,
  };

  saveComment(commentData);

  // Clear form
  messageInput.value = "";
  statusSelect.value = "";
}

// Update Helper Functions
function updateSectionSelects() {
  const todoSectionSelect = document.getElementById("todo-section");
  if (!todoSectionSelect) return;

  const currentValue = todoSectionSelect.value;
  todoSectionSelect.innerHTML = '<option value="">Select Section</option>';

  currentSections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    todoSectionSelect.appendChild(option);
  });

  if (currentValue) {
    todoSectionSelect.value = currentValue;
  }
}

function updateAssigneeSelects() {
  const todoAssigneeSelect = document.getElementById("todo-assignee");
  const filterAssigneeSelect = document.getElementById("assignee-filter");

  [todoAssigneeSelect, filterAssigneeSelect].forEach((select) => {
    if (!select) return;

    const currentValue = select.value;
    const isFilter = select.id === "assignee-filter";

    select.innerHTML = isFilter
      ? '<option value="">All Assignees</option>'
      : '<option value="">Unassigned</option>';

    currentTeamMembers.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = member.name;
      select.appendChild(option);
    });

    if (currentValue) {
      select.value = currentValue;
    }
  });
}

function updateStatistics() {
  const total = currentTodos.length;
  const completed = currentTodos.filter((t) => t.status === "completed").length;
  const inProgress = currentTodos.filter(
    (t) => t.status === "in-progress"
  ).length;
  const todo = currentTodos.filter((t) => t.status === "todo").length;

  const elements = {
    "total-todos": total,
    "completed-todos": completed,
    "inprogress-todos": inProgress,
    "todo-todos": todo,
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  updateChart(todo, inProgress, completed);
}

function updateChart(todoCount, inProgressCount, completedCount) {
  const canvas = document.getElementById("stats-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (statisticsChart) {
    statisticsChart.destroy();
  }

  statisticsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["To Do", "In Progress", "Completed"],
      datasets: [
        {
          data: [todoCount, inProgressCount, completedCount],
          backgroundColor: ["#f44336", "#ff9800", "#4caf50"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderTeamMembers() {
  const teamList = document.getElementById("team-list");
  if (!teamList) return;

  if (currentTeamMembers.length === 0) {
    teamList.innerHTML =
      '<div class="empty-state"><p>No team members yet</p></div>';
    return;
  }

  teamList.innerHTML = "";
  currentTeamMembers.forEach((member) => {
    const memberElement = document.createElement("div");
    memberElement.className = "team-member";

    memberElement.innerHTML = `
      <div class="member-info">
        <div class="member-avatar">${getInitials(member.name)}</div>
        <div class="member-details">
          <h4>${member.name}</h4>
          <p>${member.email}</p>
        </div>
      </div>
      <div class="member-status">
        <div class="status-indicator ${member.online ? "" : "offline"}"></div>
        <button class="btn btn--outline btn--sm" onclick="deleteTeamMember('${
          member.id
        }')">Remove</button>
      </div>
    `;

    teamList.appendChild(memberElement);
  });
}

// Event Listeners Setup
function setupEventListeners() {
  // Sidebar toggle
  document.getElementById("toggle-sidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("visible");
  });

  // Filter by "All Sections"
  document
    .querySelector('[data-section="all"]')
    .addEventListener("click", () => {
      filterBySection("all");
    });

  // Assignee filter
  document.getElementById("assignee-filter").addEventListener("change", (e) => {
    currentAssigneeFilter = e.target.value;
    renderKanban();
  });

  // Add Section Button
  document.getElementById("add-section-btn").addEventListener("click", () => {
    openModal("section-modal");
  });

  // Add Todo Button
  document.getElementById("add-todo-btn").addEventListener("click", () => {
    openModal("todo-modal");
  });

  // Modal close buttons
  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (modal) {
        closeModal(modal.id);
      }
    });
  });

  // Section form
  document
    .getElementById("section-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const sectionData = {
        name: formData.get("name"),
        color: formData.get("color"),
      };

      await saveSection(sectionData);
      closeModal("section-modal");
    });

  // Todo form
  document.getElementById("todo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const todoData = {
      title: formData.get("title"),
      description: formData.get("description"),
      sectionId: formData.get("sectionId"),
      status: formData.get("status"),
      assignedTo: formData.get("assignedTo") || null,
    };

    await saveTodo(todoData);
    closeModal("todo-modal");
  });

  // Team member form
  document
    .getElementById("add-member-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const memberData = {
        name: formData.get("name"),
        email: formData.get("email"),
      };

      await saveTeamMember(memberData);
      closeModal("add-member-modal");
      e.target.reset();
    });

  // Modal buttons
  document
    .getElementById("team-btn")
    .addEventListener("click", () => openModal("team-modal"));
  document.getElementById("statistics-btn").addEventListener("click", () => {
    updateStatistics();
    openModal("statistics-modal");
  });
  document
    .getElementById("settings-btn")
    .addEventListener("click", () => openModal("settings-modal"));
  document
    .getElementById("add-member-btn")
    .addEventListener("click", () => openModal("add-member-modal"));

  // Close modals on outside click
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      closeModal(e.target.id);
    }
  });

  // Theme toggle
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-color-scheme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-color-scheme", newTheme);

    const themeIcon = document.getElementById("theme-icon");
    themeIcon.textContent = newTheme === "dark" ? "☀️" : "🌙";
  });

  // Test connection
  document
    .getElementById("test-connection-btn")
    .addEventListener("click", checkFirebaseConnection);

  // Color presets
  document.querySelectorAll(".color-preset").forEach((preset) => {
    preset.addEventListener("click", () => {
      const color = preset.getAttribute("data-color");
      document.getElementById("section-color").value = color;

      document
        .querySelectorAll(".color-preset")
        .forEach((p) => p.classList.remove("active"));
      preset.classList.add("active");
    });
  });
}

// App Initialization
async function initializeApp() {
  console.log("Initializing app...");

  const connected = await checkFirebaseConnection();
  if (connected) {
    setupRealtimeListeners();
  }

  // Initialize with "All Todos" view
  filterBySection("all");
}

// Start the app
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  initializeAuth();
});
