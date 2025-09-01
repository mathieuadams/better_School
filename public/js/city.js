// city.js - Complete JavaScript for City Page with fair ranking system

// Global variables
let cityData = {
  name: '',
  schools: [],
  localAuthorities: {},
  schoolsByPhase: {
    primary: [],
    secondary: [],
    sixthForm: []
  }
};

// Initialize page
(async function init() {
  const citySlug = window.location.pathname.split('/').filter(Boolean)[0] || '';
  cityData.name = citySlug.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  // Update page titles
  document.getElementById('cityName').textContent = cityData.name;
  document.getElementById('cityNameInLA').textContent = cityData.name;
  document.getElementById('cityNameInRating').textContent = cityData.name;
  document.getElementById('cityNameInSchools').textContent = cityData.name;
  document.getElementById('pageTitle').textContent = `${cityData.name} Schools - Better School UK`;
  
  // Load city schools
  await loadCitySchools();
})();

// Load all schools in the city
async function loadCitySchools() {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(cityData.name)}&type=location&limit=500`);
    const data = await response.json();
    
    if (data.success && data.schools) {
      cityData.schools = data.schools;
      processSchoolsData();
      renderLocalAuthorities();
      renderOfstedDistribution();
      renderTopSchools();
    }
  } catch (error) {
    console.error('Error loading city schools:', error);
  }
}

// Process schools data for statistics
function processSchoolsData() {
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
  
  // Clear arrays
  cityData.schoolsByPhase.primary = [];
  cityData.schoolsByPhase.secondary = [];
  cityData.schoolsByPhase.sixthForm = [];
  cityData.localAuthorities = {};
  
  cityData.schools.forEach(school => {
    const phase = (school.phase_of_education || '').toLowerCase();
    const type = (school.type_of_establishment || '').toLowerCase();
    const la = school.local_authority || 'Unknown';
    
    // Group by local authority
    if (!cityData.localAuthorities[la]) {
      cityData.localAuthorities[la] = {
        name: la,
        schools: [],
        primary: 0,
        secondary: 0,
        special: 0,
        outstanding: 0,
        good: 0,
        students: 0
      };
    }
    cityData.localAuthorities[la].schools.push(school);
    
    // Count by phase
    if (type.includes('special') || phase.includes('special')) {
      specialCount++;
      cityData.localAuthorities[la].special++;
    } else if (phase.includes('primary') || phase.includes('infant') || phase.includes('junior') || phase.includes('first')) {
      primaryCount++;
      cityData.schoolsByPhase.primary.push(school);
      cityData.localAuthorities[la].primary++;
    } else if (phase.includes('secondary') || phase.includes('middle') || phase.includes('high') || phase.includes('upper')) {
      secondaryCount++;
      cityData.schoolsByPhase.secondary.push(school);
      cityData.localAuthorities[la].secondary++;
      
      if (phase.includes('sixth') || phase.includes('16') || phase.includes('post')) {
        sixthFormCount++;
        cityData.schoolsByPhase.sixthForm.push(school);
      }
    }
    
    // Count students
    if (school.number_on_roll) {
      const students = parseInt(school.number_on_roll) || 0;
      totalStudents += students;
      cityData.localAuthorities[la].students += students;
    }
    
    // Count Ofsted ratings
    switch(school.ofsted_rating) {
      case 1: 
        ofstedCounts.outstanding++;
        cityData.localAuthorities[la].outstanding++;
        break;
      case 2: 
        ofstedCounts.good++;
        cityData.localAuthorities[la].good++;
        break;
      case 3: 
        ofstedCounts.requiresImprovement++;
        break;
      case 4: 
        ofstedCounts.inadequate++;
        break;
      default: 
        ofstedCounts.notInspected++;
        break;
    }
  });
  
  // Update stats
  document.getElementById('totalSchools').textContent = cityData.schools.length;
  document.getElementById('totalStudents').textContent = formatNumber(totalStudents);
  document.getElementById('totalLAs').textContent = Object.keys(cityData.localAuthorities).length;
  
  document.getElementById('primaryCount').textContent = primaryCount;
  document.getElementById('secondaryCount').textContent = secondaryCount;
  document.getElementById('sixthFormCount').textContent = sixthFormCount;
  document.getElementById('specialCount').textContent = specialCount;
  
  // Store ofsted counts for later use
  cityData.ofstedCounts = ofstedCounts;
}

// Render local authorities breakdown
function renderLocalAuthorities() {
  const laGrid = document.getElementById('laGrid');
  if (!laGrid) return;
  
  const laArray = Object.values(cityData.localAuthorities);
  
  // Sort by number of schools (largest first)
  laArray.sort((a, b) => b.schools.length - a.schools.length);
  
  const html = laArray.map(la => {
    const goodOrOutstanding = la.outstanding + la.good;
    const totalRated = la.schools.filter(s => s.ofsted_rating).length;
    const percentage = totalRated > 0 ? Math.round((goodOrOutstanding / totalRated) * 100) : 0;
    
    // Create URL-friendly slug for the LA
    const laSlug = la.name.toLowerCase().replace(/\s+/g, '-');
    const citySlug = cityData.name.toLowerCase().replace(/\s+/g, '-');
    
    return `
      <div class="la-card" onclick="window.location.href='/${citySlug}/${laSlug}'">
        <div class="la-card-name">${la.name}</div>
        <div class="la-card-stats">
          <div class="la-stat">
            <span class="la-stat-number">${la.schools.length}</span>
            <span class="la-stat-label"> schools</span>
          </div>
          <div class="la-stat">
            <span class="la-stat-number">${formatNumber(la.students)}</span>
            <span class="la-stat-label"> students</span>
          </div>
          <div class="la-stat">
            <span class="la-stat-number">${la.primary}</span>
            <span class="la-stat-label"> primary</span>
          </div>
          <div class="la-stat">
            <span class="la-stat-number">${la.secondary}</span>
            <span class="la-stat-label"> secondary</span>
          </div>
        </div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 0.875rem; color: #10b981; font-weight: 600;">
            ${percentage}% Good or Outstanding
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  laGrid.innerHTML = html;
}

