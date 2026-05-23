document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // API base URL (in production this matches host, otherwise localhost:5001)
  const API_BASE = '';

  // Elements
  const applicationForm = document.getElementById('application-form');
  const btnSearch = document.getElementById('btn-search');
  const searchCompany = document.getElementById('search-company');
  const searchPosition = document.getElementById('search-position');
  const resultsTbody = document.getElementById('results-tbody');
  
  // Details Panel Elements
  const detailsPanel = document.getElementById('details-panel');
  const detailCompanyText = document.getElementById('detail-company-text');
  const detailPositionText = document.getElementById('detail-position-text');
  const detailJobIdText = document.getElementById('detail-jobid-text');
  const detailLocationText = document.getElementById('detail-location-text');
  const detailCoverText = document.getElementById('detail-cover-text');
  const detailModeText = document.getElementById('detail-mode-text');
  const detailPortalText = document.getElementById('detail-portal-text');
  const detailSalaryText = document.getElementById('detail-salary-text');
  const detailDescText = document.getElementById('detail-desc-text');
  const detailStatusBadge = document.getElementById('detail-status-badge');
  const btnApprove = document.getElementById('btn-approve');
  const btnReject = document.getElementById('btn-reject');
  const toastContainer = document.getElementById('toast-container');

  let selectedApplication = null;
  let activeApplications = [];

  // Initialize: Load all applications on start
  fetchApplications();

  // 1. Handle Application Submission Form
  applicationForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const jobIdVal = document.getElementById('job_id').value.trim();
    const positionVal = document.getElementById('job_position').value.trim();
    const companyVal = document.getElementById('company_name').value.trim();
    const cityVal = document.getElementById('city').value.trim();
    const stateVal = document.getElementById('state').value.trim();
    const jobModeVal = document.getElementById('job_mode').value;
    const portalVal = document.getElementById('portal').value.trim();
    const salaryVal = document.getElementById('salary').value.trim();
    const coverLetterVal = document.getElementById('cover_letter').value;
    const descVal = document.getElementById('job_description').value.trim();

    if (!jobIdVal || !positionVal || !companyVal) {
      showToast('Job ID, Position, and Company Name are required fields.', 'error');
      return;
    }

    const payload = {
      job_id: jobIdVal,
      job_position: positionVal,
      company_name: companyVal,
      city: cityVal,
      state: stateVal,
      job_mode: jobModeVal,
      portal: portalVal,
      salary: salaryVal,
      cover_letter_provided: coverLetterVal,
      job_description: descVal,
    };

    try {
      const response = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      showToast('Application registered successfully!', 'success');
      
      // Reset only specific fields
      document.getElementById('job_description').value = '';
      document.getElementById('company_name').value = '';
      document.getElementById('job_id').value = '';
      
      // Refresh results list
      fetchApplications();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // 2. Fetch and Search applications
  async function fetchApplications() {
    const compQuery = searchCompany.value.trim();
    const posQuery = searchPosition.value.trim();

    try {
      const response = await fetch(`${API_BASE}/api/applications/search?company_name=${encodeURIComponent(compQuery)}&job_position=${encodeURIComponent(posQuery)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }

      const applications = await response.json();
      activeApplications = applications;
      renderTable(applications);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  // Hook search triggers
  btnSearch.addEventListener('click', fetchApplications);
  
  // Instant search on input typing with basic debouncing
  let searchTimeout;
  const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchApplications, 300);
  };
  searchCompany.addEventListener('input', debouncedSearch);
  searchPosition.addEventListener('input', debouncedSearch);

  // 3. Render table of applications
  function renderTable(apps) {
    resultsTbody.innerHTML = '';

    if (apps.length === 0) {
      resultsTbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <i data-lucide="inbox"></i>
            <p>No matching applications found in database.</p>
          </td>
        </tr>
      `;
      lucide.createIcons();
      hideDetailsPanel();
      return;
    }

    apps.forEach(app => {
      const tr = document.createElement('tr');
      tr.dataset.id = app.id;
      
      if (selectedApplication && selectedApplication.id === app.id) {
        tr.classList.add('selected');
      }

      // Format Location
      const location = [app.city, app.state].filter(Boolean).join(', ') || 'N/A';

      // Status badge class
      let statusClass = 'status-applied';
      if (app.response.toLowerCase() === 'approved') {
        statusClass = 'status-approved';
      } else if (app.response.toLowerCase() === 'rejected') {
        statusClass = 'status-rejected';
      }

      tr.innerHTML = `
        <td>
          <div class="job-cell">
            <span class="job-comp">${escapeHtml(app.company_name)}</span>
            <span class="job-pos">${escapeHtml(app.job_position)}</span>
          </div>
        </td>
        <td class="loc-cell">${escapeHtml(location)}</td>
        <td class="cv-cell">${escapeHtml(app.cover_letter_provided)}</td>
        <td>
          <span class="status-pill ${statusClass}">${escapeHtml(app.response)}</span>
        </td>
      `;

      tr.addEventListener('click', () => selectRow(app, tr));
      resultsTbody.appendChild(tr);
    });

    lucide.createIcons();
  }

  // 4. Row selection logic
  function selectRow(app, trElement) {
    // Remove selected class from all sibling rows
    const rows = resultsTbody.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('selected'));

    // Select this row
    trElement.classList.add('selected');
    selectedApplication = app;

    // Load Details card
    detailCompanyText.textContent = app.company_name;
    detailPositionText.textContent = app.job_position;
    detailJobIdText.innerHTML = `<i data-lucide="hash"></i> ${escapeHtml(app.job_id)}`;
    
    const loc = [app.city, app.state].filter(Boolean).join(', ') || 'N/A';
    detailLocationText.innerHTML = `<i data-lucide="map-pin"></i> ${escapeHtml(loc)}`;
    
    detailCoverText.textContent = app.cover_letter_provided || 'N/A';
    detailModeText.textContent = app.job_mode || 'Onsite';
    detailPortalText.textContent = app.portal || 'N/A';
    detailSalaryText.textContent = app.salary ? `$${parseInt(app.salary, 10).toLocaleString()}` : 'N/A';
    detailDescText.textContent = app.job_description || 'No description provided.';
    
    // Status Badge styling in panel
    detailStatusBadge.textContent = app.response;
    detailStatusBadge.className = 'detail-status'; // Reset classes
    if (app.response.toLowerCase() === 'approved') {
      detailStatusBadge.classList.add('status-approved');
    } else if (app.response.toLowerCase() === 'rejected') {
      detailStatusBadge.classList.add('status-rejected');
    } else {
      detailStatusBadge.classList.add('status-applied');
    }

    // Show panel
    detailsPanel.classList.remove('hidden');
    lucide.createIcons();

    // Scroll details panel smoothly into view on mobile
    if (window.innerWidth <= 1024) {
      detailsPanel.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function hideDetailsPanel() {
    detailsPanel.classList.add('hidden');
    selectedApplication = null;
  }

  // 5. Update Status Actions
  async function updateStatus(newStatus) {
    if (!selectedApplication) {
      showToast('No job application selected.', 'error');
      return;
    }

    const id = selectedApplication.id;

    try {
      const response = await fetch(`${API_BASE}/api/applications/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update response status');
      }

      showToast(`Response status updated to '${newStatus}'!`, 'success');
      
      // Update local object status & view badge
      selectedApplication.response = newStatus;
      
      // Refresh list, keeping the item selected
      await fetchApplications();
      
      // Update selected card status badge directly
      detailStatusBadge.textContent = newStatus;
      detailStatusBadge.className = 'detail-status';
      if (newStatus.toLowerCase() === 'approved') {
        detailStatusBadge.classList.add('status-approved');
      } else if (newStatus.toLowerCase() === 'rejected') {
        detailStatusBadge.classList.add('status-rejected');
      } else {
        detailStatusBadge.classList.add('status-applied');
      }
      lucide.createIcons();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  btnApprove.addEventListener('click', () => updateStatus('Approved'));
  btnReject.addEventListener('click', () => updateStatus('Rejected'));

  // Helper: Toast Notifications
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    
    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);
    lucide.createIcons();

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'none'; // reset
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 4000);
  }

  // Helper: HTML Escaping to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
