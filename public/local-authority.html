// local-authority.js - JavaScript for Local Authority Summary Page

// Global variables
let currentLA = null;
let schoolsByPhase = {
  primary: [],
  secondary: [],
  sixthForm: []
};

// Initialize page
(async function init() {
  // Extract LA and city from URL
  const path = window.location.pathname.split('/').filter(Boolean);
  let laSlug = null;
  let citySlug = null;
  
  if (path.length === 2) {
    // Format: /city/local-authority or /local-authority/name
    if (path[0] === 'local-authority') {
      laSlug = path[1];
    } else {
      citySlug = path[0];
      laSlug = path[1];
    }
  } else if (path.length === 1) {
    // Format: /local-authority-name (single segment)
    laSlug = path[0];
  }
  
  if (!laSlug) {
    console.error('No local authority specified in URL');
    document.getElementById('laName').textContent = 'Local Authority Not Found';
    return;
  }
  
  // Convert slug to LA name (e.g., "westminster-city-council" -> "Westminster City Council")
  const laName = laSlug.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  // Update LA breadcrumb - just show the LA name, not school name
  const laCrumb = document.getElementById('laCrumb');
  if (laCrumb) laCrumb.textContent = laName;
  
  // Hide city breadcrumb if we're on a direct LA page
  if (!citySlug) {
    const cityCrumb = document.getElementById('cityCrumb');
    if (cityCrumb) {
      cityCrumb.style.display = 'none';
      const citySeparator = cityCrumb.previousElementSibling;
      if (citySeparator && citySeparator.classList.contains('breadcrumb-separator')) {
        citySeparator.style.display = 'none';
      }
    }
  }
  
  // Load LA data
  await loadLocalAuthorityData(laName, citySlug);
})();

// Load local authority data
async function loadLocalAuthorityData(laName, citySlug) {
  try {
    // Fetch LA summary data
    const response = await fetch(`/api/local-authority/${encodeURIComponent(laName)}/summary`);
    
    if (!response.ok) {
      // If API endpoint doesn't exist yet, use search API as fallback
      await loadUsingSearchAPI(laName, citySlug);
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      renderLASummary(data, citySlug);
      renderTopSchoolsFromAPI(data.schools);
    }
  } catch (error) {
    console.error('Error loading LA data:', error);
    // Fallback to search API
    await loadUsingSearchAPI(laName, citySlug);
  }
}

// Fallback: Load using search API
async function loadUsingSearchAPI(laName, citySlug) {
  try {
    // Search for all schools in this LA
    const response = await fetch(`/api/search?type=location&q=${encodeURIComponent(laName)}&limit=500`);
    const data = await response.json();
    
    if (data.success && data.schools) {
      const schools = data.schools;
      
      // Process and categorize schools
      const summary = processSchoolsData(schools, laName);
      
      // Try to extract city from school data if we don't have it
      if (!citySlug && schools.length > 0) {
        // Most schools in the LA should have the same town/city
        const towns = schools.map(s => s.town).filter(Boolean);
        if (towns.length > 0) {
          // Find most common town
          const townCounts = {};
          towns.forEach(town => {
            townCounts[town] = (townCounts[town] || 0) + 1;
          });
          const mostCommonTown = Object.keys(townCounts).reduce((a, b) => 
            townCounts[a] > townCounts[b] ? a : b
          );
          summary.city = mostCommonTown;
        }
      }
      
      renderLASummary(summary, citySlug);
      renderTopSchoolsFromSearch(schools);
    }
  } catch (error) {
    console.error('Error loading schools via search:', error);
    document.getElementById('laName').textContent = 'Error Loading Local Authority';
  }
}

