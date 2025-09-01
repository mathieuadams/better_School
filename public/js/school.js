// school.js - Complete JavaScript for School Page with Scotland support

// Global variables
let currentSchoolData = null;
let isScottishSchool = false;

// Extract URN from URL
function extractURN() {
  const pathParts = window.location.pathname.split('/');
  
  // Handle different URL formats
  // Format 1: /school/123456 or /school/123456-school-name
  // Format 2: /city/123456 or /city/123456-school-name
  // Format 3: /city/la/123456 or /city/la/123456-school-name
  
  for (let i = pathParts.length - 1; i >= 0; i--) {
    const part = pathParts[i];
    if (part) {
      // Extract URN from the part (could be just URN or URN-slug)
      const urnMatch = part.match(/^(\d+)/);
      if (urnMatch) {
        return urnMatch[1];
      }
    }
  }
  
  return null;
}

// Hide England-specific features for Scottish schools
function hideScotlandFeatures() {
  // Hide Ofsted section
  const ofstedSection = document.getElementById('ofstedSection');
  if (ofstedSection) {
    ofstedSection.style.display = 'none';
  }
  
  // Hide Ofsted in header
  const ofstedRating = document.querySelector('.ofsted-rating');
  if (ofstedRating) {
    ofstedRating.style.display = 'none';
  }
  
  // Hide Science test scores
  const scienceRow = document.querySelector('.test-score-row:nth-child(3)');
  if (scienceRow) {
    scienceRow.style.display = 'none';
  }
  
  // Hide any elements with data-subject="science"
  const scienceElements = document.querySelectorAll('[data-subject="science"]');
  scienceElements.forEach(el => {
    el.style.display = 'none';
  });
  
  // Hide sixth form related elements
  const sixthFormElements = document.querySelectorAll('[data-sixth-form]');
  sixthFormElements.forEach(el => {
    el.style.display = 'none';
  });
  
  // Hide Science in key stats if present
  const statScience = document.getElementById('statScience');
  if (statScience) {
    statScience.closest('.key-stat')?.style.display = 'none';
  }
}

// Adjust Scottish rating components
function adjustScottishRating(school) {
  // For Scottish schools, rating is based only on:
  // - Academic (English + Math): 60% weight
  // - Attendance: 40% weight
  // Total possible: 100%
  
  if (school.rating_components) {
    let totalDataAvailable = 0;
    
    school.rating_components.forEach(component => {
      if (component.name === 'academic') {
        // For Scotland, academic should be 60% weight
        component.weight = 60;
        totalDataAvailable += 60;
      } else if (component.name === 'attendance') {
        // For Scotland, attendance should be 40% weight
        component.weight = 40;
        totalDataAvailable += 40;
      }
    });
    
    // Update data completeness for Scotland
    school.rating_data_completeness = totalDataAvailable;
  }
}

