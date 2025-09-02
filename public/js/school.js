/* ===========================================================================
 * school.js - Complete JavaScript for School Page with Scotland support
 * Robust rendering with defensive DOM checks and safe JSON parsing
 * =========================================================================== */

// ----------------------------- Globals -------------------------------------
let currentSchoolData = null;
let isScottishSchool = false;

// ----------------------------- Helpers -------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (idOrEl, text) => {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (el) el.textContent = text;
};
const setDisplay = (idOrEl, show) => {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (el) el.style.display = show ? '' : 'none';
};
const setWidth = (id, pct) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = `${Math.max(0, Math.min(100, Number(pct || 0)))}%`;
};
const fmtNum = (n) => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-GB'));
const fmtPct = (n, d = 0) => (n == null || isNaN(n) ? '-' : `${Number(n).toFixed(d)}%`);
const fmt1 = (n) => (n == null || isNaN(n) ? 'N/A' : Number(n).toFixed(1));
const ofstedLabel = (n) => ({1:'Outstanding',2:'Good',3:'Requires Improvement',4:'Inadequate'})[n] || 'Not Inspected';
const formatDateMonYr = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};
const fullAddress = (addr) => {
  if (!addr) return '-';
  return [addr.street, addr.locality, addr.town, addr.postcode].filter(Boolean).join(', ');
};
const safeParseJSON = (raw, fallback) => {
  if (Array.isArray(raw) || (raw && typeof raw === 'object')) return raw;
  if (raw == null || raw === '') return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

// Extract URN from URL (supports /school/123456 or /something/123456-name)
function extractURN() {
  const parts = (window.location.pathname || '').split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i].match(/^(\d{4,})/); // 4+ digits to avoid accidental matches
    if (m) return m[1];
  }
  return null;
}

// ------------------------- Scotland UI rules --------------------------------
function hideScotlandFeatures() {
  // Ofsted sections not applicable
  setDisplay('ofstedSection', false);
  const ofstedHeaderChip = document.querySelector('.ofsted-rating');
  if (ofstedHeaderChip) ofstedHeaderChip.style.display = 'none';

  // Science subject commonly not provided for Scot summary — hide gracefully
  const scienceRow = document.querySelector('[data-subject="science"]') || document.querySelector('.test-score-row:nth-child(3)');
  if (scienceRow) scienceRow.style.display = 'none';

  // Hide any generic sixth-form badges if annotated
  document.querySelectorAll('[data-sixth-form]').forEach(el => el.style.display = 'none');

  const statScience = document.getElementById('statScience');
  if (statScience && statScience.closest('.key-stat')) statScience.closest('.key-stat').style.display = 'none';
}

function adjustScottishRating(school) {
  // Reweight factors if you want a Scotland-specific composition
  const comps = safeParseJSON(school.rating_components, []);
  let hasAcademic = false, hasAttendance = false;
  comps.forEach(c => {
    if (c?.name === 'academic') { c.weight = 60; hasAcademic = true; }
    if (c?.name === 'attendance') { c.weight = 40; hasAttendance = true; }
  });
  school.rating_components = comps;
  if (hasAcademic || hasAttendance) school.rating_data_completeness = (hasAcademic ? 60 : 0) + (hasAttendance ? 40 : 0);
}

// ------------------------------- Fetch --------------------------------------
async function loadSchoolData() {
  const urn = extractURN();
  if (!urn) {
    console.error('No URN found in URL');
    setText('schoolName', 'School Not Found');
    return;
  }

  try {
    const res = await fetch(`/api/schools/${urn}`);
    const payload = await res.json();

    if (!payload || !payload.school) throw new Error('Invalid school payload');

    const s = payload.school;
    // Normalize fields
    s.rating_components = safeParseJSON(s.rating_components, []);
    isScottishSchool = s.country === 'Scotland' || !!s.is_scotland;

    if (isScottishSchool) {
      hideScotlandFeatures();
      adjustScottishRating(s);
    }

    currentSchoolData = s;
    window.currentSchoolData = s; // for debugging/other components

    updateSchoolDisplay(s);

    // Fire-and-forget extras
    loadPerformanceData(urn).catch(e => console.warn('performance fetch failed', e));
    loadNearbySchools(urn).catch(e => console.warn('nearby fetch failed', e));

    // Notify other components
    window.dispatchEvent(new CustomEvent('schoolDataLoaded', { detail: s }));
  } catch (e) {
    console.error('Error loading school', e);
    setText('schoolName', 'Error Loading School');
  }
}