// Process schools data to generate summary
function processSchoolsData(schools, laName) {
  let primaryCount = 0;
  let secondaryCount = 0;
  let sixthFormCount = 0;
  let specialCount = 0;
  let totalStudents = 0;
  
  let ofstedCounts = {
    outstanding: 0,
    good: 0,
    requiresImprovement: 0,
    inadequate: 0,
    notInspected: 0
  };
  
  let englishScores = [];
  let mathScores = [];
  let attendanceRates = [];
  let fsmPercentages = [];
  
  // Clear phase arrays
  schoolsByPhase.primary = [];
  schoolsByPhase.secondary = [];
  schoolsByPhase.sixthForm = [];
  
  schools.forEach(school => {
    // Count by phase
    const phase = (school.phase_of_education || '').toLowerCase();
    const type = (school.type_of_establishment || '').toLowerCase();
    
    if (phase.includes('primary') || phase.includes('infant') || phase.includes('junior')) {
      primaryCount++;
      schoolsByPhase.primary.push(school);
    }
    if (phase.includes('secondary') || phase.includes('middle')) {
      secondaryCount++;
      schoolsByPhase.secondary.push(school);
    }
    if (phase.includes('sixth') || phase.includes('16') || phase.includes('post')) {
      sixthFormCount++;
      schoolsByPhase.sixthForm.push(school);
    }
    
    // Check for special schools
    if (type.includes('special')) {
      specialCount++;
    }
    
    // Count students
    if (school.number_on_roll) {
      totalStudents += parseInt(school.number_on_roll) || 0;
    }
    
    // Count Ofsted ratings
    switch(school.ofsted_rating) {
      case 1: ofstedCounts.outstanding++; break;
      case 2: ofstedCounts.good++; break;
      case 3: ofstedCounts.requiresImprovement++; break;
      case 4: ofstedCounts.inadequate++; break;
      default: ofstedCounts.notInspected++; break;
    }
    
    // Collect performance metrics (would need these in the API response)
    if (school.english_score) englishScores.push(parseFloat(school.english_score));
    if (school.math_score) mathScores.push(parseFloat(school.math_score));
    if (school.attendance_rate) attendanceRates.push(parseFloat(school.attendance_rate));
    if (school.fsm_percentage) fsmPercentages.push(parseFloat(school.fsm_percentage));
  });
  
  // Calculate averages
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
  
  return {
    laName: laName,
    totalSchools: schools.length,
    totalStudents: totalStudents,
    primaryCount: primaryCount,
    secondaryCount: secondaryCount,
    sixthFormCount: sixthFormCount,
    specialCount: specialCount,
    ofstedCounts: ofstedCounts,
    avgEnglish: avg(englishScores),
    avgMaths: avg(mathScores),
    avgAttendance: avg(attendanceRates),
    avgFSM: avg(fsmPercentages)
  };
}

