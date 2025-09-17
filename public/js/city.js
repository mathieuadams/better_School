// city.js - Complete JavaScript for City Page with fair ranking system and Scotland support

// Global variables
let cityData = {
  name: '',
  schools: [],
  localAuthorities: {},
  schoolsByPhase: {
    primary: [],
    secondary: [],
    sixthForm: []
  },
  isScottish: false, // Add flag for Scottish cities (legacy)
  isNonEngland: false,
  country: 'England'
};

function canonicalUrl() {
  const trimmedPath = window.location.pathname.endsWith('/') && window.location.pathname !== '/'
    ? window.location.pathname.slice(0, -1)
    : window.location.pathname;
  return `https://www.findschool.uk${trimmedPath || '/'}`;
}

function updateCityMeta(cityName) {
  const pageTitle = `${cityName} Schools Guide | FindSchool.uk`;
  const description = `Explore top performing schools in ${cityName} with FindSchool.uk. Compare Ofsted ratings, academic results and parent reviews to choose confidently.`;
  const url = canonicalUrl();

  document.title = pageTitle;
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = pageTitle;

  const metaDescription = document.getElementById('metaDescription');
  if (metaDescription) metaDescription.setAttribute('content', description);

  const canonicalLink = document.getElementById('canonicalLink');
  if (canonicalLink) canonicalLink.setAttribute('href', url);

  const alternateLink = document.getElementById('alternateLink');
  if (alternateLink) alternateLink.setAttribute('href', url);

  const ogTitle = document.getElementById('ogTitle');
  if (ogTitle) ogTitle.setAttribute('content', pageTitle);

  const ogDescription = document.getElementById('ogDescription');
  if (ogDescription) ogDescription.setAttribute('content', description);

  const ogUrl = document.getElementById('ogUrl');
  if (ogUrl) ogUrl.setAttribute('content', url);

  const twitterTitle = document.getElementById('twitterTitle');
  if (twitterTitle) twitterTitle.setAttribute('content', pageTitle);

  const twitterDescription = document.getElementById('twitterDescription');
  if (twitterDescription) twitterDescription.setAttribute('content', description);

  const structuredDataEl = document.getElementById('structuredData');
  if (structuredDataEl) {
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "name": pageTitle,
          "url": url,
          "description": description,
          "isPartOf": {
            "@type": "WebSite",
            "name": "FindSchool.uk",
            "url": "https://www.findschool.uk/"
          }
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://www.findschool.uk/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": cityName,
              "item": url
            }
          ]
        }
      ]
    };
    structuredDataEl.textContent = JSON.stringify(structuredData, null, 2);
  }
}

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
  updateCityMeta(cityData.name);
  
  // Wire city search button to localized search page
  const citySearchLink = document.getElementById('citySearchLink');
  if (citySearchLink) {
    const areaParam = encodeURIComponent(cityData.name);
    citySearchLink.href = `/search.html?area=${areaParam}`;
    citySearchLink.setAttribute('aria-label', `Search all schools in ${cityData.name}`);
    // Update visible label as well
    const labelSpan = citySearchLink.querySelector('span:last-child');
    if (labelSpan) {
      labelSpan.textContent = `Search all schools in ${cityData.name}`;
    }
  }
  
  // Load city schools
  await loadCitySchools();
})();

// Get city country from first school's API
async function getCityCountry(schools) {
  if (schools && schools.length > 0) {
    try {
      const firstSchool = schools[0];
      if (firstSchool && firstSchool.urn) {
        const response = await fetch(`/api/schools/${firstSchool.urn}`);
        const data = await response.json();
        return data.school?.country || 'England';
      }
    } catch (error) {
      console.error('Error checking country:', error);
    }
  }
  return 'England';
}

