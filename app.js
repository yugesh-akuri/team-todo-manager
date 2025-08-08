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
  // Fallback for local development (you can use a separate config file)
  console.warn("Environment variables not found, using fallback config");
  firebaseConfig = {
    // Add your local development config here (can be same as production for public projects)
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
let app, db;
try {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Global State
let currentSections = [];
let currentTodos = [];
let currentTeamMembers = [];
let currentComments = []; // NEW: Store comments
let isFirebaseConnected = false;
let editingSection = null;
let editingTodo = null;
let viewingTodo = null; // NEW: For viewing todo details with comments
let statisticsChart = null;

// Real-time listeners
let sectionsUnsub = null;
let todosUnsub = null;
let membersUnsub = null;
let commentsUnsub = null; // NEW: Comments listener

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

// Data Loading Functions
async function loadSections() {
  try {
    if (isFirebaseConnected && db) {
      const snapshot = await db.collection("sections").get();
      const sections = [];
      snapshot.forEach((doc) => {
        sections.push({ id: doc.id, ...doc.data() });
      });
      return sections;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading sections:", error);
    return [];
  }
}

async function loadTodos() {
  try {
    if (isFirebaseConnected && db) {
      const snapshot = await db.collection("todos").get();
      const todos = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        todos.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          modifiedAt: data.modifiedAt?.toDate() || new Date(),
        });
      });
      return todos;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading todos:", error);
    return [];
  }
}

async function loadTeamMembers() {
  try {
    if (isFirebaseConnected && db) {
      const snapshot = await db.collection("users").get();
      const members = [];
      snapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() });
      });
      return members;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading team members:", error);
    return [];
  }
}

