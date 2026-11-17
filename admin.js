// Supabase configuration
// Supabase auth and app configuration.
// These values are used for the admin dashboard login and course management flows.
const SUPABASE_URL = 'https://lfzukqnvyvjnwyhjnjho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Own4ZNjQR1ojVniwJxbj2Q_sVFC9Ycw';
const ACCESS_TOKEN_KEY = 'supabase_access_token';
const REFRESH_TOKEN_KEY = 'supabase_refresh_token';
const EXPIRES_AT_KEY = 'supabase_expires_at';

// DOM references for the login and dashboard panels.
const authSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const logoutBtn = document.getElementById('logoutBtn');
const courseForm = document.getElementById('courseForm');
const formMessage = document.getElementById('formMessage');
const coursesList = document.getElementById('coursesList');
const refreshCoursesBtn = document.getElementById('refreshCoursesBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formHeading = document.getElementById('formHeading');
const submitCourseBtn = document.getElementById('submitCourseBtn');
const adminSearchInput = document.getElementById('adminSearch');
const reviewStatusFilter = document.getElementById('reviewStatusFilter');
const perPageSelect = document.getElementById('perPageSelect');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const showMoreBtn = document.getElementById('showMoreBtn');
const pageInfo = document.getElementById('pageInfo');
// DOM references for the CSV import flow.
const courseCsvFile = document.getElementById('courseCsvFile');
const courseImportBtn = document.getElementById('courseImportBtn');
const importFileName = document.getElementById('importFileName');
const importPreview = document.getElementById('importPreview');
const importMessage = document.getElementById('importMessage');

// Shared state for pagination, filtering and editing.
let currentEditingCourseId = null;
let cachedCourses = [];
let filteredCourses = [];
let currentPage = 1;
let perPage = 25;
let currentReviewStatusFilter = '';
let pendingImportRows = [];

// Small helper wrapper around Supabase auth and REST calls.
const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  refreshPromise: null,

  async request(method, path, body, token = null, retry = false, extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      apikey: this.key,
      Authorization: token ? `Bearer ${token}` : `Bearer ${this.key}`,
      ...extraHeaders,
    };

    const response = await fetch(`${this.url}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    const contentType = response.headers.get('content-type');

    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseErr) {
      console.error('Parse error:', parseErr);
      data = { error: 'Invalid response from server' };
    }

    if (!response.ok) {
      const errorMsg = data.message || data.error || `HTTP ${response.status}`;
      const expiredToken = errorMsg.toLowerCase().includes('jwt expired') || errorMsg.toLowerCase().includes('invalid jwt') || errorMsg.toLowerCase().includes('authorization required');

      if (token && expiredToken && !retry) {
        const refreshedToken = await this.refreshSession();
        if (refreshedToken) {
          return this.request(method, path, body, refreshedToken, true);
        }
      }

      throw new Error(errorMsg);
    }

    return data;
  },

  async signIn(email, password) {
    const data = await this.request('POST', '/auth/v1/token?grant_type=password', {
      email,
      password,
    });
    if (data?.access_token) {
      storeAuthSession(data);
    }
    return data;
  },

  async refreshSession() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearAuthSession();
      return null;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        let data;
        const contentType = response.headers.get('content-type');
        try {
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
        } catch (parseErr) {
          console.error('Refresh parse error:', parseErr);
          data = { error: 'Unable to refresh session' };
        }

        if (!response.ok || !data?.access_token) {
          clearAuthSession();
          return null;
        }

        storeAuthSession(data);
        return data.access_token;
      } catch (error) {
        console.error('Session refresh failed:', error);
        clearAuthSession();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  },
};

// When login succeeds, keep the access token so the admin session stays active.
function storeAuthSession(sessionData) {
  if (sessionData?.access_token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, sessionData.access_token);
  }
  if (sessionData?.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, sessionData.refresh_token);
  }
  if (sessionData?.expires_at) {
    localStorage.setItem(EXPIRES_AT_KEY, sessionData.expires_at);
  }
}

function filterCourses(query, reviewStatus = '') {
  let result = cachedCourses.slice();

  // Filter by review status first
  if (reviewStatus) {
    result = result.filter(c => c.review_status === reviewStatus);
  }

  // Then filter by search query
  if (!query) return result;
  const q = String(query).toLowerCase().trim();
  return result.filter(c => {
    const title = (c.title || '').toString().toLowerCase();
    const provider = (c.provider || '').toString().toLowerCase();
    const cats = (Array.isArray(c.category) ? c.category.join(' ') : (c.category || '')).toString().toLowerCase();
    return title.includes(q) || provider.includes(q) || cats.includes(q);
  });
}

function updatePageInfo() {
  const total = filteredCourses.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

function renderCoursesPage() {
  if (!Array.isArray(filteredCourses)) filteredCourses = cachedCourses.slice();
  const total = filteredCourses.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageItems = filteredCourses.slice(start, end);
  renderCoursesList(pageItems);
  updatePageInfo();
}

function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

function updateCachedCourse(courseId, updates) {
  const normalizedId = String(courseId);

  cachedCourses = cachedCourses.map(course => {
    if (String(course.id) !== normalizedId) {
      return course;
    }

    return {
      ...course,
      ...updates,
      id: course.id,
    };
  });

  filteredCourses = filteredCourses.map(course => {
    if (String(course.id) !== normalizedId) {
      return course;
    }

    return {
      ...course,
      ...updates,
      id: course.id,
    };
  });

  renderCoursesPage();
}

function removeCachedCourse(courseId) {
  const normalizedId = String(courseId);

  cachedCourses = cachedCourses.filter(course => String(course.id) !== normalizedId);
  filteredCourses = filteredCourses.filter(course => String(course.id) !== normalizedId);
  renderCoursesPage();
}

function showActionConfirmation({ title, message, confirmLabel, confirmClassName, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15, 23, 42, 0.55)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '2000';
  overlay.style.padding = '16px';

  const dialog = document.createElement('div');
  dialog.style.background = '#fff';
  dialog.style.borderRadius = '12px';
  dialog.style.maxWidth = '480px';
  dialog.style.width = '100%';
  dialog.style.padding = '20px';
  dialog.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2)';

  dialog.innerHTML = `
    <h3 style="margin: 0 0 10px; color: #0f172a;">${title}</h3>
    <p style="margin: 0 0 18px; color: #334155;">${message}</p>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button type="button" class="confirm-cancel" style="padding: 10px 14px; border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; cursor: pointer;">Cancel</button>
      <button type="button" class="confirm-action ${confirmClassName || ''}" style="padding: 10px 14px; border: 0; background: #2563eb; color: #fff; border-radius: 8px; cursor: pointer;">${confirmLabel}</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const cleanup = () => overlay.remove();
  overlay.querySelector('.confirm-cancel').addEventListener('click', cleanup);
  overlay.querySelector('.confirm-action').addEventListener('click', () => {
    cleanup();
    onConfirm();
  });
}

function showArchiveConfirmation(course, onConfirm) {
  showActionConfirmation({
    title: 'Archive course?',
    message: `${(course.title || 'This course').replace(/</g, '&lt;')} will be marked as archived and hidden from the public search.`,
    confirmLabel: 'Archive',
    confirmClassName: 'archive-confirm-action',
    onConfirm,
  });
}

function showDeleteConfirmation(course, onConfirm) {
  showActionConfirmation({
    title: 'Delete course permanently?',
    message: `${(course.title || 'This course').replace(/</g, '&lt;')} will be permanently removed from the catalogue. This cannot be undone.`,
    confirmLabel: 'Delete permanently',
    confirmClassName: 'delete-confirm-action',
    onConfirm,
  });
}

function setAuthVisibility(isAuthenticated) {
  authSection.style.display = isAuthenticated ? 'none' : 'block';
  dashboardSection.style.display = isAuthenticated ? 'block' : 'none';

  if (!isAuthenticated) {
    cachedCourses = [];
    renderCoursesList([]);
    setFormMode(false);
  }
}

async function getValidAccessToken() {
  const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (storedToken) {
    return storedToken;
  }

  return supabase.refreshSession();
}

function formatArrayField(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value ?? '';
}

// Build the object that matches the courses_new table before submitting to Supabase.
function createCoursePayload(formData) {
  const rawCostValue = formData.get('cost_gbp');
  const costValue = Number(rawCostValue);
  const normalizedCostValue = Number.isNaN(costValue) ? 0 : Math.max(0, costValue);

  return {
    title: formData.get('title')?.toString().trim(),
    description: formData.get('description')?.toString().trim(),
    provider: formData.get('provider')?.toString().trim(),
    delivery_mode: formData.get('delivery_mode')?.toString().trim(),
    cost_gbp: normalizedCostValue,
    cost_category: formData.get('cost_category')?.toString().trim() || 'NA',
    duration: formData.get('duration')?.toString().trim() || 'NA',
    duration_category: formData.get('duration_category')?.toString().trim() || null,
    access: formData.get('access')?.toString().trim() || 'NA',
    education_outcome: formData.get('education_outcome')?.toString().trim() || 'NA',
    target_audience: formatArrayField(formData.get('target_audience')),
    category: formatArrayField(formData.get('category')),
    asset_category: formData.get('asset_category')?.toString().trim() || null,
    review_status: formData.get('review_status')?.toString().trim() || 'Draft',
    course_expires: formData.get('course_expires')?.toString().trim() || null,
    image_url: formData.get('image_url')?.toString().trim() || null,
    url: formData.get('url')?.toString().trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function setFormMode(isEditing, course = null) {
  currentEditingCourseId = isEditing ? course?.id ?? null : null;
  formHeading.textContent = isEditing ? 'Edit Course' : 'Add New Course';
  submitCourseBtn.textContent = isEditing ? 'Update Course' : 'Add Course';
  cancelEditBtn.style.display = isEditing ? 'inline-flex' : 'none';

  if (!isEditing) {
    courseForm.reset();
  } else if (course) {
    document.getElementById('title').value = course.title || '';
    document.getElementById('description').value = course.description || '';
    document.getElementById('provider').value = course.provider || '';
    document.getElementById('url').value = course.url || '';
    document.getElementById('deliveryMode').value = course.delivery_mode || '';
    document.getElementById('duration').value = course.duration || '';
    document.getElementById('access').value = course.access || '';
    document.getElementById('educationOutcome').value = course.education_outcome || '';
    document.getElementById('costCategory').value = course.cost_category || '';
    document.getElementById('costGbp').value = course.cost_gbp ?? '';
    document.getElementById('durationCategory').value = course.duration_category || '';
    document.getElementById('assetCategory').value = course.asset_category || '';
    document.getElementById('reviewStatus').value = course.review_status || 'Draft';
    document.getElementById('courseExpires').value = course.course_expires ? String(course.course_expires).slice(0, 10) : '';
    document.getElementById('imageUrl').value = course.image_url || '';
    document.getElementById('category').value = formatValue(course.category);
    document.getElementById('targetAudience').value = formatValue(course.target_audience);
  }
}

function renderCoursesList(courses) {
  if (!courses.length) {
    coursesList.innerHTML = '<div class="empty-state">No courses yet. Start by adding your first course.</div>';
    return;
  }

  coursesList.innerHTML = courses.map(course => {
    const costLabel = course.cost_category || 'N/A';
    const reviewStatusClass = `review-status-${(course.review_status || 'draft').toLowerCase().replace(/\s+/g, '-')}`;

    return `
      <article class="course-manager-card">
        <div class="course-manager-card-content">
          <div>
            <div class="course-manager-title-row">
              <h3>${course.title || 'Untitled course'}</h3>
              <span class="review-status-badge ${reviewStatusClass}">${course.review_status || 'Draft'}</span>
            </div>
            <p class="course-manager-meta">${course.provider || 'Unknown provider'} • ${course.delivery_mode || 'N/A'} • ${costLabel}</p>
            <p class="course-manager-meta category-meta">${Array.isArray(course.category) ? course.category.join(', ') : course.category || 'No categories'}</p>
          </div>
        </div>
        <div class="course-manager-actions">
          <button type="button" class="edit-btn" data-action="edit" data-id="${course.id}" aria-label="Edit ${course.title}">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Edit
          </button>
          <button type="button" class="archive-btn" data-action="archive" data-id="${course.id}" aria-label="Archive ${course.title}">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 4h18v3H3V4zm2 4h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8zm3 2v8h2v-8H8zm4 0v8h2v-8h-2z"/></svg>
            Archive
          </button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${course.id}" aria-label="Delete ${course.title}">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Delete
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function fetchCourses() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    formMessage.textContent = 'Your session has expired. Please sign in again.';
    renderCoursesList([]);
    setAuthVisibility(false);
    return;
  }

  try {
    try {
      const expiryResponse = await fetch('/api/courses/expire', { method: 'POST' });
      if (!expiryResponse.ok) {
        throw new Error(`Expiry update failed: ${expiryResponse.status}`);
      }
    } catch (error) {
      console.warn('Unable to update expired course statuses:', error);
    }

    const data = await supabase.request('GET', '/rest/v1/courses_new?select=*&order=created_at.desc', null, accessToken);
    cachedCourses = Array.isArray(data) ? data : [];
    // initialize filtering and pagination
    const searchQuery = adminSearchInput?.value || '';
    filteredCourses = filterCourses(searchQuery, currentReviewStatusFilter);
    currentPage = 1;
    perPage = Number(perPageSelect?.value) || 25;
    renderCoursesPage();
  } catch (error) {
    console.error('Unable to load courses:', error);
    coursesList.innerHTML = '<div class="empty-state">Unable to load courses right now.</div>';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  loginMessage.textContent = '';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    loginMessage.textContent = 'Please provide both email and password.';
    return;
  }

  try {
    const data = await supabase.signIn(email, password);
    const accessToken = data.access_token;
    if (!accessToken) {
      throw new Error('Failed to retrieve auth token.');
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem('supabase_user_email', email);
    setAuthVisibility(true);
    await fetchCourses();
  } catch (error) {
    console.error('Login failed:', error);
    loginMessage.textContent = 'Login failed. Check your credentials and try again.';
  }
}

function handleLogout() {
  localStorage.removeItem('supabase_user_email');
  clearAuthSession();
  setAuthVisibility(false);
}

async function handleCourseSubmit(event) {
  event.preventDefault();
  formMessage.textContent = '';

  const formData = new FormData(courseForm);
  const payload = createCoursePayload(formData);
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    formMessage.textContent = 'Your session has expired. Please sign in again.';
    setAuthVisibility(false);
    return;
  }

  try {
    if (currentEditingCourseId) {
      const updatedCourse = await supabase.request(
        'PATCH',
        `/rest/v1/courses_new?id=eq.${encodeURIComponent(currentEditingCourseId)}`,
        payload,
        accessToken,
        false,
        { Prefer: 'return=representation' }
      );

      const savedCourse = Array.isArray(updatedCourse) && updatedCourse[0]
        ? updatedCourse[0]
        : { ...payload, id: currentEditingCourseId };

      updateCachedCourse(currentEditingCourseId, savedCourse);
      formMessage.textContent = 'Course updated successfully.';
    } else {
      await supabase.request('POST', '/rest/v1/courses_new', payload, accessToken);
      formMessage.textContent = 'Course added successfully.';
    }

    courseForm.reset();
    setFormMode(false);
    await fetchCourses();
  } catch (error) {
    console.error('Course save failed:', error);
    const detail = error?.message ? ` ${error.message}` : '';
    formMessage.textContent = `Unable to save the course.${detail}`;
  }
}

async function handleCourseListAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const courseId = button.dataset.id;
  const course = cachedCourses.find(item => String(item.id) === String(courseId));

  if (!course) return;

  if (action === 'edit') {
    setFormMode(true, course);
    formMessage.textContent = 'Editing an existing course.';
    document.getElementById('title').focus();
    return;
  }

  if (action === 'archive') {
    event.preventDefault();
    event.stopPropagation();

    showArchiveConfirmation(course, async () => {
      button.disabled = true;
      button.textContent = 'Archiving…';
      formMessage.textContent = 'Archiving course...';

      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        formMessage.textContent = 'Your session has expired. Please sign in again.';
        setAuthVisibility(false);
        return;
      }

      try {
        const payload = {
          review_status: 'Archived',
          updated_at: new Date().toISOString(),
        };

        await supabase.request(
          'PATCH',
          `/rest/v1/courses_new?id=eq.${encodeURIComponent(courseId)}`,
          payload,
          accessToken,
          false,
          { Prefer: 'return=representation' }
        );

        removeCachedCourse(course.id);
        formMessage.textContent = 'Course archived successfully.';
        if (currentEditingCourseId === course.id) {
          setFormMode(false);
        }
      } catch (error) {
        console.error('Course archive failed:', error);
        formMessage.textContent = 'Unable to archive the course. Please try again.';
        await fetchCourses();
      } finally {
        button.disabled = false;
        button.textContent = 'Archive';
      }
    });
    return;
  }

  if (action === 'delete') {
    event.preventDefault();
    event.stopPropagation();

    showDeleteConfirmation(course, async () => {
      button.disabled = true;
      button.textContent = 'Deleting…';
      formMessage.textContent = 'Deleting course...';

      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        formMessage.textContent = 'Your session has expired. Please sign in again.';
        setAuthVisibility(false);
        return;
      }

      try {
        await supabase.request(
          'DELETE',
          `/rest/v1/courses_new?id=eq.${encodeURIComponent(courseId)}`,
          null,
          accessToken
        );

        removeCachedCourse(course.id);
        formMessage.textContent = 'Course deleted permanently.';
        if (currentEditingCourseId === course.id) {
          setFormMode(false);
        }
      } catch (error) {
        console.error('Course delete failed:', error);
        formMessage.textContent = 'Unable to delete the course. Please try again.';
        await fetchCourses();
      } finally {
        button.disabled = false;
        button.textContent = 'Delete';
      }
    });
  }
}

// ------------------------------------------------------------------
// CSV import (AI research skill bulk upload)
// ------------------------------------------------------------------
const IMPORT_REVIEW_STATUS = 'Draft';

// Header aliases used when matching an uploaded CSV to the courses_new schema.
const IMPORT_FIELD_ALIASES = {
  title: ['title', 'course title', 'course'],
  description: ['description', 'course description', 'summary', 'overview'],
  provider: ['provider', 'course provider', 'organisation', 'organization'],
  url: ['url', 'course url', 'link', 'course link'],
  delivery_mode: ['delivery_mode', 'delivery mode', 'delivery'],
  duration: ['duration', 'course duration'],
  access: ['access', 'how to access', 'booking'],
  education_outcome: ['education_outcome', 'education outcome', 'outcome', 'qualification'],
  cost_category: ['cost_category', 'cost category', 'cost'],
  cost_gbp: ['cost_gbp', 'cost gbp', 'cost (gbp)', 'cost (£)', 'price', 'price (gbp)', 'price (£)'],
  category: ['category', 'categories', 'topic', 'topics'],
  target_audience: ['target_audience', 'target audience', 'audience'],
  duration_category: ['duration_category', 'duration category'],
  asset_category: ['asset_category', 'asset category'],
  image_url: ['image_url', 'image url', 'image'],
  course_expires: ['course_expires', 'course expiry date', 'expiry date', 'expires', 'expiry'],
};

const IMPORT_DELIVERY_MODES = ['Online', 'Face to Face', 'Hybrid', 'NA'];
const IMPORT_COST_CATEGORIES = ['Free', 'Paid', 'TBC', 'NA'];
const IMPORT_DURATION_CATEGORIES = ['Less than an hour', 'Less than a day', 'Less than a week', 'Less than a year', 'Various'];

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeHeaderName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapCsvHeader(header) {
  const normalized = normalizeHeaderName(header);
  for (const [field, aliases] of Object.entries(IMPORT_FIELD_ALIASES)) {
    if (aliases.some(alias => normalizeHeaderName(alias) === normalized)) {
      return field;
    }
  }
  return null;
}

// Robust CSV parser: quoted fields, embedded commas, escaped quotes, CRLF.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      field = '';
      if (row.some(cell => String(cell).trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some(cell => String(cell).trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

function setImportMessage(message, isError = false) {
  if (isError) {
    importMessage.classList.add('error');
  } else {
    importMessage.classList.remove('error');
  }
  importMessage.textContent = message;
}

function handleCourseCsvFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  setImportMessage('');
  importFileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCSV(String(reader.result || ''));
      if (rows.length < 2) {
        throw new Error('The file needs a header row plus at least one course row.');
      }

      const fields = rows[0].map(mapCsvHeader);
      const dataRows = rows.slice(1).map(row => {
        const record = {};
        fields.forEach((field, index) => {
          if (field && row[index] !== undefined) {
            record[field] = String(row[index]).trim();
          }
        });
        return record;
      });

      pendingImportRows = dataRows;
      renderImportPreview(dataRows);
    } catch (error) {
      console.error('CSV parse failed:', error);
      pendingImportRows = [];
      renderImportPreview([]);
      setImportMessage(`Unable to read CSV: ${error.message}`, true);
    }
  };
  reader.onerror = () => {
    setImportMessage('Unable to read the selected file. Please try again.', true);
  };
  reader.readAsText(file, 'UTF-8');
}

function normalizeUrlForDedupe(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/+$/, '');
}

function isDuplicateCourse({ url, title }) {
  const normUrl = normalizeUrlForDedupe(url);
  const normTitle = String(title || '').trim().toLowerCase();

  return (cachedCourses || []).some(course => {
    const courseUrl = normalizeUrlForDedupe(course.url);
    const courseTitle = String(course.title || '').trim().toLowerCase();
    return (
      (normUrl && courseUrl && normUrl === courseUrl) ||
      (normTitle && courseTitle && normTitle === courseTitle)
    );
  });
}

function inferDurationCategory(durationText) {
  const lower = String(durationText || '').toLowerCase();
  if (/(\d+)\s*min|minutes?\b/.test(lower)) return 'Less than an hour';
  if (/(\d+)\s*hour/.test(lower)) return 'Less than a day';
  if (/weeks?\b/.test(lower)) return 'Less than a week';
  if (/(\d+)\s*days?\b/.test(lower)) return 'Less than a day';
  if (/months?\b|years?\b/.test(lower)) return 'Less than a year';
  if (/varies|various|flexible/.test(lower)) return 'Various';
  return '';
}

// Split comma-separated values, keeping parenthesised groups intact
// (e.g. "All (health, social care, VSO)" stays as one item).
function formatImportArray(value) {
  if (!value) return [];
  const parts = [];
  let current = '';
  let depth = 0;
  for (const ch of String(value)) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';' || ch === '\n') && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Turn one CSV row into a payload matching the courses_new table.
function normalizeImportCourse(raw) {
  const title = String(raw.title || '').trim();
  const provider = String(raw.provider || '').trim();
  if (!title || !provider) {
    return { error: 'Missing required field (title / provider)' };
  }

  let deliveryMode = String(raw.delivery_mode || '').trim();
  if (deliveryMode && !IMPORT_DELIVERY_MODES.includes(deliveryMode)) {
    const lower = deliveryMode.toLowerCase();
    if (lower.includes('online') && (lower.includes('face') || lower.includes('classroom'))) {
      deliveryMode = 'Hybrid';
    } else if (lower.includes('online')) {
      deliveryMode = 'Online';
    } else if (lower.includes('face') || lower.includes('classroom') || lower.includes('in person') || lower.includes('in-person')) {
      deliveryMode = 'Face to Face';
    } else {
      deliveryMode = 'NA';
    }
  }

  let costCategory = String(raw.cost_category || '').trim();
  if (costCategory && !IMPORT_COST_CATEGORIES.includes(costCategory)) {
    const lower = costCategory.toLowerCase();
    if (lower.includes('free')) {
      costCategory = 'Free';
    } else if (lower.includes('paid') || lower.includes('£') || lower.includes('gbp') || lower.includes('price')) {
      costCategory = 'Paid';
    } else {
      costCategory = 'TBC';
    }
  }

  const costRaw = String(raw.cost_gbp || '').replace(/[£,€\s]/g, '');
  const costNumber = Number(costRaw);
  const costGbp = Number.isFinite(costNumber) ? Math.max(0, costNumber) : 0;

  const duration = String(raw.duration || '').trim();
  let durationCategory = String(raw.duration_category || '').trim();
  if (durationCategory && !IMPORT_DURATION_CATEGORIES.includes(durationCategory)) {
    durationCategory = '';
  }
  if (!durationCategory && duration) {
    durationCategory = inferDurationCategory(duration);
  }

  const courseExpiresRaw = String(raw.course_expires || '').trim();
  const courseExpires = /^\d{4}-\d{2}-\d{2}$/.test(courseExpiresRaw) ? courseExpiresRaw : null;

  return {
    payload: {
      title,
      description: String(raw.description || '').trim() || 'No description provided.',
      provider,
      url: String(raw.url || '').trim() || null,
      delivery_mode: deliveryMode || 'NA',
      duration: duration || 'NA',
      access: String(raw.access || '').trim() || 'NA',
      education_outcome: String(raw.education_outcome || '').trim() || 'NA',
      cost_category: costCategory || 'NA',
      cost_gbp: costGbp,
      category: formatImportArray(raw.category),
      target_audience: formatImportArray(raw.target_audience),
      duration_category: durationCategory || null,
      asset_category: String(raw.asset_category || '').trim() || null,
      image_url: String(raw.image_url || '').trim() || null,
      review_status: IMPORT_REVIEW_STATUS,
      course_expires: courseExpires,
      updated_at: new Date().toISOString(),
    },
    url: String(raw.url || '').trim(),
    title,
  };
}

function renderImportPreview(rows) {
  importPreview.innerHTML = '';
  importPreview.hidden = true;
  courseImportBtn.disabled = true;
  setImportMessage('');

  if (!rows.length) {
    return;
  }

  const headers = ['Title', 'Provider', 'URL', 'Delivery', 'Cost', 'Categories', 'Status'];
  const seenInFile = new Set();

  const body = rows.map(raw => {
    const normalized = normalizeImportCourse(raw);
    let status;
    let statusClass;

    if (normalized.error) {
      status = normalized.error;
      statusClass = 'import-status-failed';
    } else {
      const key = normalizeUrlForDedupe(normalized.url) || String(normalized.title).trim().toLowerCase();
      if (isDuplicateCourse(normalized) || seenInFile.has(key)) {
        status = 'Duplicate - will be skipped';
        statusClass = 'import-status-dup';
      } else {
        status = 'New - will be added as Draft';
        statusClass = 'import-status-new';
      }
      seenInFile.add(key);
    }

    return `
      <tr>
        <td>${escapeHtml(raw.title || '')}</td>
        <td>${escapeHtml(raw.provider || '')}</td>
        <td class="import-cell-url" title="${escapeHtml(raw.url || '')}">${escapeHtml(raw.url || '')}</td>
        <td>${escapeHtml(raw.delivery_mode || '')}</td>
        <td>${escapeHtml(raw.cost_category || '')}</td>
        <td>${escapeHtml(raw.category || '')}</td>
        <td><span class="${statusClass}">${escapeHtml(status)}</span></td>
      </tr>`;
  }).join('');

  importPreview.innerHTML = `
    <table class="import-table">
      <thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="import-summary">${rows.length} row(s) loaded. Duplicates are detected against the current catalogue and within the file, and are skipped automatically.</p>`;
  importPreview.hidden = false;
  courseImportBtn.disabled = false;
}

function renderImportResults(detailRows, results) {
  const body = detailRows.map(row => `
    <tr>
      <td>${escapeHtml(row.title)}</td>
      <td><span class="${row.statusClass}">${escapeHtml(row.status)}</span></td>
    </tr>`).join('');

  importPreview.innerHTML = `
    <table class="import-table">
      <thead><tr><th>Title</th><th>Result</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="import-summary"><strong>${results.imported}</strong> imported as Draft &bull; <strong>${results.skipped}</strong> duplicates skipped &bull; <strong>${results.failed}</strong> failed</p>`;
  importPreview.hidden = false;
}

async function handleCourseCsvImport() {
  if (!pendingImportRows || !pendingImportRows.length) {
    setImportMessage('Choose a CSV file first, then press Import.', true);
    return;
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    setImportMessage('Your session has expired. Please sign in again.', true);
    setAuthVisibility(false);
    return;
  }

  courseImportBtn.disabled = true;
  courseImportBtn.textContent = 'Importing…';
  setImportMessage('');

  const results = { imported: 0, skipped: 0, failed: 0 };
  const detailRows = [];
  const seenThisRun = new Set();

  for (const raw of pendingImportRows) {
    const normalized = normalizeImportCourse(raw);

    if (normalized.error) {
      results.failed += 1;
      detailRows.push({
        title: raw.title || '(untitled)',
        status: normalized.error,
        statusClass: 'import-status-failed',
      });
      continue;
    }

    const key = normalizeUrlForDedupe(normalized.url) || String(normalized.title).trim().toLowerCase();
    if (isDuplicateCourse(normalized) || seenThisRun.has(key)) {
      results.skipped += 1;
      detailRows.push({
        title: normalized.title,
        status: 'Duplicate - skipped',
        statusClass: 'import-status-dup',
      });
      continue;
    }

    try {
      await supabase.request('POST', '/rest/v1/courses_new', normalized.payload, accessToken);
      seenThisRun.add(key);
      results.imported += 1;
      detailRows.push({
        title: normalized.title,
        status: 'Imported as Draft',
        statusClass: 'import-status-imported',
      });
    } catch (error) {
      console.error('Course import failed:', error);
      results.failed += 1;
      detailRows.push({
        title: normalized.title,
        status: `Failed: ${error.message}`,
        statusClass: 'import-status-failed',
      });
    }
  }

  renderImportResults(detailRows, results);
  setImportMessage(`Import complete - ${results.imported} added as Draft, ${results.skipped} duplicates skipped, ${results.failed} failed.`);
  if (results.failed > 0) {
    importMessage.classList.add('error');
  }

  courseImportBtn.disabled = false;
  courseImportBtn.textContent = 'Import as Draft';
  await fetchCourses();
}

function initAdminPanel() {
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  courseForm.addEventListener('submit', handleCourseSubmit);
  coursesList.addEventListener('click', handleCourseListAction);
  refreshCoursesBtn.addEventListener('click', fetchCourses);
  if (courseCsvFile) {
    courseCsvFile.addEventListener('change', handleCourseCsvFileSelected);
  }
  if (courseImportBtn) {
    courseImportBtn.addEventListener('click', handleCourseCsvImport);
  }
  if (reviewStatusFilter) {
    reviewStatusFilter.addEventListener('change', (e) => {
      currentReviewStatusFilter = e.target.value;
      const searchQuery = adminSearchInput?.value || '';
      filteredCourses = filterCourses(searchQuery, currentReviewStatusFilter);
      currentPage = 1;
      renderCoursesPage();
    });
  }
  if (adminSearchInput) {
    let searchTimeout = null;
    adminSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = e.target.value || '';
        filteredCourses = filterCourses(q, currentReviewStatusFilter);
        currentPage = 1;
        renderCoursesPage();
      }, 200);
    });
  }

  if (perPageSelect) {
    perPageSelect.addEventListener('change', (e) => {
      perPage = Number(e.target.value) || 25;
      currentPage = 1;
      renderCoursesPage();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      currentPage = Math.max(1, currentPage - 1);
      renderCoursesPage();
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentPage = currentPage + 1;
      renderCoursesPage();
    });
  }

  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      // increase page size to show more items
      perPage = perPage + 25;
      renderCoursesPage();
    });
  }
  cancelEditBtn.addEventListener('click', () => {
    setFormMode(false);
    formMessage.textContent = 'Create mode restored.';
  });

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  setAuthVisibility(Boolean(accessToken));

  if (accessToken) {
    fetchCourses();
  }
}

initAdminPanel();
