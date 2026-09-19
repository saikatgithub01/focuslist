const STORAGE_KEY = 'focuslist:v1';

const state = {
  tasks: [],
  status: 'all',
  priority: 'all',
  search: '',
  composerPriority: 'medium',
};

const el = {
  form: document.getElementById('task-form'),
  input: document.getElementById('task-input'),
  list: document.getElementById('task-list'),
  search: document.getElementById('search-input'),
  empty: document.getElementById('empty-state'),
  noResults: document.getElementById('no-results'),
  statTotal: document.getElementById('stat-total'),
  statPending: document.getElementById('stat-pending'),
  statCompleted: document.getElementById('stat-completed'),
  statProgress: document.getElementById('stat-progress'),
  listCount: document.getElementById('list-count'),
  time: document.getElementById('time-display'),
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.tasks = raw ? JSON.parse(raw) : [];
  } catch { state.tasks = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function pad(n) { return n.toString().padStart(2, '0'); }

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  const date = new Date(ts);
  return `${pad(date.getDate())}.${pad(date.getMonth()+1)}.${date.getFullYear()}`;
}

function getFiltered() {
  return state.tasks.filter(t => {
    if (state.status === 'active' && t.completed) return false;
    if (state.status === 'completed' && !t.completed) return false;
    if (state.priority !== 'all' && t.priority !== state.priority) return false;
    if (state.search && !t.title.toLowerCase().includes(state.search.toLowerCase())) return false;
    return true;
  });
}

function render() {
  const filtered = getFiltered();
  el.list.innerHTML = '';

  // Empty states
  if (state.tasks.length === 0) {
    el.empty.style.display = 'block';
    el.noResults.style.display = 'none';
  } else if (filtered.length === 0) {
    el.empty.style.display = 'none';
    el.noResults.style.display = 'block';
  } else {
    el.empty.style.display = 'none';
    el.noResults.style.display = 'none';
  }

  // Priority sort weight: high > medium > low
  const weight = { high: 3, medium: 2, low: 1 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (weight[b.priority] !== weight[a.priority]) return weight[b.priority] - weight[a.priority];
    return b.createdAt - a.createdAt;
  });

  sorted.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} aria-label="Toggle complete" />
      <div class="task-body">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-meta">
          <span>${formatRelative(task.createdAt)}</span>
        </div>
      </div>
      <span class="p-tag p-tag-${task.priority}">
        <span class="pdot pdot-${task.priority === 'medium' ? 'med' : task.priority}"></span>
        ${task.priority}
      </span>
      <div class="task-actions">
        <button class="icon-btn edit" aria-label="Edit" title="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="icon-btn delete" aria-label="Delete" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;

    li.querySelector('.task-check').addEventListener('change', () => toggle(task.id));
    li.querySelector('.edit').addEventListener('click', () => beginEdit(task.id, li));
    li.querySelector('.delete').addEventListener('click', () => remove(task.id, li));

    el.list.appendChild(li);
  });

  el.listCount.textContent = `${sorted.length} shown / ${state.tasks.length} total`;

  updateStats();
}

function updateStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.completed).length;
  const pending = total - done;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  animate(el.statTotal, total);
  animate(el.statPending, pending);
  animate(el.statCompleted, done);
  el.statProgress.innerHTML = `${pct}<span class="stat-unit">%</span>`;
}

function animate(node, target) {
  const current = parseInt(node.textContent) || 0;
  const formatted = target < 100 ? target.toString().padStart(2, '0') : target.toString();
  if (current === target) { node.textContent = formatted; return; }
  node.textContent = formatted;
  node.style.transform = 'translateY(-2px)';
  requestAnimationFrame(() => {
    setTimeout(() => { node.style.transform = 'translateY(0)'; }, 180);
  });
}

function add(title, priority) {
  state.tasks.unshift({
    id: uid(),
    title: title.trim(),
    priority,
    completed: false,
    createdAt: Date.now(),
  });
  save();
  render();
}

function toggle(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  save();
  render();
}

function remove(id, li) {
  li.style.opacity = '0';
  li.style.transform = 'translateX(20px)';
  li.style.transition = 'opacity 200ms, transform 200ms';
  setTimeout(() => {
    state.tasks = state.tasks.filter(x => x.id !== id);
    save();
    render();
  }, 200);
}

function beginEdit(id, li) {
  const task = state.tasks.find(x => x.id === id);
  if (!task) return;
  const body = li.querySelector('.task-body');
  const original = task.title;

  body.innerHTML = `<input type="text" class="task-edit-input" value="${escapeHtml(original)}" maxlength="140" />`;
  const input = body.querySelector('.task-edit-input');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  const commit = () => {
    const val = input.value.trim();
    if (val && val !== original) { task.title = val; save(); }
    render();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = original; input.blur(); }
  });
}

function moveIndicator() {
  const container = document.querySelector('.filter-set');
  const active = container.querySelector('.filter-tab.active');
  const indicator = container.querySelector('.filter-indicator');
  if (!active || !indicator) return;
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.transform = `translateX(${active.offsetLeft - 3}px)`;
}

function updateClock() {
  const now = new Date();
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  el.time.textContent = `${days[now.getDay()]} · ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}


el.form.addEventListener('submit', e => {
  e.preventDefault();
  const title = el.input.value.trim();
  if (!title) return;
  add(title, state.composerPriority);
  el.input.value = '';
  el.input.focus();
});

document.querySelectorAll('.priority-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.priority-chip').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    state.composerPriority = btn.dataset.priority;
  });
});

el.search.addEventListener('input', e => {
  state.search = e.target.value;
  render();
});

document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.status = btn.dataset.filter;
    moveIndicator();
    render();
  });
});

document.querySelectorAll('.pchip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pchip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.priority = btn.dataset.priority;
    render();
  });
});

document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    el.search.focus();
  }
});

window.addEventListener('resize', moveIndicator);

load();
render();
updateClock();
moveIndicator();
setInterval(updateClock, 30000);