// NEW: Load comments for a specific todo
async function loadComments(todoId) {
  try {
    if (isFirebaseConnected && db) {
      const snapshot = await db
        .collection("comments")
        .where("todoId", "==", todoId)
        .orderBy("createdAt", "desc")
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
      return comments;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading comments:", error);
    return [];
  }
}

// Comments Management
async function saveComment(commentData) {
  try {
    if (isFirebaseConnected && db) {
      const newComment = {
        id: generateId(),
        ...commentData,
        createdAt: firebase.firestore.Timestamp.fromDate(new Date()),
      };
      await db.collection("comments").doc(newComment.id).set(newComment);

      // Refresh comments for the current todo
      if (viewingTodo) {
        await refreshTodoComments(viewingTodo.id);
      }
    } else {
      // Offline mode - add to local storage temporarily
      const newComment = {
        id: generateId(),
        ...commentData,
        createdAt: new Date(),
      };
      // You could store in localStorage here for offline support
    }
  } catch (error) {
    console.error("Error saving comment:", error);
    alert("Error saving comment. Please try again.");
  }
}

async function refreshTodoComments(todoId) {
  const comments = await loadComments(todoId);
  renderTodoComments(comments);
}

// Section Management
async function saveSection(sectionData) {
  try {
    if (isFirebaseConnected && db) {
      if (editingSection) {
        await db
          .collection("sections")
          .doc(editingSection.id)
          .update(sectionData);
      } else {
        const newSection = { id: generateId(), ...sectionData };
        await db.collection("sections").doc(newSection.id).set(newSection);
      }
    } else {
      if (editingSection) {
        const index = currentSections.findIndex(
          (s) => s.id === editingSection.id
        );
        if (index !== -1) {
          currentSections[index] = { ...editingSection, ...sectionData };
        }
      } else {
        const newSection = { id: generateId(), ...sectionData };
        currentSections.push(newSection);
      }
      renderSections();
      updateSectionSelects();
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
    } else {
      // Offline mode
      currentSections = currentSections.filter((s) => s.id !== sectionId);
      currentTodos = currentTodos.filter((t) => t.sectionId !== sectionId);
      renderSections();
      updateStatistics();
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

    if (isFirebaseConnected && db) {
      if (editingTodo) {
        await db
          .collection("todos")
          .doc(editingTodo.id)
          .update({
            ...todoData,
            modifiedAt: firebase.firestore.Timestamp.fromDate(now),
          });
      } else {
        const newTodo = {
          id: generateId(),
          ...todoData,
          createdAt: firebase.firestore.Timestamp.fromDate(now),
          modifiedAt: firebase.firestore.Timestamp.fromDate(now),
          createdBy: "system",
        };
        await db.collection("todos").doc(newTodo.id).set(newTodo);
      }
    } else {
      // Offline mode
      if (editingTodo) {
        const index = currentTodos.findIndex((t) => t.id === editingTodo.id);
        if (index !== -1) {
          currentTodos[index] = {
            ...editingTodo,
            ...todoData,
            modifiedAt: now,
          };
        }
      } else {
        const newTodo = {
          id: generateId(),
          ...todoData,
          createdAt: now,
          modifiedAt: now,
          createdBy: "system",
        };
        currentTodos.push(newTodo);
      }
      renderSections();
      updateStatistics();
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
    } else {
      // Offline mode
      currentTodos = currentTodos.filter((t) => t.id !== todoId);
      renderSections();
      updateStatistics();
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
    } else {
      // Offline mode
      const index = currentTodos.findIndex((t) => t.id === todoId);
      if (index !== -1) {
        currentTodos[index].status = newStatus;
        currentTodos[index].modifiedAt = new Date();
      }
      renderSections();
      updateStatistics();
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
      };
      await db.collection("users").doc(newMember.id).set(newMember);
    } else {
      // Offline mode
      const newMember = {
        id: generateId(),
        ...memberData,
        online: false,
      };
      currentTeamMembers.push(newMember);
      updateAssigneeSelects();
      updateFilters();
      renderTeamMembers();
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
    } else {
      // Offline mode
      currentTeamMembers = currentTeamMembers.filter((m) => m.id !== memberId);
      updateAssigneeSelects();
      updateFilters();
      renderTeamMembers();
    }
  } catch (error) {
    console.error("Error deleting team member:", error);
    alert("Error deleting team member. Please try again.");
  }
}

// Rendering Functions
function renderSections() {
  const container = document.getElementById("sections-container");
  if (!container) {
    console.error("Sections container not found");
    return;
  }

  console.log("Rendering sections:", currentSections.length);
  container.innerHTML = "";

  if (currentSections.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No sections yet. Click "Add Section" to get started!</p></div>';
    return;
  }

  currentSections.forEach((section) => {
    const sectionTodos = currentTodos.filter(
      (todo) => todo.sectionId === section.id
    );
    const filteredTodos = applyFilters(sectionTodos);

    const sectionCard = document.createElement("div");
    sectionCard.className = "section-card";
    sectionCard.style.setProperty("--section-color", section.color);

    sectionCard.innerHTML = `
      <div class="section-header">
        <h3 class="section-title">${section.name}</h3>
        <div class="section-actions">
          <button class="btn btn--outline btn--sm" onclick="editSection('${
            section.id
          }')" title="Edit Section">
            ✏️
          </button>
          ${
            !section.isDefault
              ? `
            <button class="btn btn--outline btn--sm" onclick="deleteSection('${section.id}')" title="Delete Section">
              🗑️
            </button>
          `
              : ""
          }
        </div>
      </div>
      <div class="section-body">
        <button class="btn btn--secondary add-todo-btn" onclick="openTodoModal('${
          section.id
        }')">
          + Add Todo
        </button>
        <div class="todo-list">
          ${
            filteredTodos.length > 0
              ? filteredTodos.map((todo) => renderTodoItem(todo)).join("")
              : '<div class="empty-state"><p>No todos yet</p></div>'
          }
        </div>
      </div>
    `;

    container.appendChild(sectionCard);
  });
}

// MODIFIED: Updated todo rendering to include comments button
function renderTodoItem(todo) {
  const assignedMember = currentTeamMembers.find(
    (member) => member.email === todo.assignedTo
  );
  const assigneeDisplay = assignedMember
    ? `👤 ${assignedMember.name}`
    : todo.assignedTo
    ? `👤 ${todo.assignedTo}`
    : "👤 Unassigned";

  const statusColors = {
    todo: "#f44336",
    "in-progress": "#ff9800",
    completed: "#4caf50",
  };

  return `
    <div class="todo-item" style="--todo-status-color: ${
      statusColors[todo.status]
    }">
      <div class="todo-header">
        <h4 class="todo-title">${todo.title}</h4>
        <span class="todo-status ${todo.status}">${todo.status.replace(
    "-",
    " "
  )}</span>
      </div>
      ${
        todo.description
          ? `<p class="todo-description">${todo.description}</p>`
          : ""
      }
      <div class="todo-meta">
        <div class="todo-assignee">${assigneeDisplay}</div>
        <div class="todo-actions">
          <button class="todo-action" onclick="openTodoDetailsModal('${
            todo.id
          }')" title="View Details & Comments">💬</button>
          <button class="todo-action" onclick="editTodo('${
            todo.id
          }')" title="Edit Todo">✏️</button>
          ${
            todo.status !== "completed"
              ? `<button class="todo-action" onclick="event.stopPropagation(); updateTodoStatus('${todo.id}', 'completed')" title="Mark Complete">✓</button>`
              : `<button class="todo-action" onclick="event.stopPropagation(); updateTodoStatus('${todo.id}', 'todo')" title="Mark Incomplete">↶</button>`
          }
          <button class="todo-action" onclick="event.stopPropagation(); deleteTodo('${
            todo.id
          }')" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

// NEW: Open todo details modal with comments
async function openTodoDetailsModal(todoId) {
  viewingTodo = currentTodos.find((t) => t.id === todoId);
  if (!viewingTodo) return;

  const modal = document.getElementById("todo-details-modal");
  if (!modal) return;

  // Populate todo details
  document.getElementById("details-todo-title").textContent = viewingTodo.title;
  document.getElementById("details-todo-description").textContent =
    viewingTodo.description || "No description";
  document.getElementById("details-todo-status").textContent =
    viewingTodo.status.replace("-", " ");
  document.getElementById(
    "details-todo-status"
  ).className = `todo-status ${viewingTodo.status}`;

  const assignedMember = currentTeamMembers.find(
    (m) => m.email === viewingTodo.assignedTo
  );
  document.getElementById("details-todo-assignee").textContent = assignedMember
    ? assignedMember.name
    : "Unassigned";

  // Load and render comments
  await refreshTodoComments(todoId);

  modal.classList.remove("hidden");
}

// NEW: Render comments in the todo details modal
function renderTodoComments(comments) {
  const container = document.getElementById("todo-comments-list");
  if (!container) return;

  container.innerHTML = "";

  if (comments.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No comments yet</p></div>';
    return;
  }

  comments.forEach((comment) => {
    const commentElement = document.createElement("div");
    commentElement.className = "comment-item";

    const author = currentTeamMembers.find(
      (m) => m.email === comment.authorEmail
    ) || { name: comment.authorEmail, email: comment.authorEmail };

    commentElement.innerHTML = `
      <div class="comment-header">
        <div class="comment-author">
          <div class="comment-avatar">${getInitials(author.name)}</div>
          <div class="comment-info">
            <h5>${author.name}</h5>
            <span class="comment-date">${formatDate(comment.createdAt)}</span>
          </div>
        </div>
        ${
          comment.statusChange
            ? `<span class="status-change">Status: ${comment.statusChange}</span>`
            : ""
        }
      </div>
      <div class="comment-body">
        <p>${comment.message}</p>
      </div>
    `;
    container.appendChild(commentElement);
  });
}

// NEW: Add comment with optional status change
async function addTodoComment() {
  const message = document.getElementById("comment-message").value.trim();
  const statusChange = document.getElementById("comment-status-change").value;

  if (!message && !statusChange) {
    alert("Please enter a comment or select a status change.");
    return;
  }

  if (!viewingTodo) return;

  // For now, we'll use a default author email - in a real app you'd get this from authentication
  const authorEmail = "current@user.com"; // This should come from your auth system

  const commentData = {
    todoId: viewingTodo.id,
    message: message || "",
    authorEmail: authorEmail,
    statusChange: statusChange || null,
  };

  await saveComment(commentData);

  // Update todo status if changed
  if (statusChange && statusChange !== viewingTodo.status) {
    await updateTodoStatus(viewingTodo.id, statusChange);
    viewingTodo.status = statusChange; // Update local state
    document.getElementById("details-todo-status").textContent =
      statusChange.replace("-", " ");
    document.getElementById(
      "details-todo-status"
    ).className = `todo-status ${statusChange}`;
  }

  // Clear form
  document.getElementById("comment-message").value = "";
  document.getElementById("comment-status-change").value = "";
}

function renderTeamMembers() {
  const container = document.getElementById("team-list");
  if (!container) return;

  container.innerHTML = "";

  if (currentTeamMembers.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No team members yet</p></div>';
    return;
  }

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
        <span>${member.online ? "Online" : "Offline"}</span>
        <button class="btn btn--outline btn--sm" onclick="deleteTeamMember('${
          member.id
        }')" title="Remove Member">
          🗑️
        </button>
      </div>
    `;
    container.appendChild(memberElement);
  });
}