// ----------------------------- Rendering ------------------------------------
function updateSchoolDisplay(school) {
  try {
    updateBreadcrumbs(school);
    updateHeader(school);
    updateKeyStats(school);
    updateTestScores(school);
    updateDemographics(school);
    updateSchoolInfo(school);
    if (!isScottishSchool) updateOfstedDetails(school);
    updateContactInfo(school);
    window.updateRatingDisplay?.(school); // allow school-rating component to render
    document.title = `${school.name || 'School'} - Better School UK`;
  } catch (e) {
    console.error('updateSchoolDisplay failed', e);
  }
}

function updateHeader(school) {
  setText('schoolName', school.name || 'School Name');
  setText('schoolType', school.type || '-');
  setText('schoolPhase', school.phase || '-');
  const age = school.characteristics?.age_range || `${school.age_range_lower ?? '?'} - ${school.age_range_upper ?? '?'}`;
  setText('ageRange', `Ages ${age}`);
  setText('schoolAddress', fullAddress(school.address));

  const ratingEl = document.getElementById('overallRating');
  if (ratingEl) ratingEl.textContent = school.overall_rating ? `${fmt1(school.overall_rating)}/10` : 'N/A';

  if (!isScottishSchool && school.ofsted) {
    setText('ofstedRating', ofstedLabel(school.ofsted.overall_effectiveness));
    setText('ofstedDate', formatDateMonYr(school.ofsted.inspection_date));
  }
}

function updateBreadcrumbs(school) {
  const addr = school.address || {};
  const city = addr.town ? addr.town : null;
  const la = addr.local_authority ? addr.local_authority : null;

  const cityCrumb = document.getElementById('cityCrumb');
  if (cityCrumb && city) {
    cityCrumb.textContent = city;
    cityCrumb.href = `/${city.toLowerCase().replace(/\s+/g, '-')}`;
  }
  const laCrumb = document.getElementById('laCrumb');
  if (laCrumb && la) {
    laCrumb.textContent = la;
    const laSlug = la.toLowerCase().replace(/\s+/g, '-');
    if (city) laCrumb.href = `/${city.toLowerCase().replace(/\s+/g, '-')}/${laSlug}`; else laCrumb.href = `/local-authority/${laSlug}`;
  }
  const schoolCrumb = document.getElementById('schoolCrumb');
  if (schoolCrumb) schoolCrumb.textContent = school.name || 'School Name';
}

function updateKeyStats(school) {
  const d = school.demographics || {};
  setText('statStudents', fmtNum(d.total_students));
  setText('statFSM', d.fsm_percentage != null ? fmtPct(d.fsm_percentage, 2) : '-');

  const ts = school.test_scores || {};
  setText('statEnglish', ts.english?.score != null ? fmtPct(ts.english.score) : '-');
  setText('statMath', ts.math?.score != null ? fmtPct(ts.math.score) : '-');

  const ab = school.attendance || {};
  const attendanceRate = ab.overall_absence_rate != null ? 100 - Number(ab.overall_absence_rate) : null;
  setText('statAttendance', attendanceRate != null ? fmtPct(attendanceRate, 1) : '-');
}

function updateTestScores(school) {
  const ts = school.test_scores || {};

  function applyRow(prefix, obj) {
    const score = obj?.score;
    setText(`${prefix}Score`, score != null ? fmtPct(score) : '-');
    setWidth(`${prefix}Bar`, score || 0);
    const avg = obj?.la_average != null ? obj.la_average : obj?.average;
    const marker = document.getElementById(`${prefix}Avg`);
    const label = document.getElementById(`${prefix}AvgLabel`);
    if (marker && label && avg != null) {
      marker.style.left = `${Math.max(0, Math.min(100, Number(avg)))}%`;
      marker.style.display = 'block';
      label.textContent = `National Avg: ${fmtPct(avg)}`;
      label.style.display = 'inline';
    } else {
      if (marker) marker.style.display = 'none';
      if (label) label.style.display = 'none';
    }
  }

  applyRow('english', ts.english || null);
  applyRow('math', ts.math || null);

  if (!isScottishSchool) {
    applyRow('science', ts.science || null);
  } else {
    // hide science row if present
    const r = document.querySelector('[data-subject="science"]') || document.querySelector('.test-score-row:nth-child(3)');
    if (r) r.style.display = 'none';
  }
}