// Hide England-only features (Ofsted, sixth form UI)
function hideEnglandOnlyFeatures() {
  // Hide Ofsted ratings section
  const ratingsSection = document.querySelector('.ratings-section');
  if (ratingsSection) {
    ratingsSection.style.display = 'none';
  }
  
  // Hide sixth form tab
  const sixthFormTab = document.querySelector('[data-phase="sixth-form"]');
  if (sixthFormTab) {
    sixthFormTab.style.display = 'none';
  }
  
  // Hide sixth form count in stats
  const sixthFormStatCard = document.getElementById('sixthFormCount')?.closest('.stat-card');
  if (sixthFormStatCard) {
    sixthFormStatCard.style.display = 'none';
  }
  
  // Adjust grid to 3 columns for remaining stats
  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid) {
    statsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
  }
}

// Load all schools in the city
async function loadCitySchools() {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(cityData.name)}&type=location&limit=500`);
    const data = await response.json();
    
    if (data.success && data.schools) {
      cityData.schools = data.schools;
      
      // Determine country flags
      cityData.country = await getCityCountry(data.schools);
      cityData.isNonEngland = (cityData.country && cityData.country.toLowerCase() !== 'england');
      cityData.isScottish = (cityData.country === 'Scotland');
      if (cityData.isNonEngland) hideEnglandOnlyFeatures();
      
      processSchoolsData();
      renderLocalAuthorities();
      
      // Only render Ofsted distribution for England
      if (!cityData.isNonEngland) {
        renderOfstedDistribution();
      }
      
      await renderTopSchools();
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
  const sixthFormUrns = new Set();

  // Clear arrays
  cityData.schoolsByPhase.primary = [];
  cityData.schoolsByPhase.secondary = [];
  cityData.schoolsByPhase.sixthForm = [];
  cityData.localAuthorities = {};
  
  const normalizeLAName = (raw) => {
    if (!raw) return null;
    const name = String(raw).trim();
    if (!name) return null;
    const lower = name.toLowerCase();
    if (['unknown', 'n/a', 'na', 'not applicable'].includes(lower)) return null;
    return name;
  };

  const resolveLocalAuthority = (school) => {
    const candidates = [
      normalizeLAName(school.local_authority),
      normalizeLAName(school.parliamentary_constituency),
      normalizeLAName(school.county),
      normalizeLAName(school.region)
    ];

    for (const candidate of candidates) {
      if (candidate) return candidate;
    }

    if (cityData.isNonEngland) {
      const town = normalizeLAName(school.town);
      if (town) return town;
    }

    return 'Unknown';
  };

  // Helper to robustly classify school phases across UK (NI included)
  const classify = (school) => {
    const phase = (school.phase_of_education || '').toLowerCase();
    const type = (school.type_of_establishment || '').toLowerCase();
    const group = (school.establishment_group || '').toLowerCase();
    const combined = `${phase} ${type} ${group}`.trim();

    if (!combined) return null;

    const contains = (term) => combined.includes(term);

    if (contains('special') || contains('sen')) {
      return 'special';
    }

    if (contains('all-through') || contains('all through') || contains('primary and secondary') || contains('through school')) {
      return 'all-through';
    }

    if (contains('post-primary') || contains('post primary')) {
      return 'secondary';
    }

    const primaryIndicators = ['primary', 'infant', 'junior', 'first school', 'first ', 'nursery', 'preparatory', 'prep', 'elementary', 'lower school'];
    if (primaryIndicators.some(term => contains(term))) {
      return 'primary';
    }

    const secondaryIndicators = ['secondary', 'middle', 'high', 'upper', 'senior', 'academy', 'grammar', 'comprehensive', 'coláiste', 'college', 'post-16', 'post 16'];
    if (secondaryIndicators.some(term => contains(term))) {
      return 'secondary';
    }

    const sixthIndicators = ['sixth', 'six form', 'sixthform', 'further education'];
    if (sixthIndicators.some(term => contains(term))) {
      return 'sixth';
    }

    return null;
  };

  cityData.schools.forEach(school => {
    const laName = resolveLocalAuthority(school);
    const laKey = laName.toLowerCase();

    // Group by local authority
    if (!cityData.localAuthorities[laKey]) {
      cityData.localAuthorities[laKey] = {
        name: laName,
        schools: [],
        primary: 0,
        secondary: 0,
        special: 0,
        outstanding: 0,
        good: 0,
        students: 0
      };
    }
    const laRecord = cityData.localAuthorities[laKey];
    laRecord.schools.push(school);

    // Count by phase
    const cls = classify(school);
    const meta = `${(school.phase_of_education || '').toLowerCase()} ${(school.type_of_establishment || '').toLowerCase()} ${(school.establishment_group || '').toLowerCase()}`;
    const hasSixth = Boolean(school.has_sixth_form) || /sixth|post-16|post 16|upper sixth|six form|further education/.test(meta);

    if (cls === 'special') {
      specialCount++;
      laRecord.special++;
    }

    if (cls === 'primary' || cls === 'all-through') {
      primaryCount++;
      cityData.schoolsByPhase.primary.push(school);
      laRecord.primary++;
    }

    if (cls === 'secondary' || cls === 'all-through') {
      secondaryCount++;
      cityData.schoolsByPhase.secondary.push(school);
      laRecord.secondary++;
    }

    if (!cityData.isScottish && (cls === 'sixth' || hasSixth)) {
      const urnKey = school.urn || school.id || `${school.name}-${laKey}`;
      if (!sixthFormUrns.has(urnKey)) {
        sixthFormUrns.add(urnKey);
        sixthFormCount++;
        cityData.schoolsByPhase.sixthForm.push(school);
      }
    }

    // Count students (fallback to total_pupils for NI)
    const pupils = school.number_on_roll ?? school.total_pupils;
    if (pupils) {
      const students = parseInt(pupils) || 0;
      totalStudents += students;
      laRecord.students += students;
    }
    
    // Count Ofsted ratings (England only)
    if (!cityData.isNonEngland) {
      switch(school.ofsted_rating) {
        case 1: 
          ofstedCounts.outstanding++;
          laRecord.outstanding++;
          break;
        case 2: 
          ofstedCounts.good++;
          laRecord.good++;
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
    }
  });
  
  // Update stats
  document.getElementById('totalSchools').textContent = cityData.schools.length;
  document.getElementById('totalStudents').textContent = formatNumber(totalStudents);
  const laValues = Object.values(cityData.localAuthorities);
  const knownLaCount = laValues.filter(la => la.name !== 'Unknown').length;
  document.getElementById('totalLAs').textContent = knownLaCount || laValues.length;

  document.getElementById('primaryCount').textContent = primaryCount;
  document.getElementById('secondaryCount').textContent = secondaryCount;
  
  // Only show sixth form count for England
  if (!cityData.isNonEngland) {
    document.getElementById('sixthFormCount').textContent = sixthFormCount;
  }
  
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
  laArray.sort((a, b) => {
    if (a.name === 'Unknown') return 1;
    if (b.name === 'Unknown') return -1;
    return b.schools.length - a.schools.length;
  });
  
  const html = laArray.map(la => {
    // Create URL-friendly slug for the LA
    const laSlug = la.name.toLowerCase().replace(/\s+/g, '-');
    const citySlug = cityData.name.toLowerCase().replace(/\s+/g, '-');
    
    // For non-England LAs, don't show Ofsted percentages
    let qualityIndicator = '';
    if (!cityData.isNonEngland) {
      const goodOrOutstanding = la.outstanding + la.good;
      const totalRated = la.schools.filter(s => s.ofsted_rating).length;
      const percentage = totalRated > 0 ? Math.round((goodOrOutstanding / totalRated) * 100) : 0;
      qualityIndicator = `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 0.875rem; color: #10b981; font-weight: 600;">
            ${percentage}% Good or Outstanding
          </div>
        </div>
      `;
    } else {
      // For non-England LAs, show average rating if available
      const ratings = la.schools
        .filter(s => s.overall_rating)
        .map(s => parseFloat(s.overall_rating));
      
      if (ratings.length > 0) {
        const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
        qualityIndicator = `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
            <div style="font-size: 0.875rem; color: #2563eb; font-weight: 600;">
              Avg Rating: ${avgRating}/10
            </div>
          </div>
        `;
      }
    }
    
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
        ${qualityIndicator}
      </div>
    `;
  }).join('');
  
  laGrid.innerHTML = html;
}