// Filter Functions
function applyFilters(todos) {
  const statusFilter = document.getElementById("status-filter")?.value || "";
  const assigneeFilter =
    document.getElementById("assignee-filter")?.value || "";

  return todos.filter((todo) => {
    const statusMatch = !statusFilter || todo.status === statusFilter;
    const assigneeMatch = !assigneeFilter || todo.assignedTo === assigneeFilter;
    return statusMatch && assigneeMatch;
  });
}

function updateFilters() {
  // Update assignee filter
  const assigneeFilter = document.getElementById("assignee-filter");
  if (!assigneeFilter) return;

  const currentValue = assigneeFilter.value;
  assigneeFilter.innerHTML = '<option value="">All Assignees</option>';

  currentTeamMembers.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.email;
    option.textContent = member.name;
    assigneeFilter.appendChild(option);
  });

  assigneeFilter.value = currentValue;
}

function updateSectionSelects() {
  const todoSectionSelect = document.getElementById("todo-section");
  if (!todoSectionSelect) return;

  const currentValue = todoSectionSelect.value;
  todoSectionSelect.innerHTML = "";

  currentSections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    todoSectionSelect.appendChild(option);
  });

  todoSectionSelect.value = currentValue;
}

function updateAssigneeSelects() {
  const todoAssigneeSelect = document.getElementById("todo-assignee");
  if (!todoAssigneeSelect) return;

  const currentValue = todoAssigneeSelect.value;
  todoAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';

  currentTeamMembers.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.email;
    option.textContent = member.name;
    todoAssigneeSelect.appendChild(option);
  });

  todoAssigneeSelect.value = currentValue;
}