async function loadSchoolData() {
  const urn = extractURN();
  if (!urn) {
    console.error('No URN found');
    const schoolNameEl = document.getElementById('schoolName');
    if (schoolNameEl) {
      schoolNameEl.textContent = 'School Not Found';
    }
    return;
  }
  
  try {
    console.log('Loading school data for URN:', urn);
    const response = await fetch(`/api/schools/${urn}`);
    const data = await response.json();
    
    console.log('School data received:', data);
    
    if (data.success && data.school) {
      // Store school data globally
      currentSchoolData = data.school;
      window.currentSchoolData = data.school;
      
      // Check if this is a Scottish school
      isScottishSchool = data.school.country === 'Scotland' || data.school.is_scotland;
      
      console.log('Is Scottish school:', isScottishSchool);
      
      // Hide England-specific features if Scottish
      if (isScottishSchool) {
        hideScotlandFeatures();
        adjustScottishRating(data.school);
      }
      
      // Update display
      updateSchoolDisplay(data.school);
      
      // Load additional data - with error handling
      try {
        await loadPerformanceData(urn);
      } catch (perfError) {
        console.error('Error loading performance data:', perfError);
      }
      
      try {
        await loadNearbySchools(urn);
      } catch (nearbyError) {
        console.error('Error loading nearby schools:', nearbyError);
      }
      
      // Dispatch event for components
      window.dispatchEvent(new CustomEvent('schoolDataLoaded', { detail: data.school }));
    } else {
      console.error('Invalid school data received:', data);
    }
  } catch (error) {
    console.error('Error loading school data:', error);
    const schoolNameEl = document.getElementById('schoolName');
    if (schoolNameEl) {
      schoolNameEl.textContent = 'Error Loading School';
    }
  }
}
function updateSchoolDisplay(school) {
  try {
    // Update breadcrumbs
    updateBreadcrumbs(school);
    
    // Update header - with null checks
    const schoolName = document.getElementById('schoolName');
    if (schoolName) {
      schoolName.textContent = school.name || 'School Name';
    }
    
    const schoolType = document.getElementById('schoolType');
    if (schoolType) {
      schoolType.textContent = school.type || '-';
    }
    
    const schoolPhase = document.getElementById('schoolPhase');
    if (schoolPhase) {
      schoolPhase.textContent = school.phase || '-';
    }
    
    const ageRangeEl = document.getElementById('ageRange');
    if (ageRangeEl) {
      const ageRange = school.characteristics?.age_range || 
        `${school.age_range_lower || '?'} - ${school.age_range_upper || '?'}`;
      ageRangeEl.textContent = `Ages ${ageRange}`;
    }
    
    // Update address
    const schoolAddressEl = document.getElementById('schoolAddress');
    if (schoolAddressEl) {
      const address = school.address;
      if (address) {
        const addressParts = [
          address.street,
          address.town,
          address.postcode
        ].filter(Boolean).join(', ');
        schoolAddressEl.textContent = addressParts;
      }
    }
    
    // Update overall rating
    const overallRatingEl = document.getElementById('overallRating');
    if (overallRatingEl) {
      if (school.overall_rating) {
        overallRatingEl.textContent = `${parseInt(school.overall_rating)}/10`;
      } else {
        overallRatingEl.textContent = 'N/A';
      }
    }
    
    // Update Ofsted rating (only for non-Scottish schools)
    if (!isScottishSchool && school.ofsted) {
      const ofstedLabels = {
        1: 'Outstanding',
        2: 'Good',
        3: 'Requires Improvement',
        4: 'Inadequate'
      };
      
      const ofstedRatingEl = document.getElementById('ofstedRating');
      if (ofstedRatingEl) {
        ofstedRatingEl.textContent = 
          ofstedLabels[school.ofsted.overall_effectiveness] || 'Not Inspected';
      }
      
      const ofstedDateEl = document.getElementById('ofstedDate');
      if (ofstedDateEl && school.ofsted.inspection_date) {
        const date = new Date(school.ofsted.inspection_date);
        ofstedDateEl.textContent = 
          date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      }
    }
    
    // Update key stats
    updateKeyStats(school);
    
    // Update test scores
    updateTestScores(school);
    
    // Update demographics
    updateDemographics(school);
    
    // Update school info
    updateSchoolInfo(school);
    
    // Update Ofsted details (only for non-Scottish schools)
    if (!isScottishSchool) {
      updateOfstedDetails(school);
    }
    
    // Update contact info
    updateContactInfo(school);
    
    // Update page title
    document.title = `${school.name} - Better School UK`;
    
  } catch (error) {
    console.error('Error updating school display:', error);
  }
}


// Update breadcrumbs
function updateBreadcrumbs(school) {
  const address = school.address;
  if (!address) return;
  
  // Update city breadcrumb
  const cityCrumb = document.getElementById('cityCrumb');
  if (cityCrumb && address.town) {
    cityCrumb.textContent = address.town;
    cityCrumb.href = `/${address.town.toLowerCase().replace(/\s+/g, '-')}`;
  }
  
  // Update LA breadcrumb
  const laCrumb = document.getElementById('laCrumb');
  if (laCrumb && address.local_authority) {
    laCrumb.textContent = address.local_authority;
    const laSlug = address.local_authority.toLowerCase().replace(/\s+/g, '-');
    if (address.town) {
      const citySlug = address.town.toLowerCase().replace(/\s+/g, '-');
      laCrumb.href = `/${citySlug}/${laSlug}`;
    } else {
      laCrumb.href = `/local-authority/${laSlug}`;
    }
  }
  
  // Update school breadcrumb
  const schoolCrumb = document.getElementById('schoolCrumb');
  if (schoolCrumb) {
    schoolCrumb.textContent = school.name;
  }
}