// Render Ofsted distribution (England only)
function renderOfstedDistribution() {
  if (cityData.isNonEngland) return; // Skip for non-England cities
  
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
    } else if (school.ofsted_rating && !cityData.isScottish) {
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
async function renderTopSchools() {
  // Render top 5 of each phase, syncing ratings with school API for consistency
  await renderSchoolList('primarySchools', cityData.schoolsByPhase.primary, 5);
  await renderSchoolList('secondarySchools', cityData.schoolsByPhase.secondary, 5);
  
  // Only render sixth form for non-Scottish cities
  if (!cityData.isScottish) {
    await renderSchoolList('sixthFormSchools', cityData.schoolsByPhase.sixthForm, 5);
  }
}

async function renderSchoolList(containerId, schools, showMax = 5) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (schools.length === 0) {
    container.innerHTML = '<div class="loading">No schools found in this category</div>';
    return;
  }
  
  // Apply fair ranking
  const rankedSchools = categorizeAndRankSchools(schools);
  let topSchools = rankedSchools.slice(0, showMax);

  // Fetch authoritative ratings for the displayed schools to match school page
  try {
    const details = await Promise.all(topSchools.map(s => 
      fetch(`/api/schools/${s.urn}`).then(r => r.ok ? r.json() : null).catch(() => null)
    ));
    topSchools = topSchools.map((s, i) => {
      const d = details[i];
      const school = d && d.school ? d.school : null;
      if (school && school.overall_rating != null) {
        return {
          ...s,
          overall_rating: school.overall_rating,
          rating_data_completeness: school.rating_data_completeness,
          rating_components: school.rating_components,
        };
      }
      return s;
    });
  } catch (e) {
    // If any fetch fails, fall back to existing data silently
    console.warn('Failed to sync ratings for list', e);
  }
  

  const html = topSchools.map((school, index) => {
    const ratingInfo = window.getDisplayRating ? window.getDisplayRating(school, { placeholder: 'No rating' }) : {
      hasRating: !!school.overall_rating,
      display: school.overall_rating,
      value: Number(school.overall_rating) || null,
      completeness: school.rating_data_completeness || 0,
      reason: school.overall_rating ? null : 'no-score'
    };
    const ratingText = ratingInfo.hasRating ? `${ratingInfo.display}/10` : 'No rating';
    let dataIndicator = '';
    if (ratingInfo.hasRating) {
      if (school.rating_data_completeness >= 100) {
        dataIndicator = ' <span style="color:#10b981;font-size:0.7rem;" title="Complete data">✓</span>';
      } else if (school.rating_data_completeness >= 40) {
        dataIndicator = ' <span style="color:#f59e0b;font-size:0.7rem;" title="Partial data">◐</span>';
      } else if (school.rating_data_completeness && school.rating_data_completeness < 40) {
        dataIndicator = ' <span style="color:#dc2626;font-size:0.7rem;" title="Insufficient data">⚠</span>';
      }
    } else if (ratingInfo.reason === 'attendance-or-ofsted-only') {
      dataIndicator = ' <span style="color:#dc2626;font-size:0.7rem;" title="Requires performance data">⚠</span>';
    } else if (ratingInfo.reason === 'insufficient-data') {
      dataIndicator = ' <span style="color:#dc2626;font-size:0.7rem;" title="Insufficient data">⚠</span>';
    }

    const ofstedBadge = (!cityData.isNonEngland && school.ofsted_rating) ? `
      <div class="ofsted-badge ${getOfstedClass(school.ofsted_rating)}">
        ${getOfstedLabel(school.ofsted_rating)}
      </div>` : '';

    return `
      <div class="school-item" onclick="window.location.href='${window.schoolPath ? window.schoolPath(school) : '/school/' + school.urn}'">
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
            <div class="metric-value">${ratingText}${dataIndicator}</div>
            <div class="metric-label">Rating</div>
          </div>
          ${ofstedBadge}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// Switch between school phases
function switchPhase(phase) {
  // Don't allow switching to sixth form for non-England cities
  if (phase === 'sixth-form' && cityData.isNonEngland) {
    return;
  }
  
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