// Statistics
function updateStatistics() {
  const totalTodos = currentTodos.length;
  const completedTodos = currentTodos.filter(
    (todo) => todo.status === "completed"
  ).length;
  const inProgressTodos = currentTodos.filter(
    (todo) => todo.status === "in-progress"
  ).length;
  const todoTodos = currentTodos.filter(
    (todo) => todo.status === "todo"
  ).length;

  const totalElement = document.getElementById("total-todos");
  const completedElement = document.getElementById("completed-todos");
  const inProgressElement = document.getElementById("inprogress-todos");
  const todoElement = document.getElementById("todo-todos");

  if (totalElement) totalElement.textContent = totalTodos;
  if (completedElement) completedElement.textContent = completedTodos;
  if (inProgressElement) inProgressElement.textContent = inProgressTodos;
  if (todoElement) todoElement.textContent = todoTodos;
}

function renderStatisticsChart() {
  const canvas = document.getElementById("stats-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // Destroy existing chart if it exists
  if (statisticsChart) {
    statisticsChart.destroy();
  }

  const completedTodos = currentTodos.filter(
    (todo) => todo.status === "completed"
  ).length;
  const inProgressTodos = currentTodos.filter(
    (todo) => todo.status === "in-progress"
  ).length;
  const todoTodos = currentTodos.filter(
    (todo) => todo.status === "todo"
  ).length;

  statisticsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["To Do", "In Progress", "Completed"],
      datasets: [
        {
          data: [todoTodos, inProgressTodos, completedTodos],
          backgroundColor: ["#1FB8CD", "#FFC185", "#B4413C"],
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

// Modal Functions
function openSectionModal(sectionId = null) {
  editingSection = sectionId
    ? currentSections.find((s) => s.id === sectionId)
    : null;

  const modal = document.getElementById("section-modal");
  const title = document.getElementById("section-modal-title");
  const submitText = document.getElementById("section-submit-text");
  const form = document.getElementById("section-form");

  if (!modal || !title || !submitText || !form) return;

  title.textContent = editingSection ? "Edit Section" : "Add Section";
  submitText.textContent = editingSection ? "Update Section" : "Add Section";

  if (editingSection) {
    document.getElementById("section-name").value = editingSection.name;
    document.getElementById("section-color").value = editingSection.color;
  } else {
    form.reset();
  }

  modal.classList.remove("hidden");
}

function openTodoModal(sectionId = null, todoId = null) {
  editingTodo = todoId ? currentTodos.find((t) => t.id === todoId) : null;

  const modal = document.getElementById("todo-modal");
  const title = document.getElementById("todo-modal-title");
  const submitText = document.getElementById("todo-submit-text");
  const form = document.getElementById("todo-form");

  if (!modal || !title || !submitText || !form) return;

  title.textContent = editingTodo ? "Edit Todo" : "Add Todo";
  submitText.textContent = editingTodo ? "Update Todo" : "Add Todo";

  updateSectionSelects();
  updateAssigneeSelects();

  if (editingTodo) {
    document.getElementById("todo-title").value = editingTodo.title;
    document.getElementById("todo-description").value =
      editingTodo.description || "";
    document.getElementById("todo-section").value = editingTodo.sectionId;
    document.getElementById("todo-status").value = editingTodo.status;
    document.getElementById("todo-assignee").value =
      editingTodo.assignedTo || "";
  } else {
    form.reset();
    if (sectionId) {
      document.getElementById("todo-section").value = sectionId;
    }
  }

  modal.classList.remove("hidden");
}

function openTeamModal() {
  renderTeamMembers();
  const modal = document.getElementById("team-modal");
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function openStatisticsModal() {
  updateStatistics();
  const modal = document.getElementById("statistics-modal");
  if (modal) {
    modal.classList.remove("hidden");
    // Small delay to ensure modal is visible before rendering chart
    setTimeout(() => {
      renderStatisticsChart();
    }, 100);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
  }
  editingSection = null;
  editingTodo = null;
}

// Data Export Function
function exportData() {
  const data = {
    sections: currentSections,
    todos: currentTodos.map((todo) => ({
      ...todo,
      createdAt: todo.createdAt.toISOString(),
      modifiedAt: todo.modifiedAt.toISOString(),
    })),
    teamMembers: currentTeamMembers,
    exportDate: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(dataBlob);
  link.download = `team-todo-export-${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();
}

// Global Functions for onclick handlers
window.editSection = (sectionId) => openSectionModal(sectionId);
window.deleteSection = deleteSection;
window.editTodo = (todoId) => openTodoModal(null, todoId);
window.deleteTodo = deleteTodo;
window.updateTodoStatus = updateTodoStatus;
window.deleteTeamMember = deleteTeamMember;
window.openTodoModal = openTodoModal;
window.openTodoDetailsModal = openTodoDetailsModal;
window.addTodoComment = addTodoComment;

// Theme Management
function initializeTheme() {
  const savedTheme = localStorage.getItem("theme") || "auto";
  applyTheme(savedTheme);

  // Set the correct radio button
  const themeRadio = document.querySelector(
    `input[name="theme"][value="${savedTheme}"]`
  );
  if (themeRadio) {
    themeRadio.checked = true;
  }
}

function applyTheme(theme) {
  const html = document.documentElement;
  const themeIcon = document.getElementById("theme-icon");

  if (theme === "dark") {
    html.setAttribute("data-color-scheme", "dark");
    if (themeIcon) themeIcon.textContent = "☀️";
  } else if (theme === "light") {
    html.setAttribute("data-color-scheme", "light");
    if (themeIcon) themeIcon.textContent = "🌙";
  } else {
    html.removeAttribute("data-color-scheme");
    if (themeIcon) themeIcon.textContent = "🌙";
  }

  localStorage.setItem("theme", theme);
}

// App Initialization with Real-Time Listeners (UPDATED)
async function initializeApp() {
  try {
    console.log("Initializing Team Todo Manager...");

    const container = document.getElementById("sections-container");
    if (container) {
      container.innerHTML = '<div class="loading">Loading app...</div>';
    }

    await checkFirebaseConnection();

    if (isFirebaseConnected && db) {
      // Real-time sections listener
      if (sectionsUnsub) sectionsUnsub();
      sectionsUnsub = db.collection("sections").onSnapshot((snapshot) => {
        currentSections = [];
        snapshot.forEach((doc) => {
          currentSections.push({ id: doc.id, ...doc.data() });
        });
        renderSections();
        updateSectionSelects();
        updateFilters();
      });

      // Real-time todos listener
      if (todosUnsub) todosUnsub();
      todosUnsub = db.collection("todos").onSnapshot((snapshot) => {
        currentTodos = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          currentTodos.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : data.createdAt,
            modifiedAt: data.modifiedAt?.toDate
              ? data.modifiedAt.toDate()
              : data.modifiedAt,
          });
        });
        renderSections();
        updateStatistics();
      });

      // Real-time team members listener
      if (membersUnsub) membersUnsub();
      membersUnsub = db.collection("users").onSnapshot((snapshot) => {
        currentTeamMembers = [];
        snapshot.forEach((doc) => {
          currentTeamMembers.push({ id: doc.id, ...doc.data() });
        });
        updateAssigneeSelects();
        updateFilters();
        renderTeamMembers();
      });
    } else {
      // Offline mode
      currentSections = await loadSections();
      currentTodos = await loadTodos();
      currentTeamMembers = await loadTeamMembers();

      renderSections();
      updateSectionSelects();
      updateAssigneeSelects();
      updateFilters();
      renderTeamMembers();
    }

    updateStatistics();
    initializeTheme();

    console.log("App initialized successfully");
  } catch (error) {
    console.error("Error initializing app:", error);

    currentSections = [];
    currentTodos = [];
    currentTeamMembers = [];
    renderSections();
    updateStatistics();
    updateFilters();
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, setting up event listeners...");

  // Initialize the app
  initializeApp();

  // Section Modal Events
  const addSectionBtn = document.getElementById("add-section-btn");
  if (addSectionBtn) {
    addSectionBtn.addEventListener("click", () => openSectionModal());
  }

  const closeSectionModal = document.getElementById("close-section-modal");
  if (closeSectionModal) {
    closeSectionModal.addEventListener("click", () =>
      closeModal("section-modal")
    );
  }

  const cancelSection = document.getElementById("cancel-section");
  if (cancelSection) {
    cancelSection.addEventListener("click", () => closeModal("section-modal"));
  }

  const sectionForm = document.getElementById("section-form");
  if (sectionForm) {
    sectionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const sectionData = {
        name: formData.get("name"),
        color: formData.get("color"),
        isDefault: false,
      };

      await saveSection(sectionData);
      closeModal("section-modal");
    });
  }

  // Color preset buttons
  document.querySelectorAll(".color-preset").forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;
      const colorInput = document.getElementById("section-color");
      if (colorInput) {
        colorInput.value = color;
      }

      // Update active state
      document
        .querySelectorAll(".color-preset")
        .forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
    });
  });

  // Todo Modal Events
  const closeTodoModal = document.getElementById("close-todo-modal");
  if (closeTodoModal) {
    closeTodoModal.addEventListener("click", () => closeModal("todo-modal"));
  }

  const cancelTodo = document.getElementById("cancel-todo");
  if (cancelTodo) {
    cancelTodo.addEventListener("click", () => closeModal("todo-modal"));
  }

  const todoForm = document.getElementById("todo-form");
  if (todoForm) {
    todoForm.addEventListener("submit", async (e) => {
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
  }

  // Team Modal Events
  const teamBtn = document.getElementById("team-btn");
  if (teamBtn) {
    teamBtn.addEventListener("click", openTeamModal);
  }

  const closeTeamModal = document.getElementById("close-team-modal");
  if (closeTeamModal) {
    closeTeamModal.addEventListener("click", () => closeModal("team-modal"));
  }

  const addMemberBtn = document.getElementById("add-member-btn");
  if (addMemberBtn) {
    addMemberBtn.addEventListener("click", () => {
      const modal = document.getElementById("add-member-modal");
      if (modal) {
        modal.classList.remove("hidden");
      }
    });
  }

  const closeAddMemberModal = document.getElementById("close-add-member-modal");
  if (closeAddMemberModal) {
    closeAddMemberModal.addEventListener("click", () =>
      closeModal("add-member-modal")
    );
  }

  const cancelMember = document.getElementById("cancel-member");
  if (cancelMember) {
    cancelMember.addEventListener("click", () =>
      closeModal("add-member-modal")
    );
  }

  const addMemberForm = document.getElementById("add-member-form");
  if (addMemberForm) {
    addMemberForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const memberData = {
        name: formData.get("name"),
        email: formData.get("email"),
      };

      await saveTeamMember(memberData);
      closeModal("add-member-modal");
    });
  }

  // Statistics Modal Events
  const statisticsBtn = document.getElementById("statistics-btn");
  if (statisticsBtn) {
    statisticsBtn.addEventListener("click", openStatisticsModal);
  }

  const closeStatisticsModal = document.getElementById(
    "close-statistics-modal"
  );
  if (closeStatisticsModal) {
    closeStatisticsModal.addEventListener("click", () =>
      closeModal("statistics-modal")
    );
  }

  // Settings Modal Events
  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      const firebaseStatus = document.getElementById("firebase-status");
      if (firebaseStatus) {
        firebaseStatus.textContent = isFirebaseConnected
          ? "Connected to Firebase"
          : "Not connected to Firebase";
      }
      const modal = document.getElementById("settings-modal");
      if (modal) {
        modal.classList.remove("hidden");
      }
    });
  }

  const closeSettingsModal = document.getElementById("close-settings-modal");
  if (closeSettingsModal) {
    closeSettingsModal.addEventListener("click", () =>
      closeModal("settings-modal")
    );
  }

  const testConnectionBtn = document.getElementById("test-connection-btn");
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener("click", async () => {
      const firebaseStatus = document.getElementById("firebase-status");
      if (firebaseStatus) {
        firebaseStatus.textContent = "Testing connection...";
      }
      await checkFirebaseConnection();
      if (firebaseStatus) {
        firebaseStatus.textContent = isFirebaseConnected
          ? "Connected to Firebase"
          : "Connection failed";
      }
    });
  }

  const exportDataBtn = document.getElementById("export-data-btn");
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", exportData);
  }

  // Theme toggle
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = localStorage.getItem("theme") || "auto";
      const themes = ["auto", "light", "dark"];
      const nextIndex = (themes.indexOf(current) + 1) % themes.length;
      applyTheme(themes[nextIndex]);

      // Update radio button in settings
      const themeRadio = document.querySelector(
        `input[name="theme"][value="${themes[nextIndex]}"]`
      );
      if (themeRadio) {
        themeRadio.checked = true;
      }
    });
  }

  // Theme radio buttons
  document.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        applyTheme(e.target.value);
      }
    });
  });

  // Filter Events
  const statusFilter = document.getElementById("status-filter");
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      renderSections();
    });
  }

  const assigneeFilter = document.getElementById("assignee-filter");
  if (assigneeFilter) {
    assigneeFilter.addEventListener("change", () => {
      renderSections();
    });
  }

  // Close modals when clicking outside
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        editingSection = null;
        editingTodo = null;
      }
    });
  });

  console.log("Event listeners setup completed");
});