function updateDemographics(school) {
  const demo = school.demographics || {};
  // circle-style widgets may expect text only
  setText('totalStudents', fmtNum(demo.total_students));
  setText('boysCount', fmtNum(demo.boys));
  setText('girlsCount', fmtNum(demo.girls));
  setText('fsmPercentage', demo.fsm_percentage != null ? fmtPct(demo.fsm_percentage) : '-');
  setText('ealPercentage', demo.eal_percentage != null ? fmtPct(demo.eal_percentage) : '-');
  setText('senSupport', demo.sen_support_percentage != null ? fmtPct(demo.sen_support_percentage) : '-');
  setText('senEHCP', demo.sen_ehcp_percentage != null ? fmtPct(demo.sen_ehcp_percentage) : '-');
}

function updateSchoolInfo(school) {
  // Fills the School Information card (school-info.html)
  const c = school.characteristics || {};
  setText('infoType', school.type || '-');
  setText('infoGender', c.gender || '-');
  setText('infoAgeRange', c.age_range || `${school.age_range_lower ?? '?'} - ${school.age_range_upper ?? '?'}`);
  setText('infoReligious', c.religious_character || 'None');
  setText('infoAdmissions', c.admissions_policy || 'Not specified');
  setText('infoLA', school.address?.local_authority || '-');
  setText('infoURN', school.urn || '-');
}

function updateOfstedDetails(school) {
  const o = school.ofsted || {};
  if (!o || (!o.overall_effectiveness && !o.quality_of_education)) return;

  setText('inspectionDate', o.inspection_date ? `Last inspected: ${formatDateMonYr(o.inspection_date)}` : '');

  const grid = document.getElementById('ofstedGrid');
  if (grid) {
    const rows = [
      ['Overall Effectiveness', ofstedLabel(o.overall_effectiveness)],
      ['Quality of Education', ofstedLabel(o.quality_of_education)],
      ['Behaviour and Attitudes', ofstedLabel(o.behaviour_and_attitudes)],
      ['Personal Development', ofstedLabel(o.personal_development)],
      ['Leadership and Management', ofstedLabel(o.leadership_and_management)],
      ['Safeguarding', o.safeguarding_effective == null ? null : (o.safeguarding_effective ? 'Effective' : 'Not Effective')],
    ];
    grid.innerHTML = rows
      .filter(([,v]) => v != null)
      .map(([k,v]) => `
        <div class="performance-metric">
          <div class="metric-label">${k}</div>
          <div class="metric-value">${v}</div>
        </div>`)
      .join('');
  }

  if (o.web_link) {
    const wrap = document.getElementById('ofstedLinkContainer');
    const a = document.getElementById('ofsted-report-link');
    if (wrap && a) { a.href = o.web_link; wrap.style.display = 'block'; }
  }
}