// Render LA summary
function renderLASummary(data, citySlug) {
  // Update header with actual LA name
  document.getElementById('laName').textContent = data.laName;
  document.getElementById('laSchoolCount').textContent = data.totalSchools || '0';
  document.getElementById('laStudentCount').textContent = formatNumber(data.totalStudents) || '0';
  document.getElementById('laLocation').textContent = data.region || data.laName;
  
  // Update city breadcrumb if we have city information
  const cityCrumb = document.getElementById('cityCrumb');
  if (cityCrumb) {
    if (data.city || citySlug) {
      const city = data.city || (citySlug ? citySlug.split('-').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null);
      
      if (city) {
        cityCrumb.textContent = city;
        cityCrumb.href = `/${citySlug || city.toLowerCase().replace(/\s+/g, '-')}`;
        cityCrumb.style.display = 'inline';
      } else {
        // Hide city breadcrumb if no city
        cityCrumb.style.display = 'none';
        const citySeparator = cityCrumb.previousElementSibling;
        if (citySeparator && citySeparator.classList.contains('breadcrumb-separator')) {
          citySeparator.style.display = 'none';
        }
      }
    } else {
      // Hide city breadcrumb if no city
      cityCrumb.style.display = 'none';
      const citySeparator = cityCrumb.previousElementSibling;
      if (citySeparator && citySeparator.classList.contains('breadcrumb-separator')) {
        citySeparator.style.display = 'none';
      }
    }
  }
  
  // Update title
  document.getElementById('pageTitle').textContent = `${data.laName} Schools - Better School UK`;
  document.getElementById('laNameFooter').textContent = data.laName;
  
  // Update counts
  document.getElementById('primaryCount').textContent = data.primaryCount || '0';
  document.getElementById('secondaryCount').textContent = data.secondaryCount || '0';
  document.getElementById('sixthFormCount').textContent = data.sixthFormCount || '0';
  document.getElementById('specialCount').textContent = data.specialCount || '0';
  
  // Calculate and render Ofsted distribution
  const totalInspected = Object.values(data.ofstedCounts).reduce((a, b) => a + b, 0) - (data.ofstedCounts.notInspected || 0);
  
  if (totalInspected > 0) {
    const outstandingPct = ((data.ofstedCounts.outstanding / totalInspected) * 100).toFixed(1);
    const goodPct = ((data.ofstedCounts.good / totalInspected) * 100).toFixed(1);
    const requiresPct = ((data.ofstedCounts.requiresImprovement / totalInspected) * 100).toFixed(1);
    const inadequatePct = ((data.ofstedCounts.inadequate / totalInspected) * 100).toFixed(1);
    
    // Update bars
    document.getElementById('outstandingBar').style.width = outstandingPct + '%';
    document.getElementById('outstandingPercent').textContent = outstandingPct + '%';
    
    document.getElementById('goodBar').style.width = goodPct + '%';
    document.getElementById('goodPercent').textContent = goodPct + '%';
    
    document.getElementById('requiresBar').style.width = requiresPct + '%';
    document.getElementById('requiresPercent').textContent = requiresPct + '%';
    
    document.getElementById('inadequateBar').style.width = inadequatePct + '%';
    document.getElementById('inadequatePercent').textContent = inadequatePct + '%';
    
    // Update summary
    const aboveAverage = parseFloat(outstandingPct) + parseFloat(goodPct);
    document.getElementById('aboveAveragePercent').textContent = aboveAverage.toFixed(1) + '%';
  }
  
  // Update performance metrics
  if (data.avgEnglish) {
    document.getElementById('avgEnglish').textContent = data.avgEnglish + '%';
  }
  if (data.avgMaths) {
    document.getElementById('avgMaths').textContent = data.avgMaths + '%';
  }
  if (data.avgAttendance) {
    document.getElementById('avgAttendance').textContent = data.avgAttendance + '%';
  }
  if (data.avgFSM) {
    document.getElementById('avgFSM').textContent = data.avgFSM + '%';
  }
  
  // Update view all link
  const viewAllLink = document.getElementById('viewAllLink');
  if (viewAllLink) {
    viewAllLink.href = `/search?type=location&q=${encodeURIComponent(data.laName)}`;
  }
}

// Render top schools from API results
function renderTopSchoolsFromAPI(schools) {
  // Categorize schools
  schoolsByPhase.primary = [];
  schoolsByPhase.secondary = [];
  schoolsByPhase.sixthForm = [];
  
  schools.forEach(school => {
    const phase = (school.phase_of_education || '').toLowerCase();
    
    if (phase.includes('primary') || phase.includes('infant') || phase.includes('junior')) {
      schoolsByPhase.primary.push(school);
    }
    if (phase.includes('secondary') || phase.includes('middle')) {
      schoolsByPhase.secondary.push(school);
    }
    if (phase.includes('sixth') || phase.includes('16') || phase.includes('post')) {
      schoolsByPhase.sixthForm.push(school);
    }
  });
  
  renderTopSchoolsFromSearch(schools);
}