function updateKeyStats(school) {
  // Students
  const students = school.demographics?.total_students;
  const statStudents = document.getElementById('statStudents');
  if (statStudents) {
    statStudents.textContent = students ? students.toLocaleString() : '-';
  }
  
  // FSM
  const fsm = school.demographics?.fsm_percentage;
  const statFSM = document.getElementById('statFSM');
  if (statFSM) {
    statFSM.textContent = fsm ? `${Math.round(fsm)}%` : '-';
  }
  
  // English
  const english = school.test_scores?.english?.score;
  const statEnglish = document.getElementById('statEnglish');
  if (statEnglish) {
    statEnglish.textContent = english ? `${Math.round(english)}%` : '-';
  }
  
  // Math
  const math = school.test_scores?.math?.score;
  const statMath = document.getElementById('statMath');
  if (statMath) {
    statMath.textContent = math ? `${Math.round(math)}%` : '-';
  }
  
  // Attendance
  const absenceRate = school.attendance?.overall_absence_rate;
  const attendance = absenceRate ? (100 - absenceRate) : null;
  const statAttendance = document.getElementById('statAttendance');
  if (statAttendance) {
    statAttendance.textContent = attendance ? `${Math.round(attendance)}%` : '-';
  }
}
function updateTestScores(school) {
  const scores = school.test_scores;
  if (!scores) return;
  
  // English
  const englishScore = document.getElementById('englishScore');
  const englishBar = document.getElementById('englishBar');
  const englishAvg = document.getElementById('englishAvg');
  const englishAvgLabel = document.getElementById('englishAvgLabel');
  
  if (scores.english?.score && englishScore && englishBar) {
    const score = Math.round(scores.english.score);
    englishScore.textContent = `${score}%`;
    englishBar.style.width = `${score}%`;
    
    if (scores.english.average && englishAvg && englishAvgLabel) {
      englishAvg.style.left = `${scores.english.average}%`;
      englishAvg.style.display = 'block';
      englishAvgLabel.textContent = `National Avg: ${Math.round(scores.english.average)}%`;
      englishAvgLabel.style.display = 'inline';
    }
  } else if (englishScore) {
    englishScore.textContent = '-';
  }
  
  // Math
  const mathScore = document.getElementById('mathScore');
  const mathBar = document.getElementById('mathBar');
  const mathAvg = document.getElementById('mathAvg');
  const mathAvgLabel = document.getElementById('mathAvgLabel');
  
  if (scores.math?.score && mathScore && mathBar) {
    const score = Math.round(scores.math.score);
    mathScore.textContent = `${score}%`;
    mathBar.style.width = `${score}%`;
    
    if (scores.math.average && mathAvg && mathAvgLabel) {
      mathAvg.style.left = `${scores.math.average}%`;
      mathAvg.style.display = 'block';
      mathAvgLabel.textContent = `National Avg: ${Math.round(scores.math.average)}%`;
      mathAvgLabel.style.display = 'inline';
    }
  } else if (mathScore) {
    mathScore.textContent = '-';
  }
  
  // Science (hide for Scottish schools)
  const scienceScore = document.getElementById('scienceScore');
  const scienceBar = document.getElementById('scienceBar');
  const scienceAvg = document.getElementById('scienceAvg');
  const scienceAvgLabel = document.getElementById('scienceAvgLabel');
  
  if (!isScottishSchool && scores.science?.score && scienceScore && scienceBar) {
    const score = Math.round(scores.science.score);
    scienceScore.textContent = `${score}%`;
    scienceBar.style.width = `${score}%`;
    
    if (scores.science.average && scienceAvg && scienceAvgLabel) {
      scienceAvg.style.left = `${scores.science.average}%`;
      scienceAvg.style.display = 'block';
      scienceAvgLabel.textContent = `National Avg: ${Math.round(scores.science.average)}%`;
      scienceAvgLabel.style.display = 'inline';
    }
  } else if (scienceScore) {
    scienceScore.textContent = '-';
  }
}


// Update demographics
function updateDemographics(school) {
  const demo = school.demographics;
  if (!demo) return;
  
  // Update demographic elements if they exist
  const elements = {
    'totalStudents': demo.total_students,
    'boysCount': demo.boys,
    'girlsCount': demo.girls,
    'fsmPercentage': demo.fsm_percentage ? `${Math.round(demo.fsm_percentage)}%` : null,
    'ealPercentage': demo.eal_percentage ? `${Math.round(demo.eal_percentage)}%` : null,
    'senSupport': demo.sen_support_percentage ? `${Math.round(demo.sen_support_percentage)}%` : null,
    'senEHCP': demo.sen_ehcp_percentage ? `${Math.round(demo.sen_ehcp_percentage)}%` : null
  };
  
  for (const [id, value] of Object.entries(elements)) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || '-';
    }
  }
}

