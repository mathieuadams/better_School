// school.js - Main JavaScript for school profile page

// Global variables
let leafletMap = null;
let leafletMarker = null;

// Helper function to format address
function formatAddress(addr) {
  const parts = [];
  if (addr?.street) parts.push(addr.street);
  if (addr?.locality) parts.push(addr.locality);
  if (addr?.town) parts.push(addr.town);
  if (addr?.postcode) parts.push(addr.postcode);
  return parts.join(', ');
}

// Initialize or update map
function initMap(lat, lon, name) {
  const mapContainer = document.getElementById('schoolMap');
  if (!mapContainer) {
    console.error('Map container not found');
    return;
  }

  // If map already exists, just update the view
  if (leafletMap) {
    leafletMap.setView([lat, lon], 15);
    if (leafletMarker) {
      leafletMarker.setLatLng([lat, lon]);
      leafletMarker.setPopupContent(name || 'School');
    } else {
      leafletMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup(name || 'School');
    }
    leafletMap.invalidateSize();
    return;
  }

  // Create new map
  try {
    leafletMap = L.map('schoolMap', { 
      scrollWheelZoom: false,
      zoomControl: true 
    }).setView([lat, lon], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);
    
    leafletMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup(name || 'School');
    
    setTimeout(() => {
      leafletMap.invalidateSize();
    }, 100);
    
  } catch (error) {
    console.error('Error initializing map:', error);
  }
}