function updateContactInfo(school) {
  // Matches school-contact.html element IDs (nh-*)
  const addr = school.address || {};
  setText('nh-address', fullAddress(addr));
  setText('nh-la', addr.local_authority ? `Local Authority: ${addr.local_authority}` : '');

  // Leader
  const leader = [school.headteacher_name, school.headteacher_job_title].filter(Boolean).join(' — ');
  setText('nh-leader', leader || '—');

  // Phone
  const phoneEl = document.getElementById('nh-phone');
  if (phoneEl) {
    phoneEl.textContent = school.telephone || '—';
    if (school.telephone) phoneEl.href = `tel:${school.telephone}`;
  }

  // Website
  const webEl = document.getElementById('nh-website');
  if (webEl) {
    if (school.website) {
      const url = school.website.startsWith('http') ? school.website : `https://${school.website}`;
      webEl.textContent = school.website;
      webEl.href = url;
    } else {
      webEl.textContent = '—';
      webEl.removeAttribute('href');
    }
  }

  // Google Maps link
  const maps = document.getElementById('nh-maps-link');
  if (maps) {
    const q = [addr.street, addr.locality, addr.town, addr.postcode].filter(Boolean).join(', ');
    maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  if (school.latitude && school.longitude) initMap(school.latitude, school.longitude, school.name);
}

// ---------------------------- Map (Leaflet) ---------------------------------
function initMap(lat, lng, schoolName) {
  const el = document.getElementById('schoolMap');
  if (!el || !window.L) return;
  const map = L.map(el).setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
  L.marker([lat, lng]).addTo(map).bindPopup(schoolName || 'School').openPopup();
}

// ------------------------ Optional: Extra data ------------------------------
async function loadPerformanceData(urn) {
  const res = await fetch(`/api/schools/${urn}/performance`);
  const data = await res.json();
  if (data?.success && data.performance) updatePerformanceData(data.performance);
}
function updatePerformanceData(perf) {
  // hook for any extra widgets
}

async function loadNearbySchools(urn) {
  const res = await fetch(`/api/schools/${urn}/nearby?limit=5`);
  const data = await res.json();
  if (data?.success && Array.isArray(data.nearby_schools)) updateNearbySchools(data.nearby_schools);
}
function updateNearbySchools(schools) {
  const container = document.getElementById('nearbySchools');
  if (!container) return;

  // Make container a list for a11y
  container.setAttribute('role', 'list');
  container.classList.add('nearby-list');

  if (!schools || !schools.length) {
    container.innerHTML = '<div class="nearby-empty">No nearby schools found</div>';
    return;
  }

  const currentUrn = (currentSchoolData && currentSchoolData.urn) ? String(currentSchoolData.urn) : null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  const badgeClass = (r) => {
    if (r == null || isNaN(r)) return 'badge gray';
    const v = Number(r);
    if (v >= 8) return 'badge green';
    if (v >= 6) return 'badge blue';
    if (v >= 4) return 'badge orange';
    return 'badge red';
  };

  container.innerHTML = schools.map((s) => {
    const ratingVal = s.overall_rating != null ? Number(s.overall_rating).toFixed(1) : '—';
    const cls = badgeClass(s.overall_rating);
    const active = currentUrn && String(s.urn) === currentUrn ? ' is-active' : '';
    return `
      <a class="nearby-card${active}" href="/school/${esc(s.urn)}" role="listitem" aria-label="${esc(s.name)}">
        <div class="nearby-card__main">
          <div class="nearby-card__title">${esc(s.name)}</div>
          <div class="nearby-card__meta">${esc(s.type_of_establishment || 'School')} • ${esc(s.postcode || '')}</div>
        </div>
        <div class="nearby-card__rating ${cls}" aria-label="Rating">${ratingVal}/10</div>
        <svg class="nearby-card__chev" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor"/></svg>
      </a>`;
  }).join('');
}


// ---------------------- Rating component bridge -----------------------------
window.updateRatingDisplay = function(schoolData) {
  if (!schoolData) return;
  const isScottish = schoolData.country === 'Scotland' || schoolData.is_scotland;

  const scoreEl = document.getElementById('mainRatingScore');
  if (scoreEl) scoreEl.textContent = schoolData.overall_rating ? fmt1(schoolData.overall_rating) : 'N/A';

  const perfEl = document.getElementById('ratingPerformance');
  if (perfEl) {
    const r = Number(schoolData.overall_rating || 0);
    let level = 'at an average level';
    if (r >= 8) level = 'above average';
    else if (r >= 6) level = 'slightly above average';
    else if (r > 0 && r <= 4) level = 'below average';
    setText('performanceLevel', level);
    setText('localAuthority', schoolData.address?.local_authority || schoolData.local_authority || 'the local authority');
  }

  // Percentile badge (if present)
  const pct = schoolData.rating_percentile;
  const pctWrap = document.getElementById('percentileDisplay');
  const pctBadge = document.getElementById('percentileBadge');
  if (pctWrap && pctBadge) {
    if (pct != null && !isNaN(pct)) { pctWrap.style.display = 'flex'; pctBadge.textContent = `Top ${pct}%`; }
    else pctWrap.style.display = 'none';
  }

  // Factors
  const comps = safeParseJSON(schoolData.rating_components, []);
  const byName = new Map(comps.map(c => [c?.name, c]));

  const ofsted = byName.get('ofsted');
  const academic = byName.get('academic');
  const attendance = byName.get('attendance');

  if (isScottish) setDisplay('ofstedFactor', false);
  if (!isScottish && ofsted) {
    setDisplay('ofstedFactor', true);
    setText('ofstedScore', fmt1(ofsted.score));
    setText('ofstedLabel', ofsted.label || 'Ofsted Rating');
  }
  if (academic) {
    setDisplay('academicFactor', true);
    setText('academicScore', fmt1(academic.score));
    if (isScottish) {
      const w = document.querySelector('#academicFactor .factor-weight'); if (w) w.textContent = '60% weight';
    }
    const det = academic.details || {};
    if (det.english) {
      setDisplay('englishItem', true);
      setText('englishValue', fmtPct(det.english.school));
      setWidth('englishSchoolBar', det.english.school);
      const lam = document.getElementById('englishLAMarker'); if (lam) { lam.style.left = `${det.english.la_avg ?? 50}%`; lam.style.display = 'block'; }
    }
    if (det.math) {
      setDisplay('mathItem', true);
      setText('mathValue', fmtPct(det.math.school));
      setWidth('mathSchoolBar', det.math.school);
      const lam = document.getElementById('mathLAMarker'); if (lam) { lam.style.left = `${det.math.la_avg ?? 50}%`; lam.style.display = 'block'; }
    }
    if (!isScottish && det.science) {
      setDisplay('scienceItem', true);
      setText('scienceValue', fmtPct(det.science.school));
      setWidth('scienceSchoolBar', det.science.school);
      const lam = document.getElementById('scienceLAMarker'); if (lam) { lam.style.left = `${det.science.la_avg ?? 50}%`; lam.style.display = 'block'; }
    } else if (isScottish) {
      const sci = document.getElementById('scienceItem'); if (sci) sci.style.display = 'none';
    }
  }
  if (attendance) {
    setDisplay('attendanceFactor', true);
    setText('attendanceScore', fmt1(attendance.score));
    if (isScottish) { const w = document.querySelector('#attendanceFactor .factor-weight'); if (w) w.textContent = '40% weight'; }
    if (attendance.school_rate != null) setText('attendanceRate', `${fmt1(attendance.school_rate)}% attendance rate`);
  }

  // Data completeness banner
  const comp = schoolData.rating_data_completeness;
  if (comp != null && comp < 100) {
    setDisplay('dataNotice', true);
    setText('dataNoticeText', `Rating based on ${comp}% of available data`);
  } else {
    const dn = document.getElementById('dataNotice'); if (dn) dn.style.display = 'none';
  }

  // Methodology for Scotland
  if (isScottish) {
    const m = document.getElementById('ratingMethodology');
    if (m) m.innerHTML = `
      <h4>How We Calculate Ratings (Scotland)</h4>
      <p>Ratings use a 1–10 scale based on available data:</p>
      <ul>
        <li><strong>Academic Performance (60%)</strong> — English & Maths vs local authority averages</li>
        <li><strong>Attendance (40%)</strong> — School vs local authority average</li>
      </ul>
      <p class="methodology-note">A minimum data threshold is required to compute a rating.</p>`;
  }
};

// ------------------------ UI toggles (optional) -----------------------------
window.toggleRatingInfo = function () {
  const m = document.getElementById('ratingMethodology');
  if (m) m.style.display = (m.style.display === 'none' || !m.style.display) ? 'block' : 'none';
};
window.toggleFactorDetail = function (factor) {
  const b = document.getElementById(`${factor}Breakdown`);
  const btn = b?.previousElementSibling?.querySelector('.expand-btn');
  if (!b) return;
  const open = b.style.display === 'block';
  b.style.display = open ? 'none' : 'block';
  if (btn) btn.classList.toggle('expanded', !open);
};
window.toggleDetails = function (subject) {
  // placeholder for per-subject expandable rows
};
window.showSubjectInfo = function (subject) {
  // placeholder for info modal
};

// -------------------------------- Init --------------------------------------
document.addEventListener('DOMContentLoaded', loadSchoolData);