// Update school info
function updateSchoolInfo(school) {
  const char = school.characteristics;
  if (!char) return;
  
  // Update characteristic elements if they exist
  const elements = {
    'schoolGender': char.gender,
    'religiousCharacter': char.religious_character || 'None',
    'admissionsPolicy': char.admissions_policy || 'Not specified',
    'hasNursery': char.has_nursery ? 'Yes' : 'No',
    'hasSixthForm': char.has_sixth_form && !isScottishSchool ? 'Yes' : 'No',
    'boardingSchool': char.is_boarding_school ? 'Yes' : 'No',
    'senProvision': char.has_sen_provision ? 'Yes' : 'No'
  };
  
  for (const [id, value] of Object.entries(elements)) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || '-';
    }
  }
}

// Update Ofsted details (England only)
function updateOfstedDetails(school) {
  const ofsted = school.ofsted;
  if (!ofsted || !ofsted.overall_effectiveness) return;
  
  const ratings = {
    1: { label: 'Outstanding', class: 'outstanding' },
    2: { label: 'Good', class: 'good' },
    3: { label: 'Requires Improvement', class: 'requires-improvement' },
    4: { label: 'Inadequate', class: 'inadequate' }
  };
  
  // Update inspection date
  if (ofsted.inspection_date) {
    const date = new Date(ofsted.inspection_date);
    document.getElementById('inspectionDate').textContent = 
      `Last inspected: ${date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }
  
  // Create Ofsted grid HTML
  const categories = [
    { key: 'overall_effectiveness', label: 'Overall Effectiveness' },
    { key: 'quality_of_education', label: 'Quality of Education' },
    { key: 'behaviour_and_attitudes', label: 'Behaviour and Attitudes' },
    { key: 'personal_development', label: 'Personal Development' },
    { key: 'leadership_and_management', label: 'Leadership and Management' },
    { key: 'safeguarding_effective', label: 'Safeguarding', isBoolean: true }
  ];
  
  const ofstedGrid = document.getElementById('ofstedGrid');
  if (ofstedGrid) {
    const gridHTML = categories.map(cat => {
      const value = ofsted[cat.key];
      if (value === null || value === undefined) return '';
      
      if (cat.isBoolean) {
        return `
          <div class="performance-metric">
            <div class="metric-label">${cat.label}</div>
            <div class="metric-value ${value ? 'good' : 'inadequate'}">
              ${value ? 'Effective' : 'Not Effective'}
            </div>
          </div>
        `;
      } else {
        const rating = ratings[value] || { label: 'Not Rated', class: '' };
        return `
          <div class="performance-metric">
            <div class="metric-label">${cat.label}</div>
            <div class="metric-value ${rating.class}">${rating.label}</div>
          </div>
        `;
      }
    }).filter(Boolean).join('');
    
    ofstedGrid.innerHTML = gridHTML;
  }
  
  // Update Ofsted report link
  if (ofsted.web_link) {
    const linkContainer = document.getElementById('ofstedLinkContainer');
    const link = document.getElementById('ofsted-report-link');
    if (linkContainer && link) {
      link.href = ofsted.web_link;
      linkContainer.style.display = 'block';
    }
  }
}

// Update contact info
function updateContactInfo(school) {
  // Phone
  if (school.telephone) {
    const phoneElement = document.getElementById('schoolPhone');
    if (phoneElement) {
      phoneElement.textContent = school.telephone;
      phoneElement.href = `tel:${school.telephone}`;
    }
  }
  
  // Website
  if (school.website) {
    const websiteElement = document.getElementById('schoolWebsite');
    if (websiteElement) {
      let website = school.website;
      if (!website.startsWith('http')) {
        website = 'https://' + website;
      }
      websiteElement.textContent = school.website;
      websiteElement.href = website;
    }
  }
  
  // Address
  const address = school.address;
  if (address) {
    const fullAddress = [
      address.street,
      address.locality,
      address.town,
      address.postcode
    ].filter(Boolean).join(', ');
    
    const addressElement = document.getElementById('schoolFullAddress');
    if (addressElement) {
      addressElement.textContent = fullAddress;
    }
  }
  
  // Map
  if (school.latitude && school.longitude) {
    initMap(school.latitude, school.longitude, school.name);
  }
}

// Initialize map
function initMap(lat, lng, schoolName) {
  const mapElement = document.getElementById('schoolMap');
  if (!mapElement || !window.L) return;
  
  const map = L.map('schoolMap').setView([lat, lng], 15);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  L.marker([lat, lng])
    .addTo(map)
    .bindPopup(schoolName)
    .openPopup();
}

// Load performance data
async function loadPerformanceData(urn) {
  try {
    const response = await fetch(`/api/schools/${urn}/performance`);
    const data = await response.json();
    
    if (data.success && data.performance) {
      updatePerformanceData(data.performance);
    }
  } catch (error) {
    console.error('Error loading performance data:', error);
  }
}

// Update performance data
function updatePerformanceData(performance) {
  // This would update any additional performance sections
  // Implementation depends on your specific UI components
}

// Load nearby schools
async function loadNearbySchools(urn) {
  try {
    const response = await fetch(`/api/schools/${urn}/nearby?limit=5`);
    const data = await response.json();
    
    if (data.success && data.nearby_schools) {
      updateNearbySchools(data.nearby_schools);
    }
  } catch (error) {
    console.error('Error loading nearby schools:', error);
  }
}

// Update nearby schools
function updateNearbySchools(schools) {
  const container = document.getElementById('nearbySchools');
  if (!container) return;
  
  if (schools.length === 0) {
    container.innerHTML = '<p>No nearby schools found</p>';
    return;
  }
  
  const html = schools.map(school => {
    const rating = school.overall_rating ? 
      `${Math.round(school.overall_rating)}/10` : 'N/A';
    
    return `
      <div class="nearby-school-item" onclick="window.location.href='/school/${school.urn}'">
        <div class="nearby-school-name">${school.name}</div>
        <div class="nearby-school-info">
          <span>${school.type_of_establishment || 'School'}</span>
          <span>• ${school.postcode || ''}</span>
          <span>• Rating: ${rating}</span>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Update rating display (for school-rating component)
window.updateRatingDisplay = function(schoolData) {
  if (!schoolData) return;
  
  const isScottish = schoolData.country === 'Scotland' || schoolData.is_scotland;
  
  if (!schoolData.overall_rating) {
    document.getElementById('mainRatingScore').textContent = 'N/A';
    document.getElementById('ratingPerformance').innerHTML = 'Insufficient data available for rating';
    document.getElementById('dataNotice').style.display = 'flex';
    document.getElementById('dataNoticeText').textContent = 'Not enough data to calculate rating';
    return;
  }
  
  const rating = parseInt(schoolData.overall_rating);
  const components = schoolData.rating_components || [];
  const percentile = schoolData.rating_percentile;
  
  // Update main rating display
  document.getElementById('mainRatingScore').textContent = rating;
  
  // Set color based on rating
  const scoreBox = document.querySelector('.rating-score-box');
  if (scoreBox) {
    let borderColor = '#6b7280';
    if (rating >= 8) borderColor = '#10b981';
    else if (rating >= 6) borderColor = '#3b82f6';
    else if (rating >= 4) borderColor = '#f59e0b';
    else borderColor = '#ef4444';
    
    scoreBox.style.borderColor = borderColor;
  }
  
  // Update performance text
  let performanceLevel = 'at an average level';
  if (rating >= 8) performanceLevel = 'above average';
  else if (rating >= 6) performanceLevel = 'slightly above average';
  else if (rating <= 4) performanceLevel = 'below average';
  
  document.getElementById('performanceLevel').textContent = performanceLevel;
  document.getElementById('localAuthority').textContent = 
    schoolData.address?.local_authority || schoolData.local_authority || 'the local authority';
  
  // Update percentile
  if (percentile && percentile > 0) {
    document.getElementById('percentileDisplay').style.display = 'flex';
    const topPercent = 100 - percentile;
    document.getElementById('percentileBadge').textContent = `Top ${topPercent}%`;
  }
  
  // Hide Ofsted factor for Scottish schools
  if (isScottish) {
    document.getElementById('ofstedFactor').style.display = 'none';
  }
  
  // Update rating factors
  components.forEach(component => {
    if (component.name === 'ofsted' && !isScottish) {
      document.getElementById('ofstedFactor').style.display = 'block';
      document.getElementById('ofstedScore').textContent = component.score.toFixed(1);
      document.getElementById('ofstedLabel').textContent = component.label || 'Ofsted Rating';
    } else if (component.name === 'academic') {
      document.getElementById('academicFactor').style.display = 'block';
      document.getElementById('academicScore').textContent = component.score.toFixed(1);
      
      // Update weight display for Scotland
      if (isScottish) {
        const weightElement = document.querySelector('#academicFactor .factor-weight');
        if (weightElement) weightElement.textContent = '60% weight';
      }
      
      // Update subject breakdowns
      if (component.details) {
        // Show English and Math
        if (component.details.english) {
          document.getElementById('englishItem').style.display = 'grid';
          document.getElementById('englishValue').textContent = `${component.details.english.school || 0}%`;
          document.getElementById('englishSchoolBar').style.width = `${component.details.english.school || 0}%`;
          document.getElementById('englishLAMarker').style.left = `${component.details.english.la_avg || 50}%`;
        }
        if (component.details.math) {
          document.getElementById('mathItem').style.display = 'grid';
          document.getElementById('mathValue').textContent = `${component.details.math.school || 0}%`;
          document.getElementById('mathSchoolBar').style.width = `${component.details.math.school || 0}%`;
          document.getElementById('mathLAMarker').style.left = `${component.details.math.la_avg || 50}%`;
        }
        // Hide Science for Scottish schools
        if (!isScottish && component.details.science) {
          document.getElementById('scienceItem').style.display = 'grid';
          document.getElementById('scienceValue').textContent = `${component.details.science.school || 0}%`;
          document.getElementById('scienceSchoolBar').style.width = `${component.details.science.school || 0}%`;
          document.getElementById('scienceLAMarker').style.left = `${component.details.science.la_avg || 50}%`;
        } else if (isScottish) {
          const scienceItem = document.getElementById('scienceItem');
          if (scienceItem) scienceItem.style.display = 'none';
        }
      }
    } else if (component.name === 'attendance') {
      document.getElementById('attendanceFactor').style.display = 'block';
      document.getElementById('attendanceScore').textContent = component.score.toFixed(1);
      
      // Update weight display for Scotland
      if (isScottish) {
        const weightElement = document.querySelector('#attendanceFactor .factor-weight');
        if (weightElement) weightElement.textContent = '40% weight';
      }
      
      document.getElementById('attendanceRate').textContent = 
        `${component.school_rate?.toFixed(1) || '-'}% attendance rate`;
    }
  });
  
  // Update data completeness notice
  const completeness = isScottish ? 
    (schoolData.rating_data_completeness || 0) : 
    schoolData.rating_data_completeness;
    
  if (completeness && completeness < 100) {
    document.getElementById('dataNotice').style.display = 'flex';
    document.getElementById('dataNoticeText').textContent = 
      `Rating based on ${completeness}% of available data`;
  }
  
  // Update rating methodology for Scotland
  if (isScottish) {
    const methodology = document.getElementById('ratingMethodology');
    if (methodology) {
      methodology.innerHTML = `
        <h4>How We Calculate Ratings (Scotland)</h4>
        <p>Our rating system evaluates Scottish schools on a 1-10 scale based on available data:</p>
        <ul>
          <li><strong>Academic Performance (60%):</strong> English and Maths scores compared to local authority average</li>
          <li><strong>Attendance (40%):</strong> Student attendance rates compared to local average</li>
        </ul>
        <p class="methodology-note">Schools need at least 50% of data available to receive a rating. Ratings are updated monthly.</p>
      `;
    }
  }
};

// Toggle functions for interactive elements
window.toggleRatingInfo = function() {
  const methodology = document.getElementById('ratingMethodology');
  if (methodology) {
    methodology.style.display = methodology.style.display === 'none' ? 'block' : 'none';
  }
};

window.toggleFactorDetail = function(factor) {
  const breakdown = document.getElementById(`${factor}Breakdown`);
  const btn = breakdown?.previousElementSibling?.querySelector('.expand-btn');
  
  if (breakdown) {
    if (breakdown.style.display === 'none') {
      breakdown.style.display = 'block';
      if (btn) btn.classList.add('expanded');
    } else {
      breakdown.style.display = 'none';
      if (btn) btn.classList.remove('expanded');
    }
  }
};

window.toggleDetails = function(subject) {
  // Implementation for test scores expansion
  console.log('Toggle details for:', subject);
};

window.showSubjectInfo = function(subject) {
  // Implementation for subject info modal
  console.log('Show info for:', subject);
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadSchoolData();
});