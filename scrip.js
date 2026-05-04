/* ============================================
   TICKET MANAGEMENT — JAVASCRIPT MODULE
   ============================================ */

// ---- State ----
let tickets = [];
let draggedTicketId = null;
let ticketViewMode = 'grid'; // 'grid' | 'list'

// ---- Constants ----
const TICKET_STATUS_LABELS = {
  'todo':        'Da Fare',
  'in-progress': 'In Corso',
  'review':      'In Review',
  'done':        'Completato'
};

const TICKET_STATUS_CHIPS = {
  'todo':        'status-todo',
  'in-progress': 'status-progress',
  'review':      'status-review',
  'done':        'status-done'
};

const PRIORITY_LABELS = {
  'high':   '🔴 Alta',
  'medium': '🟡 Media',
  'low':    '🟢 Bassa'
};

// ---- Persistence ----
function saveTickets() {
  localStorage.setItem('comeidea_tickets', JSON.stringify(tickets));
}

function loadTickets() {
  try {
    const saved = localStorage.getItem('comeidea_tickets');
    tickets = saved ? JSON.parse(saved) : [];
  } catch(e) {
    tickets = [];
  }
}

// ---- Utility ----
function getAssigneeInitials(name) {
  if (!name) return '?';
  return name.split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function isDueToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function getTagClass(tag) {
  const map = {
    'Bug': 'tag-bug',
    'Feature': 'tag-feature',
    'Design': 'tag-design',
    'Marketing': 'tag-marketing'
  };
  return map[tag] || 'tag-altro';
}

function getAvatarGradient(name) {
  const gradients = [
    'linear-gradient(135deg,#6C5CE7,#A29BFE)',
    'linear-gradient(135deg,#00CEC9,#55EFC4)',
    'linear-gradient(135deg,#FD79A8,#FDCB6E)',
    'linear-gradient(135deg,#E17055,#FDCB6E)',
    'linear-gradient(135deg,#74B9FF,#0984E3)'
  ];
  if (!name) return gradients[0];
  const idx = name.charCodeAt(0) % gradients.length;
  return gradients[idx];
}

function getProspectName(prospectId) {
  if (!prospectId) return null;
  const p = prospects.find(pr => pr.id == prospectId);
  return p ? p.name : null;
}

// ---- Filter Logic ----
function getFilteredTickets() {
  const search   = (document.getElementById('ticketSearchInput')?.value || '').toLowerCase();
  const status   = document.getElementById('ticketFilterStatus')?.value   || 'all';
  const priority = document.getElementById('ticketFilterPriority')?.value || 'all';
  const assignee = document.getElementById('ticketFilterAssignee')?.value || 'all';

  return tickets.filter(t => {
    const matchSearch   = !search   || t.title.toLowerCase().includes(search) ||
                          (t.assignee && t.assignee.toLowerCase().includes(search));
    const matchStatus   = status   === 'all' || t.status   === status;
    const matchPriority = priority === 'all' || t.priority === priority;
    const matchAssignee = assignee === 'all' || t.assignee === assignee;
    return matchSearch && matchStatus && matchPriority && matchAssignee;
  });
}

function filterTickets() {
  renderBoard();
  renderTicketList();
  updateTicketStats();
}

// ---- Stats ----
function updateTicketStats() {
  const total    = tickets.length;
  const open     = tickets.filter(t => t.status !== 'done').length;
  const dueToday = tickets.filter(t => isDueToday(t.dueDate) && t.status !== 'done').length;
  const done     = tickets.filter(t => t.status === 'done').length;

  document.getElementById('tStatTotal').textContent    = total;
  document.getElementById('tStatOpen').textContent     = open;
  document.getElementById('tStatDueToday').textContent = dueToday;
  document.getElementById('tStatDone').textContent     = done;
  document.getElementById('ticketOpenBadge').textContent =
    `${open} ${open === 1 ? 'aperto' : 'aperti'}`;
}

// ---- Render: Single Ticket Card ----
function buildTicketCard(ticket) {
  const doneSubtasks = ticket.subtasks.filter(s => s.done).length;
  const totalSubtasks = ticket.subtasks.length;
  const subtaskPct = totalSubtasks > 0 ? (doneSubtasks / totalSubtasks) * 100 : 0;
  const overdue = isOverdue(ticket.dueDate) && ticket.status !== 'done';
  const prospectName = getProspectName(ticket.prospectId);
  const initials = getAssigneeInitials(ticket.assignee);
  const avatarGrad = getAvatarGradient(ticket.assignee);
  const allDone = totalSubtasks > 0 && doneSubtasks === totalSubtasks;

  return `
    <div class="ticket-card"
         id="ticket-${ticket.id}"
         draggable="true"
         ondragstart="onDragStart(event, ${ticket.id})"
         ondragend="onDragEnd(event)">

      <div class="ticket-card-top">
        <span class="ticket-tag ${getTagClass(ticket.tag)}">${ticket.tag}</span>
        <span class="ticket-priority-badge priority-${ticket.priority}">
          ${ticket.priority === 'high' ? '🔴' : ticket.priority === 'medium' ? '🟡' : '🟢'}
          ${PRIORITY_LABELS[ticket.priority].replace(/^[^\s]+\s/, '')}
        </span>
      </div>

      <div class="ticket-title">${ticket.title}</div>

      ${ticket.description
        ? `<div class="ticket-desc">${ticket.description}</div>`
        : ''}

      ${prospectName
        ? `<div class="ticket-prospect-link">
             <i class="fas fa-building"></i>
             ${prospectName}
           </div>`
        : ''}

      ${totalSubtasks > 0 ? `
        <div class="subtask-progress">
          <div class="subtask-progress-fill" style="width:${subtaskPct}%"></div>
        </div>` : ''}

      <div class="ticket-card-footer">
        <div class="ticket-footer-left">
          ${totalSubtasks > 0
            ? `<div class="ticket-subtasks ${allDone ? 'all-done' : ''}">
                 <i class="fas fa-check-square"></i>
                 ${doneSubtasks}/${totalSubtasks}
               </div>`
            : ''}
          ${ticket.dueDate
            ? `<div class="ticket-due ${overdue ? 'overdue' : ''}">
                 <i class="fas fa-${overdue ? 'exclamation-circle' : 'calendar'}"></i>
                 ${formatDate(ticket.dueDate)}
               </div>`
            : ''}
        </div>
        <div class="ticket-footer-right">
          ${ticket.assignee
            ? `<div class="assignee-avatar"
                    style="background:${avatarGrad}"
                    title="${ticket.assignee}">
                 ${initials}
               </div>`
            : ''}
          <div class="ticket-actions">
            <button class="ticket-action-btn"
                    onclick="openEditTicket(${ticket.id})"
                    title="Modifica">
              <i class="fas fa-pen"></i>
            </button>
            <button class="ticket-action-btn delete"
                    onclick="deleteTicket(${ticket.id})"
                    title="Elimina">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- Render: Board ----
function renderBoard() {
  const filtered = getFilteredTickets();
  const columns  = ['todo', 'in-progress', 'review', 'done'];

  columns.forEach(status => {
    const colEl    = document.getElementById(`col-${status}`);
    const countEl  = document.getElementById(`colCount-${status}`);
    if (!colEl) return;

    const colTickets = filtered.filter(t => t.status === status);
    countEl.textContent = colTickets.length;

    if (colTickets.length === 0) {
      colEl.innerHTML = `
        <div class="kanban-empty">
          <i class="fas fa-inbox"></i>
          <span>Nessun ticket</span>
        </div>`;
    } else {
      colEl.innerHTML = colTickets.map(buildTicketCard).join('');
    }
  });
}

// ---- Render: List ----
function renderTicketList() {
  const filtered = getFilteredTickets();
  const tbody    = document.getElementById('ticketTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">
          <i class="fas fa-search" style="margin-right:8px;"></i>Nessun ticket trovato
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const doneS = t.subtasks.filter(s => s.done).length;
    const totS  = t.subtasks.length;
    const over  = isOverdue(t.dueDate) && t.status !== 'done';
    const pName = getProspectName(t.prospectId);

    return `
      <tr onclick="openEditTicket(${t.id})">
        <td>${t.title}</td>
        <td>
          <span class="status-chip ${TICKET_STATUS_CHIPS[t.status]}">
            ${TICKET_STATUS_LABELS[t.status]}
          </span>
        </td>
        <td>
          <span class="ticket-priority-badge priority-${t.priority}" style="display:inline-flex;">
            ${PRIORITY_LABELS[t.priority]}
          </span>
        </td>
        <td>
          ${t.assignee
            ? `<div style="display:flex;align-items:center;gap:6px;">
                 <div class="assignee-avatar" style="background:${getAvatarGradient(t.assignee)}">
                   ${getAssigneeInitials(t.assignee)}
                 </div>
                 ${t.assignee}
               </div>`
            : '<span style="color:var(--text-muted)">—</span>'}
        </td>
        <td>${pName
              ? `<span style="color:var(--secondary)">${pName}</span>`
              : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>
          ${t.dueDate
            ? `<span style="color:${over ? 'var(--danger)' : 'var(--text-secondary)'}">
                 ${over ? '⚠️ ' : ''}${formatDate(t.dueDate)}
               </span>`
            : '<span style="color:var(--text-muted)">—</span>'}
        </td>
        <td>
          ${totS > 0
            ? `<span style="color:${doneS===totS?'var(--success)':'var(--text-muted)'}">
                 ${doneS}/${totS}
               </span>`
            : '<span style="color:var(--text-muted)">—</span>'}
        </td>
        <td onclick="event.stopPropagation()" style="display:flex;gap:6px;padding:12px 14px;">
          <button class="ticket-action-btn" onclick="openEditTicket(${t.id})" title="Modifica">
            <i class="fas fa-pen"></i>
          </button>
          <button class="ticket-action-btn delete" onclick="deleteTicket(${t.id})" title="Elimina">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ---- View Toggle ----
function setTicketView(view, btn) {
  ticketViewMode = view;
  document.querySelectorAll('#tViewGrid, #tViewList').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const wrapper = document.getElementById('kanbanWrapper');
  if (view === 'list') {
    wrapper.classList.add('list-mode');
    renderTicketList();
  } else {
    wrapper.classList.remove('list-mode');
    renderBoard();
  }
}

// ---- Drag & Drop ----
function onDragStart(event, ticketId) {
  draggedTicketId = ticketId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', ticketId);
  setTimeout(() => {
    const card = document.getElementById(`ticket-${ticketId}`);
    if (card) card.classList.add('dragging');
  }, 0);
}

function onDragEnd(event) {
  if (draggedTicketId) {
    const card = document.getElementById(`ticket-${draggedTicketId}`);
    if (card) card.classList.remove('dragging');
  }
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
}

function onDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function onDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function onDrop(event, newStatus) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const id = parseInt(event.dataTransfer.getData('text/plain'));
  moveTicket(id, newStatus);
}

function moveTicket(id, newStatus) {
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return;

  const oldStatus = ticket.status;
  ticket.status   = newStatus;
  saveTickets();
  renderBoard();
  renderTicketList();
  updateTicketStats();

  if (oldStatus !== newStatus) {
    showNotification(`Ticket spostato in "${TICKET_STATUS_LABELS[newStatus]}"`);
  }
}

// ---- Modal: Open (New) ----
function openTicketModal(defaultStatus) {
  document.getElementById('ticketModalTitle').textContent = 'Nuovo Ticket';
  document.getElementById('ticketForm').reset();
  document.getElementById('tFormId').value = '';
  document.getElementById('subtaskList').innerHTML = '';
  document.getElementById('tFormStatus').value = defaultStatus || 'todo';
  document.getElementById('tFormStatusSelect').value = defaultStatus || 'todo';

  populateProspectDropdown('tFormProspect', null);
  document.getElementById('ticketModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ---- Modal: Open (Edit) ----
function openEditTicket(id) {
  const t = tickets.find(tk => tk.id === id);
  if (!t) return;

  document.getElementById('ticketModalTitle').textContent = 'Modifica Ticket';
  document.getElementById('tFormId').value             = t.id;
  document.getElementById('tFormTitle').value          = t.title;
  document.getElementById('tFormDescription').value    = t.description || '';
  document.getElementById('tFormStatusSelect').value   = t.status;
  document.getElementById('tFormStatus').value         = t.status;
  document.getElementById('tFormPriority').value       = t.priority;
  document.getElementById('tFormTag').value            = t.tag;
  document.getElementById('tFormAssignee').value       = t.assignee || '';
  document.getElementById('tFormDueDate').value        = t.dueDate || '';

  populateProspectDropdown('tFormProspect', t.prospectId);

  const subtaskList = document.getElementById('subtaskList');
  subtaskList.innerHTML = '';
  t.subtasks.forEach(sub => addSubtaskField(sub.text, sub.done));

  document.getElementById('ticketModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ---- Modal: Close ----
function closeTicketModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('ticketModalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ---- Prospect Dropdown ----
function populateProspectDropdown(selectId, selectedId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Nessuno —</option>';
  (prospects || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.sector})`;
    if (selectedId && p.id == selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ---- Subtask Fields ----
function addSubtaskField(text, done) {
  const list = document.getElementById('subtaskList');
  const idx  = list.children.length;
  const item = document.createElement('div');
  item.className   = 'subtask-item';
  item.dataset.idx = idx;
  item.innerHTML   = `
    <input type="text"
           placeholder="Descrizione subtask..."
           value="${text || ''}"
           class="subtask-text">
    <button type="button"
            class="subtask-remove-btn"
            onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  list.appendChild(item);
}

// ---- Submit: Add / Edit ----
function submitTicket(event) {
  event.preventDefault();

  const existingId = document.getElementById('tFormId').value;

  // Collect subtasks
  const subtaskEls = document.querySelectorAll('#subtaskList .subtask-item');
  const subtasks   = Array.from(subtaskEls)
    .map(el => ({
      text: el.querySelector('.subtask-text').value.trim(),
      done: false
    }))
    .filter(s => s.text !== '');

  // Preserve subtask done state on edit
  if (existingId) {
    const old = tickets.find(t => t.id == existingId);
    if (old) {
      subtasks.forEach(s => {
        const match = old.subtasks.find(os => os.text === s.text);
        if (match) s.done = match.done;
      });
    }
  }

  const statusVal = document.getElementById('tFormStatusSelect').value;

  const ticketData = {
    title:       document.getElementById('tFormTitle').value.trim(),
    description: document.getElementById('tFormDescription').value.trim(),
    status:      statusVal,
    priority:    document.getElementById('tFormPriority').value,
    tag:         document.getElementById('tFormTag').value,
    assignee:    document.getElementById('tFormAssignee').value.trim(),
    prospectId:  document.getElementById('tFormProspect').value || null,
    dueDate:     document.getElementById('tFormDueDate').value || null,
    subtasks
  };

  if (existingId) {
    // Edit mode
    const idx = tickets.findIndex(t => t.id == existingId);
    if (idx !== -1) {
      tickets[idx] = {
        ...tickets[idx],
        ...ticketData
      };
      showNotification(`Ticket "${ticketData.title}" aggiornato!`);
    }
  } else {
    // New mode
    tickets.push({
      id: Date.now(),
      ...ticketData,
      createdAt: Date.now()
    });
    showNotification(`Ticket "${ticketData.title}" creato!`);
  }

  saveTickets();
  closeTicketModal();
  renderBoard();
  renderTicketList();
  updateTicketStats();
  updateAssigneeFilter();
}

// ---- Delete ----
function deleteTicket(id) {
  const t = tickets.find(tk => tk.id === id);
  if (!t) return;
  if (!confirm(`Eliminare il ticket "${t.title}"?`)) return;

  tickets = tickets.filter(tk => tk.id !== id);
  saveTickets();
  renderBoard();
  renderTicketList();
  updateTicketStats();
  updateAssigneeFilter();
  showNotification(`Ticket eliminato.`);
}

// ---- Assignee Filter Populate ----
function updateAssigneeFilter() {
  const sel = document.getElementById('ticketFilterAssignee');
  if (!sel) return;
  const current = sel.value;
  const assignees = [...new Set(
    tickets.map(t => t.assignee).filter(a => a && a.trim() !== '')
  )].sort();

  sel.innerHTML = '<option value="all">Tutti gli assegnati</option>';
  assignees.forEach(a => {
    const opt = document.createElement('option');
    opt.value       = a;
    opt.textContent = a;
    if (a === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ---- Navbar: add Ticket link ----
function injectTicketNavLink() {
  const navLinks = document.getElementById('navLinks');
  if (!navLinks) return;
  // Avoid duplicates
  if (navLinks.querySelector('a[href="#tickets"]')) return;

  const link = document.createElement('a');
  link.href        = '#tickets';
  link.textContent = 'Ticket';
  // Insert before the button
  const btn = navLinks.querySelector('.btn-add-prospect');
  navLinks.insertBefore(link, btn);
}

// ---- INIT ----
function initTickets() {
  loadTickets();
  renderBoard();
  renderTicketList();
  updateTicketStats();
  updateAssigneeFilter();
  injectTicketNavLink();
}

// Bootstrap after DOM is ready
// (called at the bottom of the existing init block)
initTickets();