// Render Ofsted distribution
function renderOfstedDistribution() {
  const totalInspected = Object.values(cityData.ofstedCounts).reduce((a, b) => a + b, 0) - 
                         (cityData.ofstedCounts.notInspected || 0);
  
  if (totalInspected > 0) {
    const outstandingPct = ((cityData.ofstedCounts.outstanding / totalInspected) * 100).toFixed(1);
    const goodPct = ((cityData.ofstedCounts.good / totalInspected) * 100).toFixed(1);
    const requiresPct = ((cityData.ofstedCounts.requiresImprovement / totalInspected) * 100).toFixed(1);
    const inadequatePct = ((cityData.ofstedCounts.inadequate / totalInspected) * 100).toFixed(1);
    
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
}

// Fair ranking system that considers data completeness
function categorizeAndRankSchools(schools) {
  const tiers = {
    complete: [],
    partial: [],
    ofstedOnly: [],
    unrated: []
  };
  
  schools.forEach(school => {
    if (school.overall_rating !== null && school.overall_rating !== undefined) {
      // Determine completeness based on rating components or value
      const rating = parseFloat(school.overall_rating);
      
      // Check if school has comprehensive data (heuristic: non-standard Ofsted-only values)
      // Schools with only Ofsted would have ratings like 9, 7, 5, 3
      const isLikelyOfstedOnly = [9, 7, 5, 3].includes(Math.round(rating));
      
      if (school.rating_data_completeness >= 100) {
        tiers.complete.push(school);
      } else if (school.rating_data_completeness >= 40) {
        tiers.partial.push(school);
      } else if (isLikelyOfstedOnly && !school.rating_data_completeness) {
        tiers.ofstedOnly.push(school);
      } else {
        // Assume complete if we have a non-standard rating value
        tiers.complete.push(school);
      }
    } else if (school.ofsted_rating) {
      tiers.ofstedOnly.push(school);
    } else {
      tiers.unrated.push(school);
    }
  });
  
  // Sort each tier
  const sortByRating = (a, b) => {
    const ratingA = parseFloat(a.overall_rating) || 0;
    const ratingB = parseFloat(b.overall_rating) || 0;
    return ratingB - ratingA;
  };
  
  const sortByOfsted = (a, b) => {
    return (a.ofsted_rating || 5) - (b.ofsted_rating || 5);
  };
  
  tiers.complete.sort(sortByRating);
  tiers.partial.sort(sortByRating);
  tiers.ofstedOnly.sort(sortByOfsted);
  tiers.unrated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  
  return [...tiers.complete, ...tiers.partial, ...tiers.ofstedOnly, ...tiers.unrated];
}

// Render top schools with fair ranking
function renderTopSchools() {
  // Render top 5 of each phase
  renderSchoolList('primarySchools', cityData.schoolsByPhase.primary, 5);
  renderSchoolList('secondarySchools', cityData.schoolsByPhase.secondary, 5);
  renderSchoolList('sixthFormSchools', cityData.schoolsByPhase.sixthForm, 5);
}

// Render school list with fair ranking
function renderSchoolList(containerId, schools, showMax = 5) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (schools.length === 0) {
    container.innerHTML = '<div class="loading">No schools found in this category</div>';
    return;
  }
  
  // Apply fair ranking
  const rankedSchools = categorizeAndRankSchools(schools);
  const topSchools = rankedSchools.slice(0, showMax);
  
  const html = topSchools.map((school, index) => {
    let rating;
    let dataIndicator = '';
    
    if (school.overall_rating !== null && school.overall_rating !== undefined) {
      rating = Math.min(10, Math.max(1, Math.round(parseFloat(school.overall_rating))));
      
      // Determine data completeness
      if (school.rating_data_completeness >= 100) {
        dataIndicator = ' <span style="color:#10b981;font-size:0.7rem;" title="Complete data">✓</span>';
      } else if (school.rating_data_completeness >= 40) {
        dataIndicator = ' <span style="color:#f59e0b;font-size:0.7rem;" title="Partial data">⚬</span>';
      }
    } else if (school.ofsted_rating) {
      const ofstedMap = { 1: 9, 2: 7, 3: 5, 4: 3 };
      rating = ofstedMap[school.ofsted_rating] || 5;
      dataIndicator = ' <span style="color:#6b7280;font-size:0.7rem;" title="Ofsted only">※</span>';
    } else {
      rating = '-';
    }
    
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
            <div class="metric-value">${rating}/10${dataIndicator}</div>
            <div class="metric-label">Rating</div>
          </div>
          ${school.ofsted_rating ? `
          <div class="ofsted-badge ${getOfstedClass(school.ofsted_rating)}">
            ${getOfstedLabel(school.ofsted_rating)}
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Switch between school phases
function switchPhase(phase) {
  document.querySelectorAll('.school-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.phase === phase) {
      tab.classList.add('active');
    }
  });
  
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