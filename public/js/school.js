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

// Helper function to format numbers with commas
function formatNumber(num) {
  if (!num) return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update rating display function - CRITICAL FOR RATING FACTORS
function updateRatingDisplay(schoolData) {
  if (!schoolData || !schoolData.overall_rating) {
    const mainScore = document.getElementById('mainRatingScore');
    const perfText = document.getElementById('ratingPerformance');
    const dataNotice = document.getElementById('dataNotice');
    
    if (mainScore) mainScore.textContent = 'N/A';
    if (perfText) perfText.innerHTML = 'Insufficient data available for rating';
    if (dataNotice) {
      dataNotice.style.display = 'flex';
      const noticeText = document.getElementById('dataNoticeText');
      if (noticeText) noticeText.textContent = 'Not enough data to calculate rating';
    }
    return;
  }
  
  const rating = parseInt(schoolData.overall_rating);
  const components = schoolData.rating_components || [];
  const percentile = schoolData.rating_percentile;
  
  // Update main rating display
  const mainScore = document.getElementById('mainRatingScore');
  if (mainScore) mainScore.textContent = rating;
  
  // Set color based on rating
  const scoreBox = document.querySelector('.rating-score-box');
  if (scoreBox) {
    let borderColor = '#6b7280'; // gray default
    if (rating >= 8) borderColor = '#10b981'; // green
    else if (rating >= 6) borderColor = '#3b82f6'; // blue
    else if (rating >= 4) borderColor = '#f59e0b'; // orange
    else borderColor = '#ef4444'; // red
    
    scoreBox.style.borderColor = borderColor;
    scoreBox.style.setProperty('--rating-color', borderColor);
  }
  
  // Update performance text
  let performanceLevel = 'at an average level';
  if (rating >= 8) performanceLevel = 'above average';
  else if (rating >= 6) performanceLevel = 'slightly above average';
  else if (rating <= 4) performanceLevel = 'below average';
  
  const perfLevel = document.getElementById('performanceLevel');
  if (perfLevel) perfLevel.textContent = performanceLevel;
  
  // Use actual local authority name
  const laName = schoolData.address?.local_authority || schoolData.local_authority || 'the local authority';
  const laElement = document.getElementById('localAuthority');
  if (laElement) laElement.textContent = laName;
  
  // Update percentile if available
  const percentileDisplay = document.getElementById('percentileDisplay');
  if (percentileDisplay && percentile !== null && percentile !== undefined && percentile > 0) {
    percentileDisplay.style.display = 'flex';
    const topPercent = 100 - percentile;
    const percentileBadge = document.getElementById('percentileBadge');
    if (percentileBadge) percentileBadge.textContent = `Top ${topPercent}%`;
  } else if (percentileDisplay) {
    percentileDisplay.style.display = 'none';
  }
  
  // Update rating factors if components exist
  components.forEach(component => {
    if (component.name === 'ofsted') {
      const ofstedFactor = document.getElementById('ofstedFactor');
      if (ofstedFactor) ofstedFactor.style.display = 'block';
      const ofstedScore = document.getElementById('ofstedScore');
      if (ofstedScore) ofstedScore.textContent = component.score.toFixed(1);
      const ofstedLabel = document.getElementById('ofstedLabel');
      if (ofstedLabel) ofstedLabel.textContent = component.label || 'Ofsted Rating';
    } else if (component.name === 'academic') {
      const academicFactor = document.getElementById('academicFactor');
      if (academicFactor) academicFactor.style.display = 'block';
      const academicScore = document.getElementById('academicScore');
      if (academicScore) academicScore.textContent = component.score.toFixed(1);
      
      // Update subject breakdowns if available
      if (component.details) {
        if (component.details.english) {
          const englishItem = document.getElementById('englishItem');
          if (englishItem) englishItem.style.display = 'grid';
          const englishValue = document.getElementById('englishValue');
          if (englishValue) englishValue.textContent = `${component.details.english.school || 0}%`;
          const englishBar = document.getElementById('englishSchoolBar');
          if (englishBar) englishBar.style.width = `${component.details.english.school || 0}%`;
          const englishMarker = document.getElementById('englishLAMarker');
          if (englishMarker) englishMarker.style.left = `${component.details.english.la_avg || 50}%`;
        }
        if (component.details.math) {
          const mathItem = document.getElementById('mathItem');
          if (mathItem) mathItem.style.display = 'grid';
          const mathValue = document.getElementById('mathValue');
          if (mathValue) mathValue.textContent = `${component.details.math.school || 0}%`;
          const mathBar = document.getElementById('mathSchoolBar');
          if (mathBar) mathBar.style.width = `${component.details.math.school || 0}%`;
          const mathMarker = document.getElementById('mathLAMarker');
          if (mathMarker) mathMarker.style.left = `${component.details.math.la_avg || 50}%`;
        }
        if (component.details.science) {
          const scienceItem = document.getElementById('scienceItem');
          if (scienceItem) scienceItem.style.display = 'grid';
          const scienceValue = document.getElementById('scienceValue');
          if (scienceValue) scienceValue.textContent = `${component.details.science.school || 0}%`;
          const scienceBar = document.getElementById('scienceSchoolBar');
          if (scienceBar) scienceBar.style.width = `${component.details.science.school || 0}%`;
          const scienceMarker = document.getElementById('scienceLAMarker');
          if (scienceMarker) scienceMarker.style.left = `${component.details.science.la_avg || 50}%`;
        }
      }
      
      let comparisonText = 'Test scores ';
      if (component.score >= 7) comparisonText += 'above LA average';
      else if (component.score >= 5) comparisonText += 'near LA average';
      else comparisonText += 'below LA average';
      const academicComparison = document.getElementById('academicComparison');
      if (academicComparison) academicComparison.textContent = comparisonText;
    } else if (component.name === 'attendance') {
      const attendanceFactor = document.getElementById('attendanceFactor');
      if (attendanceFactor) attendanceFactor.style.display = 'block';
      const attendanceScore = document.getElementById('attendanceScore');
      if (attendanceScore) attendanceScore.textContent = component.score.toFixed(1);
      const attendanceRate = document.getElementById('attendanceRate');
      if (attendanceRate) attendanceRate.textContent = `${component.school_rate?.toFixed(1) || '-'}% attendance rate`;
    }
  });
  
  // Show data completeness notice if not 100%
  const dataNotice = document.getElementById('dataNotice');
  if (dataNotice && schoolData.rating_data_completeness && schoolData.rating_data_completeness < 100) {
    dataNotice.style.display = 'flex';
    const noticeText = document.getElementById('dataNoticeText');
    if (noticeText) noticeText.textContent = `Rating based on ${schoolData.rating_data_completeness}% of available data`;
  }
}

// Initialize or update map
function initMap(lat, lon, name) {
  const mapContainer = document.getElementById('schoolMap');
  if (!mapContainer) {
    console.error('Map container not found');
    return;
  }

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

// Render student demographics
function renderDemographics(school) {
  const demographics = school.demographics;
  const census = school.census_data;
  
  if (!demographics && !census) {
    const demoSection = document.querySelector('#demographicsSection');
    if (demoSection) {
      demoSection.style.display = 'none';
    }
    return;
  }
  
  // EAL (English as Additional Language)
  const ealPercent = census?.percentage_eal || demographics?.eal_percentage;
  if (ealPercent !== null && ealPercent !== undefined) {
    const ealEl = document.getElementById('ealPercentage');
    const ealCircle = document.getElementById('ealCircle');
    if (ealEl) ealEl.textContent = Math.round(ealPercent) + '%';
    if (ealCircle) {
      const circumference = 2 * Math.PI * 25;
      const offset = circumference - (ealPercent / 100) * circumference;
      ealCircle.style.strokeDashoffset = offset.toString();
    }
  }
  
  // FSM (Free School Meals)
  const fsmPercent = demographics?.fsm_percentage || census?.percentage_fsm_ever6;
  if (fsmPercent !== null && fsmPercent !== undefined) {
    const fsmEl = document.getElementById('fsmPercentage');
    const fsmCircle = document.getElementById('fsmCircle');
    if (fsmEl) fsmEl.textContent = Math.round(fsmPercent) + '%';
    if (fsmCircle) {
      const circumference = 2 * Math.PI * 25;
      const offset = circumference - (fsmPercent / 100) * circumference;
      fsmCircle.style.strokeDashoffset = offset.toString();
    }
  }
  
  // Gender breakdown
  const boys = demographics?.boys || census?.number_boys;
  const girls = demographics?.girls || census?.number_girls;
  if (boys && girls) {
    const total = boys + girls;
    const femalePercent = Math.round((girls / total) * 100);
    const malePercent = Math.round((boys / total) * 100);
    
    const femaleEl = document.getElementById('femalePercentage');
    const maleEl = document.getElementById('malePercentage');
    const genderCircle = document.getElementById('genderCircle');
    
    if (femaleEl) femaleEl.textContent = femalePercent + '%';
    if (maleEl) maleEl.textContent = malePercent + '%';
    if (genderCircle) {
      const circumference = 2 * Math.PI * 25;
      const offset = circumference - (malePercent / 100) * circumference;
      genderCircle.style.strokeDashoffset = offset.toString();
    }
  }
  
  // SEN data
  const senSupport = demographics?.sen_support_percentage || census?.percentage_sen_support;
  const senEhcp = demographics?.sen_ehcp_percentage || census?.percentage_sen_ehcp;
  
  if (senSupport !== null || senEhcp !== null) {
    const additionalDemo = document.getElementById('additionalDemographics');
    if (additionalDemo) additionalDemo.style.display = 'block';
    
    if (senSupport !== null && senSupport !== undefined) {
      const senSupportBar = document.getElementById('senSupportBar');
      const senSupportValue = document.getElementById('senSupportValue');
      if (senSupportBar) senSupportBar.style.width = Math.min(100, senSupport) + '%';
      if (senSupportValue) {
        const value = typeof senSupport === 'number' ? senSupport.toFixed(1) : String(senSupport);
        senSupportValue.textContent = value + '%';
      }
    }
    
    if (senEhcp !== null && senEhcp !== undefined) {
      const senEhcpBar = document.getElementById('senEhcpBar');
      const senEhcpValue = document.getElementById('senEhcpValue');
      if (senEhcpBar) senEhcpBar.style.width = Math.min(100, senEhcp) + '%';
      if (senEhcpValue) {
        const value = typeof senEhcp === 'number' ? senEhcp.toFixed(1) : String(senEhcp);
        senEhcpValue.textContent = value + '%';
      }
    }
  }
}

// Render test scores
function renderTestScores(school) {
  if (!school.test_scores) {
    console.log('No test scores available');
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
      scoreEl.textContent = Math.round(score) + '%';
      
      if (barEl) {
        barEl.style.width = Math.min(100, Math.max(0, score)) + '%';
        
        if (score >= 70) {
          barEl.className = 'score-fill high-performing';
        } else if (score >= 50) {
          barEl.className = 'score-fill average-performing';
        } else {
          barEl.className = 'score-fill low-performing';
        }
      }
      
      if (average !== null && average !== undefined && avgEl && avgLabelEl) {
        avgEl.style.left = Math.min(100, Math.max(0, average)) + '%';
        avgEl.style.display = 'flex';
        avgLabelEl.textContent = 'National Avg: ' + Math.round(average) + '%';
        avgLabelEl.style.display = 'inline';
        
        const avgContainer = avgLabelEl.parentElement;
        if (avgContainer) {
          avgContainer.style.paddingLeft = Math.min(100, Math.max(0, average)) + '%';
          avgContainer.style.transform = 'translateX(-50%)';
        }
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
  const addressText = formatAddress(school.address);
  const addressEl = document.getElementById('nh-address');
  if (addressEl) addressEl.textContent = addressText || '—';
  
  const laEl = document.getElementById('nh-la');
  if (laEl) {
    laEl.textContent = school.address?.local_authority ? 
      `${school.address.local_authority}${school.address.region ? ', ' + school.address.region : ''}` : '';
  }

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

  const mapsLink = document.getElementById('nh-maps-link');
  if (mapsLink) {
    if (typeof school.latitude === 'number' && typeof school.longitude === 'number' && 
        !isNaN(school.latitude) && !isNaN(school.longitude)) {
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${school.latitude},${school.longitude}`;
    } else if (addressText) {
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
    }
  }

  const lat = parseFloat(school.latitude);
  const lon = parseFloat(school.longitude);
  
  console.log('School coordinates:', { lat, lon, name: school.name });

  if (!isNaN(lat) && !isNaN(lon)) {
    setTimeout(() => {
      console.log('Initializing map with DB coordinates:', lat, lon);
      initMap(lat, lon, school.name);
    }, 200);
  } else if (addressText) {
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
    
    // Ensure rating is capped at 10
    if (s.overall_rating) {
      s.overall_rating = Math.min(10, Math.max(1, parseInt(s.overall_rating) || 5));
    }
    
    // CRITICAL FIX: Make school data globally available for review component
    window.currentSchoolData = s;
    
    // IMPORTANT: Call updateRatingDisplay directly here
    if (typeof updateRatingDisplay === 'function') {
      updateRatingDisplay(s);
    }
    
    // Also dispatch event for other components
    window.dispatchEvent(new CustomEvent('schoolDataLoaded', { detail: s }));
    console.log('School data loaded and rating updated:', s.urn, 'Rating:', s.overall_rating);

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
      
      const ofstedLink = document.getElementById('ofsted-report-link');
      if (ofstedLink && s.ofsted.web_link) {
        ofstedLink.href = s.ofsted.web_link;
        ofstedLink.style.display = '';
      } else if (ofstedLink) {
        ofstedLink.style.display = 'none';
      }

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
    if (statStudentsEl) statStudentsEl.textContent = formatNumber(s.demographics?.total_students) || '-';
    
    const fsm = s.demographics?.fsm_percentage;
    const statFSMEl = document.getElementById('statFSM');
    if (statFSMEl) statFSMEl.textContent = (fsm !== null && fsm !== undefined) ? (fsm + '%') : '-';
    
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

    // Update breadcrumbs with actual data from school
    const schoolCrumbEl = document.getElementById('schoolCrumb');
    if (schoolCrumbEl) schoolCrumbEl.textContent = s.name || 'School';
    
    // Update city breadcrumb with actual town/city from school data
    const cityCrumbEl = document.getElementById('cityCrumb');
    if (cityCrumbEl && s.address?.town) {
      cityCrumbEl.textContent = s.address.town;
      const citySlug = s.address.town.toLowerCase().replace(/\s+/g, '-');
      cityCrumbEl.href = `/${citySlug}`;
      cityCrumbEl.style.display = 'inline';
    } else if (cityCrumbEl) {
      cityCrumbEl.style.display = 'none';
      const citySeparator = cityCrumbEl.previousElementSibling;
      if (citySeparator && citySeparator.classList.contains('breadcrumb-separator')) {
        citySeparator.style.display = 'none';
      }
    }
    
    // Update local authority breadcrumb with actual LA from school data
    const laCrumbEl = document.getElementById('laCrumb');
    if (laCrumbEl && s.address?.local_authority) {
      laCrumbEl.textContent = s.address.local_authority;
      const laSlug = s.address.local_authority.toLowerCase().replace(/\s+/g, '-');
      
      if (s.address?.town) {
        const citySlug = s.address.town.toLowerCase().replace(/\s+/g, '-');
        laCrumbEl.href = `/${citySlug}/${laSlug}`;
      } else {
        laCrumbEl.href = `/local-authority/${laSlug}`;
      }
      laCrumbEl.style.display = 'inline';
    } else if (laCrumbEl) {
      laCrumbEl.style.display = 'none';
      const laSeparator = laCrumbEl.previousElementSibling;
      if (laSeparator && laSeparator.classList.contains('breadcrumb-separator')) {
        laSeparator.style.display = 'none';
      }
    }
    
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

    // Render sections - wrap in try/catch to prevent crashes
    try {
      renderTestScores(s);
    } catch (e) {
      console.error('Error rendering test scores:', e);
    }
    
    try {
      renderDemographics(s);
    } catch (e) {
      console.error('Error rendering demographics:', e);
    }

    renderNeighborhood(s);

    // Load performance data
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
        nearbySchoolsEl.innerHTML = near.nearby_schools.slice(0,5).map(n => {
          const rating = Math.min(10, Math.max(1, parseInt(n.overall_rating) || 5));
          return `
          <div class="nearby-school" onclick="window.location.href='/school/${n.urn}'" style="cursor:pointer; padding:0.75rem 0; border-bottom:1px solid #f3f4f6;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; color:#111827; font-size:0.875rem;">${n.name}</div>
                <div style="color:#6b7280; font-size:0.75rem;">${n.type_of_establishment || ''}</div>
              </div>
              <div style="font-weight:700; color:#2563eb; font-size:0.875rem;">${rating}/10</div>
            </div>
          </div>
        `}).join('');
      }
    }
    
  } catch(e) {
    console.error('Error loading school:', e);
    const nameEl = document.getElementById('schoolName');
    if (nameEl) nameEl.textContent = 'Error Loading School';
  }
}

// Initialize page - FIXED URN EXTRACTION
(function init() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  let urn = null;

  console.log('URL parts:', parts); // Debug log

  // FIX: Clean URN extraction with hash removal
  if (parts[0] === 'school' && parts[1]) {
    // Format: /school/135816 or /school/135816-school-name
    urn = parts[1].split('#')[0].split('-')[0];
  } else if (parts.length === 2) {
    // Format: /city/135816 or /city/135816-school-name
    // Check if second part starts with digits (URN)
    const potentialUrn = parts[1].split('#')[0].split('-')[0];
    if (!isNaN(Number(potentialUrn))) {
      urn = potentialUrn;
    }
  } else if (parts.length === 3) {
    // Format: /city/la/135816 or /city/la/135816-school-name
    const potentialUrn = parts[2].split('#')[0].split('-')[0];
    if (!isNaN(Number(potentialUrn))) {
      urn = potentialUrn;
    }
  }

  if (!urn) {
    console.error('Could not extract URN from URL:', window.location.pathname);
    const nameEl = document.getElementById('schoolName');
    if (nameEl) nameEl.textContent = 'Error Loading School';
    return;
  }

  console.log('Initializing school page with URN:', urn);
  
  // Load the school data and ensure rating display is called
  loadAll(urn).then(() => {
    // Double-check that rating display is updated after load
    if (window.currentSchoolData && typeof updateRatingDisplay === 'function') {
      console.log('Ensuring rating display is updated');
      updateRatingDisplay(window.currentSchoolData);
    }
  }).catch(err => {
    console.error('Error in loadAll:', err);
  });
})();

// Export functions for global use
window.showSubjectInfo = showSubjectInfo;
window.toggleDetails = toggleDetails;
window.formatNumber = formatNumber;
window.updateRatingDisplay = updateRatingDisplay; // Export this function