// Render top schools from search results
function renderTopSchoolsFromSearch(schools) {
  // Sort schools by rating with proper capping
  schoolsByPhase.primary.sort((a, b) => {
    const ratingA = Math.min(10, parseInt(a.overall_rating) || 5);
    const ratingB = Math.min(10, parseInt(b.overall_rating) || 5);
    if (a.ofsted_rating !== b.ofsted_rating) {
      return (a.ofsted_rating || 5) - (b.ofsted_rating || 5);
    }
    return ratingB - ratingA;
  });
  
  schoolsByPhase.secondary.sort((a, b) => {
    const ratingA = Math.min(10, parseInt(a.overall_rating) || 5);
    const ratingB = Math.min(10, parseInt(b.overall_rating) || 5);
    if (a.ofsted_rating !== b.ofsted_rating) {
      return (a.ofsted_rating || 5) - (b.ofsted_rating || 5);
    }
    return ratingB - ratingA;
  });
  
  schoolsByPhase.sixthForm.sort((a, b) => {
    const ratingA = Math.min(10, parseInt(a.overall_rating) || 5);
    const ratingB = Math.min(10, parseInt(b.overall_rating) || 5);
    if (a.ofsted_rating !== b.ofsted_rating) {
      return (a.ofsted_rating || 5) - (b.ofsted_rating || 5);
    }
    return ratingB - ratingA;
  });
  
  // Render top schools for each phase
  renderSchoolList('primarySchools', schoolsByPhase.primary.slice(0, 5));
  renderSchoolList('secondarySchools', schoolsByPhase.secondary.slice(0, 5));
  renderSchoolList('sixthFormSchools', schoolsByPhase.sixthForm.slice(0, 5));
}

// Render school list
function renderSchoolList(containerId, schools) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (schools.length === 0) {
    container.innerHTML = '<div class="loading">No schools found in this category</div>';
    return;
  }
  
  const html = schools.map((school, index) => {
    // CRITICAL: Cap rating at 10
    const rating = Math.min(10, Math.max(1, parseInt(school.overall_rating) || 5));
    
    return `
    <div class="school-item" onclick="window.location.href='/school/${school.urn}'">
      <div class="school-rank">${index + 1}</div>
      <div class="school-details">
        <div class="school-name">${school.name}</div>
        <div class="school-info">
          <span class="school-info-item">📍 ${school.postcode || 'N/A'}</span>
          <span class="school-info-item">• ${school.type_of_establishment || 'School'}</span>
          ${school.number_on_roll ? `<span class="school-info-item">• ${formatNumber(school.number_on_roll)} students</span>` : ''}
        </div>
      </div>
      <div class="school-metrics">
        <div class="metric">
          <div class="metric-value">${rating}/10</div>
          <div class="metric-label">Rating</div>
        </div>
        ${school.ofsted_rating ? `
        <div class="ofsted-badge ${getOfstedClass(school.ofsted_rating)}">
          ${getOfstedLabel(school.ofsted_rating)}
        </div>` : ''}
      </div>
    </div>
  `}).join('');
  
  container.innerHTML = html;
}

// Switch between school phases
function switchPhase(phase) {
  // Update tabs
  document.querySelectorAll('.school-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.phase === phase) {
      tab.classList.add('active');
    }
  });
  
  // Update content
  document.querySelectorAll('.school-list').forEach(list => {
    list.classList.remove('active');
  });
  
  if (phase === 'primary') {
    document.getElementById('primarySchools').classList.add('active');
  } else if (phase === 'secondary') {
    document.getElementById('secondarySchools').classList.add('active');
  } else if (phase === 'sixth-form') {
    document.getElementById('sixthFormSchools').classList.add('active');
  }
}

// Helper functions
function formatNumber(num) {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getOfstedLabel(rating) {
  const labels = {
    1: 'Outstanding',
    2: 'Good',
    3: 'Requires Improvement',
    4: 'Inadequate'
  };
  return labels[rating] || 'Not Inspected';
}

function getOfstedClass(rating) {
  const classes = {
    1: 'outstanding',
    2: 'good',
    3: 'requires-improvement',
    4: 'inadequate'
  };
  return classes[rating] || '';
}

// Make switchPhase available globally
window.switchPhase = switchPhase;