// Geocode address fallback
async function geocodeAddress(address) {
  if (!address) return null;
  const key = 'geo:' + address.toLowerCase();
  const cached = sessionStorage.getItem(key);
  if (cached) { 
    try { return JSON.parse(cached); } catch {} 
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=gb&q=${encodeURIComponent(address)}`;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data.length) {
      const { lat, lon } = data[0];
      const result = { lat: parseFloat(lat), lon: parseFloat(lon) };
      sessionStorage.setItem(key, JSON.stringify(result));
      return result;
    }
  } catch (e) {
    console.warn('Geocoding failed', e);
  }
  return null;
}

// Render test scores
function renderTestScores(school) {
  if (!school.test_scores) {
    console.log('No test scores available');
    // Hide test scores section if no data
    const testScoresSection = document.querySelector('#testScoresContainer');
    if (testScoresSection) {
      testScoresSection.closest('.section-card').style.display = 'none';
    }
    return;
  }
  
  const subjects = ['english', 'math', 'science'];
  
  subjects.forEach(subject => {
    const score = school.test_scores[subject]?.score;
    const average = school.test_scores[subject]?.average;
    
    const scoreEl = document.getElementById(`${subject}Score`);
    const barEl = document.getElementById(`${subject}Bar`);
    const avgEl = document.getElementById(`${subject}Avg`);
    const avgLabelEl = document.getElementById(`${subject}AvgLabel`);
    
    if (scoreEl && score !== null && score !== undefined) {
      // Update score text
      scoreEl.textContent = Math.round(score) + '%';
      
      // Update progress bar
      if (barEl) {
        barEl.style.width = Math.min(100, Math.max(0, score)) + '%';
        
        // Set color based on performance
        if (score >= 70) {
          barEl.className = 'score-fill high-performing';
        } else if (score >= 50) {
          barEl.className = 'score-fill average-performing';
        } else {
          barEl.className = 'score-fill low-performing';
        }
      }
      
      // Update average marker if available
      if (average !== null && average !== undefined && avgEl && avgLabelEl) {
        avgEl.style.left = Math.min(100, Math.max(0, average)) + '%';
        avgEl.style.display = 'flex';
        avgLabelEl.textContent = Math.round(average) + '%';
      }
    } else if (scoreEl) {
      scoreEl.textContent = 'N/A';
    }
  });
}

// Show info modal for subject
function showSubjectInfo(subject) {
  const info = {
    english: 'This shows the percentage of students meeting expected standards in English/Reading assessments.',
    math: 'This shows the percentage of students meeting expected standards in Mathematics assessments.',
    science: 'This shows the percentage of students meeting expected standards in Science assessments.'
  };
  
  alert(info[subject] || 'Information not available');
}

// Toggle detailed performance view
function toggleDetails(subject) {
  const detailed = document.getElementById('detailedPerformance');
  if (detailed) {
    detailed.style.display = detailed.style.display === 'none' ? 'block' : 'none';
  }
}

// Render neighborhood/contact section
function renderNeighborhood(school) {
  // Address
  const addressText = formatAddress(school.address);
  const addressEl = document.getElementById('nh-address');
  if (addressEl) addressEl.textContent = addressText || '—';
  
  const laEl = document.getElementById('nh-la');
  if (laEl) {
    laEl.textContent = school.address?.local_authority ? 
      `${school.address.local_authority}${school.address.region ? ', ' + school.address.region : ''}` : '';
  }

  // School Leader
  let leaderDisplay = '—';
  if (school.headteacher_name) {
    leaderDisplay = school.headteacher_name;
    if (school.headteacher_job_title) {
      leaderDisplay += ` (${school.headteacher_job_title})`;
    }
  } else if (school.headteacher_job_title) {
    leaderDisplay = school.headteacher_job_title;
  }
  const leaderEl = document.getElementById('nh-leader');
  if (leaderEl) leaderEl.textContent = leaderDisplay;

  // Phone
  const tel = school.telephone || null;
  const phoneEl = document.getElementById('nh-phone');
  if (phoneEl) {
    if (tel) {
      phoneEl.textContent = tel;
      phoneEl.href = `tel:${tel.replace(/\s+/g,'')}`;
      phoneEl.style.color = '#2563eb';
    } else {
      phoneEl.textContent = 'Not available';
      phoneEl.removeAttribute('href');
      phoneEl.style.color = '#6b7280';
      phoneEl.style.cursor = 'default';
    }
  }

  // Website
  const site = school.website || null;
  const webEl = document.getElementById('nh-website');
  if (webEl) {
    if (site) {
      let url = site;
      if (!site.startsWith('http://') && !site.startsWith('https://')) {
        url = 'http://' + site;
      }
      try {
        webEl.href = url;
        const urlObj = new URL(url);
        webEl.textContent = urlObj.host.replace(/^www\./,'');
        webEl.style.color = '#2563eb';
      } catch {
        webEl.href = url;
        webEl.textContent = site;
        webEl.style.color = '#2563eb';
      }
    } else {
      webEl.textContent = 'Not available';
      webEl.removeAttribute('href');
      webEl.style.color = '#6b7280';
      webEl.style.cursor = 'default';
    }
  }

  // Google Maps link
  const mapsLink = document.getElementById('nh-maps-link');
  if (mapsLink) {
    if (typeof school.latitude === 'number' && typeof school.longitude === 'number' && 
        !isNaN(school.latitude) && !isNaN(school.longitude)) {
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${school.latitude},${school.longitude}`;
    } else if (addressText) {
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
    }
  }

  // Initialize map with coordinates
  const lat = parseFloat(school.latitude);
  const lon = parseFloat(school.longitude);
  
  console.log('School coordinates:', { lat, lon, name: school.name });

  if (!isNaN(lat) && !isNaN(lon)) {
    // Use database coordinates
    setTimeout(() => {
      console.log('Initializing map with DB coordinates:', lat, lon);
      initMap(lat, lon, school.name);
    }, 200);
  } else if (addressText) {
    // Fallback to geocoding
    console.log('No DB coordinates, geocoding:', addressText);
    geocodeAddress(addressText).then(coords => {
      if (coords && !isNaN(coords.lat) && !isNaN(coords.lon)) {
        console.log('Geocoding successful:', coords);
        initMap(coords.lat, coords.lon, school.name);
      } else {
        console.log('Geocoding failed, showing UK overview');
        initMap(52.5, -1.5, school.name);
        if (leafletMap) leafletMap.setZoom(6);
      }
    }).catch(err => {
      console.error('Geocoding error:', err);
    });
  }
}

// Render performance data (for detailed view)
function renderPerformance(p) {
  const grid = document.getElementById('performanceGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (p.ks2) {
    grid.innerHTML += `
      <div class="performance-item"><div class="performance-label">Reading Progress</div><div class="performance-value">${p.ks2.reading_progress ?? '-'}</div></div>
      <div class="performance-item"><div class="performance-label">Writing Progress</div><div class="performance-value">${p.ks2.writing_progress ?? '-'}</div></div>
      <div class="performance-item"><div class="performance-label">Maths Progress</div><div class="performance-value">${p.ks2.maths_progress ?? '-'}</div></div>
      <div class="performance-item"><div class="performance-label">Expected Standard (R/W/M)</div><div class="performance-value">${p.ks2.rwm_expected_percentage ?? '-'}%</div></div>`;
  }
  
  if (p.ks4) {
    grid.innerHTML += `
      <div class="performance-item"><div class="performance-label">Progress 8</div><div class="performance-value">${p.ks4.progress_8_score ?? '-'}</div></div>
      <div class="performance-item"><div class="performance-label">Attainment 8</div><div class="performance-value">${p.ks4.attainment_8_score ?? '-'}</div></div>
      <div class="performance-item"><div class="performance-label">Grade 5+ Eng & Maths</div><div class="performance-value">${p.ks4.basics_9_5_percentage ?? '-'}%</div></div>`;
  }
  
  if (p.ks5) {
    grid.innerHTML += `
      <div class="performance-item"><div class="performance-label">A Level Grade</div><div class="performance-value">${p.ks5.a_level_average_grade ?? '-'}</div></div>
      <div class="performance-item"><div class="performance-label">A Level Points</div><div class="performance-value">${p.ks5.a_level_points_per_entry ?? '-'}</div></div>`;
  }
}

// Helper for Ofsted labels
function getOfstedLabel(rating) {
  const labels = { 1: 'Outstanding', 2: 'Good', 3: 'Requires Improvement', 4: 'Inadequate' };
  return labels[rating] || '-';
}

// Load all school data
async function loadAll(urn) {
  try {
    const schoolRes = await fetch(`/api/schools/${urn}`);
    const schoolData = await schoolRes.json();
    
    if (!(schoolData && schoolData.success && schoolData.school)) {
      document.getElementById('schoolName').textContent = 'School Not Found';
      return;
    }
    
    const s = schoolData.school;

    // Update header
    const nameEl = document.getElementById('schoolName');
    if (nameEl) nameEl.textContent = s.name || '-';
    
    const typeEl = document.getElementById('schoolType');
    if (typeEl) typeEl.textContent = s.type || '-';
    
    const phaseEl = document.getElementById('schoolPhase');
    if (phaseEl) phaseEl.textContent = s.phase || '-';
    
    const ageRangeEl = document.getElementById('ageRange');
    if (ageRangeEl) ageRangeEl.textContent = s.characteristics ? `Ages ${s.characteristics.age_range}` : 'Ages -';

    const addr = formatAddress(s.address || {});
    const addressEl = document.getElementById('schoolAddress');
    if (addressEl) addressEl.textContent = addr || '-';

    const overallRatingEl = document.getElementById('overallRating');
    if (overallRatingEl) overallRatingEl.textContent = s.overall_rating ? `${s.overall_rating}/10` : '-';
    
    // Ofsted info
    if (s.ofsted) {
      const ofstedRatingEl = document.getElementById('ofstedRating');
      if (ofstedRatingEl) ofstedRatingEl.textContent = s.ofsted.overall_label || '-';
      
      const ofstedDateEl = document.getElementById('ofstedDate');
      if (ofstedDateEl) {
        ofstedDateEl.textContent = s.ofsted.inspection_date ? 
          new Date(s.ofsted.inspection_date).toLocaleDateString() : 'Not available';
      }
      
      const inspectionDateEl = document.getElementById('inspectionDate');
      if (inspectionDateEl) {
        inspectionDateEl.textContent = s.ofsted.inspection_date ? 
          new Date(s.ofsted.inspection_date).toLocaleDateString() : '-';
      }
      
      // Ofsted report link
      const ofstedLink = document.getElementById('ofsted-report-link');
      if (ofstedLink && s.ofsted.web_link) {
        ofstedLink.href = s.ofsted.web_link;
        ofstedLink.style.display = '';
      } else if (ofstedLink) {
        ofstedLink.style.display = 'none';
      }

      // Ofsted grid
      const ofstedGrid = document.getElementById('ofstedGrid');
      if (ofstedGrid) {
        const ratings = [
          { label: 'Overall Effectiveness', value: s.ofsted.overall_label },
          { label: 'Quality of Education', value: getOfstedLabel(s.ofsted.quality_of_education) },
          { label: 'Behaviour & Attitudes', value: getOfstedLabel(s.ofsted.behaviour_and_attitudes) },
          { label: 'Personal Development', value: getOfstedLabel(s.ofsted.personal_development) },
          { label: 'Leadership & Management', value: getOfstedLabel(s.ofsted.leadership_and_management) },
          { label: 'Safeguarding', value: s.ofsted.safeguarding_effective || '-' }
        ];
        
        ofstedGrid.innerHTML = ratings.map(r => `
          <div class="performance-item">
            <div class="performance-label">${r.label}</div>
            <div class="performance-value" style="font-size:1rem;">${r.value || '-'}</div>
          </div>
        `).join('');
      }
    }

    // Stats
    const statStudentsEl = document.getElementById('statStudents');
    if (statStudentsEl) statStudentsEl.textContent = s.demographics?.total_students || '-';
    
    const fsm = s.demographics?.fsm_percentage;
    const statFSMEl = document.getElementById('statFSM');
    if (statFSMEl) statFSMEl.textContent = (fsm !== null && fsm !== undefined) ? (fsm + '%') : '-';
    
    // Update test score stats in key stats bar
    if (s.test_scores) {
      const englishScore = s.test_scores.english?.score;
      const mathScore = s.test_scores.math?.score;
      
      const statEnglishEl = document.getElementById('statEnglish');
      if (statEnglishEl) {
        statEnglishEl.textContent = 
          englishScore !== null && englishScore !== undefined ? Math.round(englishScore) + '%' : '-';
      }
      
      const statMathEl = document.getElementById('statMath');
      if (statMathEl) {
        statMathEl.textContent = 
          mathScore !== null && mathScore !== undefined ? Math.round(mathScore) + '%' : '-';
      }
    }

    if (s.attendance?.overall_absence_rate != null) {
      const att = (100 - s.attendance.overall_absence_rate).toFixed(1);
      const statAttendanceEl = document.getElementById('statAttendance');
      if (statAttendanceEl) statAttendanceEl.textContent = att + '%';
    }

    // Breadcrumb and title
    const schoolCrumbEl = document.getElementById('schoolCrumb');
    if (schoolCrumbEl) schoolCrumbEl.textContent = s.name || 'School';
    
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) pageTitleEl.textContent = `${s.name} - Better School UK`;

    // Info panel
    const infoTypeEl = document.getElementById('infoType');
    if (infoTypeEl) infoTypeEl.textContent = s.type || '-';
    
    const infoGenderEl = document.getElementById('infoGender');
    if (infoGenderEl) infoGenderEl.textContent = s.characteristics?.gender || '-';
    
    const infoAgeRangeEl = document.getElementById('infoAgeRange');
    if (infoAgeRangeEl) infoAgeRangeEl.textContent = s.characteristics?.age_range || '-';
    
    const infoReligiousEl = document.getElementById('infoReligious');
    if (infoReligiousEl) infoReligiousEl.textContent = s.characteristics?.religious_character || 'None';
    
    const infoAdmissionsEl = document.getElementById('infoAdmissions');
    if (infoAdmissionsEl) infoAdmissionsEl.textContent = s.characteristics?.admissions_policy || 'Standard';
    
    const infoLAEl = document.getElementById('infoLA');
    if (infoLAEl) infoLAEl.textContent = s.address?.local_authority || '-';
    
    const infoURNEl = document.getElementById('infoURN');
    if (infoURNEl) infoURNEl.textContent = s.urn || '-';

    // Render test scores
    renderTestScores(s);

    // Render contact and map
    renderNeighborhood(s);

    // Load performance data (for detailed view)
    const perfRes = await fetch(`/api/schools/${urn}/performance`);
    const perf = await perfRes.json();
    if (perf.success && perf.performance) {
      renderPerformance(perf.performance);
    }

    // Load nearby schools
    const nearRes = await fetch(`/api/schools/${urn}/nearby?limit=5`);
    const near = await nearRes.json();
    if (near.success && near.nearby_schools) {
      const nearbySchoolsEl = document.getElementById('nearbySchools');
      if (nearbySchoolsEl) {
        nearbySchoolsEl.innerHTML = near.nearby_schools.slice(0,5).map(n => `
          <div class="nearby-school" onclick="window.location.href='/school/${n.urn}'" style="cursor:pointer; padding:0.75rem 0; border-bottom:1px solid #f3f4f6;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; color:#111827; font-size:0.875rem;">${n.name}</div>
                <div style="color:#6b7280; font-size:0.75rem;">${n.type_of_establishment || ''}</div>
              </div>
              <div style="font-weight:700; color:#2563eb; font-size:0.875rem;">${n.overall_rating || '-'}/10</div>
            </div>
          </div>
        `).join('');
      }
    }
    
  } catch(e) {
    console.error('Error loading school:', e);
    const nameEl = document.getElementById('schoolName');
    if (nameEl) nameEl.textContent = 'Error Loading School';
  }
}

// Initialize page
(function init() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  let urn = null, city = null;

  if (parts[0] === 'school' && parts[1]) {
    urn = parts[1];
  } else if (parts.length === 2 && !isNaN(Number(parts[1]))) {
    city = parts[0];
    urn = parts[1];
  }

  if (city) {
    const pretty = city.charAt(0).toUpperCase() + city.slice(1).replace(/-/g,' ');
    const crumb = document.getElementById('cityCrumb');
    if (crumb) {
      crumb.textContent = pretty;
      crumb.href = `/${city}`;
    }
  }

  if (!urn) {
    const nameEl = document.getElementById('schoolName');
    if (nameEl) nameEl.textContent = 'Error Loading School';
    return;
  }

  loadAll(urn);
})();