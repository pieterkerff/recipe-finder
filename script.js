// script.js (Handles search, filters via SIDEBAR, sorting, pagination, autocomplete, URL state, etc.)

// --- DOM Elements ---
const searchResultsContainer = document.getElementById('recipe-results');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const filterToggleButton = document.getElementById('filterToggleButton');
const filterSidebar = document.getElementById('filterSidebar');
const closeFilterSidebarButton = document.getElementById('closeFilterSidebarButton');
const overlay = document.getElementById('overlay');
const applyFiltersButton = document.getElementById('applyFiltersButton');
const clearFiltersButton = document.getElementById('clearFiltersButton');
const filterCountBadge = document.getElementById('filter-count-badge');
const sortSelect = document.getElementById('sortSelect');
const quickFiltersContainer = document.querySelector('.quick-filters');
const paginationControls = document.getElementById('pagination-controls');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfoSpan = document.getElementById('page-info');
const scrollToTopBtn = document.getElementById('scrollToTopBtn'); // NEW
const skeletonLoader = document.querySelector('.skeleton-loader'); // NEW

// Input clear buttons
const clearSearchBtn = document.getElementById('clearSearchBtn');
const clearIncludeBtn = document.getElementById('clearIncludeBtn');
const clearExcludeBtn = document.getElementById('clearExcludeBtn');

// Filter Input Elements (inside sidebar)
const includeIngredientsInput = document.getElementById('includeIngredients');
const excludeIngredientsInput = document.getElementById('excludeIngredients');
const includeSuggestionsContainer = document.getElementById('include-suggestions');
const excludeSuggestionsContainer = document.getElementById('exclude-suggestions');
const cuisineSelect = document.getElementById('cuisineSelect');
const dietSelect = document.getElementById('dietSelect');
const typeSelect = document.getElementById('typeSelect');
const maxReadyTimeInput = document.getElementById('maxReadyTime');
const intoleranceCheckboxes = document.querySelectorAll('input[name="intolerance"]');

// --- API Configuration ---
// !!! IMPORTANT: Replace with YOUR deployed backend URL !!!
const backendBaseUrl = 'https://azealle-recipe-finder.onrender.com/api'; // e.g., 'https://my-recipe-backend.onrender.com/api'
// !!! Make sure it's HTTPS !!!
const backendApiUrl = `${backendBaseUrl}/recipes`;
const autocompleteUrl = `${backendBaseUrl}/ingredient-autocomplete`;

// --- State ---
let isSidebarOpen = false;
let currentSearchQuery = '';
let currentFilters = {};
let currentSort = 'meta-score';
let currentPage = 1;
const resultsPerPage = 12;
let totalResults = 0;
let autocompleteAbortController = null;
let isLoading = false; // Flag to prevent multiple simultaneous fetches

// --- Debounce Function ---
function debounce(func, delay) { /* ... (keep debounce function as before) ... */
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- Functions ---

function toggleFilterSidebar() { /* ... (keep as before) ... */
    isSidebarOpen = !isSidebarOpen;
    filterSidebar.hidden = !isSidebarOpen;
    overlay.hidden = !isSidebarOpen;
    document.body.classList.toggle('sidebar-open-overlay', isSidebarOpen);
    filterToggleButton.setAttribute('aria-expanded', isSidebarOpen);
    if (isSidebarOpen) { closeFilterSidebarButton.focus(); }
    else { filterToggleButton.focus(); }
    // No need to call updateFilterCount here, it's debounced on input/change
}

// Debounced version for instant feedback
const debouncedUpdateFilterCount = debounce(updateFilterCount, 250);

function updateFilterCount() {
    let count = 0;
    const activeFilters = getCurrentFilters();
    if (activeFilters.includeIngredients) count++;
    if (activeFilters.excludeIngredients) count++;
    if (activeFilters.cuisine) count++;
    if (activeFilters.diet) count++;
    if (activeFilters.type) count++;
    if (activeFilters.maxReadyTime) count++;
    if (activeFilters.intolerances) count += activeFilters.intolerances.split(',').length;

    if (count > 0) {
        filterCountBadge.textContent = count;
        filterCountBadge.style.display = 'inline-block';
        filterToggleButton.classList.add('has-filters');
    } else {
        filterCountBadge.style.display = 'none';
        filterToggleButton.classList.remove('has-filters');
    }
}

function getCurrentFilters() { /* ... (keep as before) ... */
    const intolerances = Array.from(document.querySelectorAll('input[name="intolerance"]:checked')).map(cb => cb.value).join(',');
    return {
        includeIngredients: includeIngredientsInput.value.trim(),
        excludeIngredients: excludeIngredientsInput.value.trim(),
        cuisine: cuisineSelect.value,
        diet: dietSelect.value,
        type: typeSelect.value,
        maxReadyTime: maxReadyTimeInput.value.trim(),
        intolerances: intolerances
    };
}

function applyCurrentFilters() { /* ... (keep as before) ... */
    currentFilters = getCurrentFilters();
    // No need to call updateFilterCount here
}

function clearAllFilters() { /* ... (keep as before, maybe trigger state update) ... */
    includeIngredientsInput.value = '';
    excludeIngredientsInput.value = '';
    cuisineSelect.value = '';
    dietSelect.value = '';
    typeSelect.value = '';
    maxReadyTimeInput.value = '';
    intoleranceCheckboxes.forEach(cb => cb.checked = false);
    currentFilters = {};
    debouncedUpdateFilterCount(); // Update count after clearing
    toggleClearButtons(); // Hide clear buttons
}

function showFilterAppliedFeedback() { /* ... (keep as before) ... */
    filterToggleButton.classList.add('filter-applied-pulse');
    setTimeout(() => { filterToggleButton.classList.remove('filter-applied-pulse'); }, 600);
}

// Show/Hide Skeleton Loader
function showSkeletonLoader() {
    if (skeletonLoader) skeletonLoader.style.display = 'grid';
    searchResultsContainer.innerHTML = ''; // Clear previous actual results if any
}
function hideSkeletonLoader() {
    if (skeletonLoader) skeletonLoader.style.display = 'none';
}

// Function to update URL with current state
function updateUrlState() {
    const params = new URLSearchParams();
    if (currentSearchQuery) params.set('query', currentSearchQuery);
    Object.entries(currentFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    if (currentSort !== 'meta-score') params.set('sort', currentSort); // Only add if not default
    if (currentPage > 1) params.set('page', currentPage);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState({ // Push state for back/forward navigation
        query: currentSearchQuery,
        filters: currentFilters,
        sort: currentSort,
        page: currentPage
    }, '', newUrl);
}

// Function to apply state from URL parameters on load
function applyStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    searchInput.value = params.get('query') || '';
    includeIngredientsInput.value = params.get('includeIngredients') || '';
    excludeIngredientsInput.value = params.get('excludeIngredients') || '';
    cuisineSelect.value = params.get('cuisine') || '';
    dietSelect.value = params.get('diet') || '';
    typeSelect.value = params.get('type') || '';
    maxReadyTimeInput.value = params.get('maxReadyTime') || '';
    sortSelect.value = params.get('sort') || 'meta-score'; // Default sort
    currentPage = parseInt(params.get('page') || '1', 10);

    const intolerances = params.get('intolerances');
    intoleranceCheckboxes.forEach(cb => {
        cb.checked = intolerances ? intolerances.split(',').includes(cb.value) : false;
    });

    // Set initial state variables
    currentSearchQuery = searchInput.value;
    currentFilters = getCurrentFilters(); // Read filters from DOM after setting them
    currentSort = sortSelect.value;

    updateFilterCount(); // Update badge based on loaded state
    toggleClearButtons(); // Show/hide clear buttons based on loaded state
    updateActiveQuickFilters(); // Highlight active quick filters based on state

    // Fetch results if there's a query or filters applied from URL
    if (currentSearchQuery || Object.values(currentFilters).some(v => v)) {
         fetchAndDisplayRecipes();
    } else {
        // Optional: Display an initial message if no search params
         searchResultsContainer.innerHTML = '<p id="initial-placeholder">Enter search criteria above or use filters to find recipes!</p>';
         hideSkeletonLoader(); // Ensure skeleton is hidden
    }
}

// Function to handle clearer error display
function displaySearchError(error) {
     console.error("Error fetching recipes from backend:", error);
     hideSkeletonLoader(); // Hide skeleton on error too
     totalResults = 0;
     updatePaginationControls();
     updateFilterCount();

     let userMessage = `😕 Sorry, couldn't fetch recipes. An unexpected error occurred.`; // Default
     if (error.message) {
         const lowerCaseError = error.message.toLowerCase();
         if (lowerCaseError.includes('quota') || lowerCaseError.includes('limit')) {
             userMessage = "📋 Sorry, the daily recipe lookup limit has been reached. Please try again tomorrow!";
         } else if (lowerCaseError.includes('api key') || error.status === 401 || error.status === 403) {
             userMessage = "🔑 Oops! There seems to be an issue with accessing the recipe data. Please contact support."; // Avoid exposing API key issues directly
         } else if (error.status === 402) {
              userMessage = "📋 Sorry, the daily recipe lookup limit has been reached. Please try again tomorrow!";
         } else {
              // Use the message from backend if not sensitive, otherwise keep default
              userMessage = `😕 Sorry, couldn't fetch recipes. Error: ${error.message}.`;
         }
     }
     searchResultsContainer.innerHTML = `<p class="no-results-message">${userMessage}</p>`;
}


// Main function to initiate a search (resets page, applies filters)
function startSearch(triggeredByApply = false) {
    if (isLoading) return; // Prevent multiple searches at once

    currentSearchQuery = searchInput.value.trim();
    currentPage = 1;
    applyCurrentFilters(); // Store the currently selected filters

    if (triggeredByApply) {
        showFilterAppliedFeedback();
        if (isSidebarOpen) { toggleFilterSidebar(); }
    }
    updateUrlState(); // Update URL when search starts
    fetchAndDisplayRecipes(); // Fetch the first page
}

// Function to fetch recipes for the current state (page, filters, sort)
async function fetchAndDisplayRecipes() {
    if (isLoading) return; // Prevent concurrent fetches
    isLoading = true;
    showSkeletonLoader(); // Show skeleton loader
    paginationControls.style.display = 'none';

    const offset = (currentPage - 1) * resultsPerPage;
    const params = new URLSearchParams();
    if (currentSearchQuery) params.append('query', currentSearchQuery);
    Object.entries(currentFilters).forEach(([key, value]) => { if (value) params.append(key, value); });
    params.append('sort', currentSort);
    params.append('number', resultsPerPage);
    params.append('offset', offset);

    const fetchUrl = `${backendApiUrl}?${params.toString()}`;

    try {
        console.log(`Fetching from backend: ${fetchUrl}`);
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Add status to error object if possible
            const error = new Error(errorData.error || `HTTP error! status: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        const data = await response.json();
        totalResults = data.totalResults || 0;
        hideSkeletonLoader(); // Hide loader before displaying results
        displayRecipes(data.results);
        updatePaginationControls();
        // Don't update URL here, update it when search *starts* or page changes

    } catch (error) {
         displaySearchError(error); // Use centralized error display
    } finally {
        isLoading = false; // Allow new fetches
    }
    updateFilterCount();
}

// Function to display recipes cards
function displayRecipes(recipes) { /* ... (Keep card creation logic, ensure tooltips are added) ... */
    searchResultsContainer.innerHTML = ''; // Clear loading/previous

    if (!recipes || recipes.length === 0) {
        searchResultsContainer.innerHTML = currentPage === 1
            ? '<p class="no-results-message">😕 No recipes found matching your criteria. Try broadening your search!</p>'
            : '<p class="no-results-message">End of results.</p>';
        return;
    }

    recipes.forEach((recipe, index) => {
        const recipeCard = document.createElement('div');
        recipeCard.classList.add('recipe-card');
        recipeCard.style.animationDelay = `${index * 0.08}s`;
        const link = document.createElement('a'); link.href = `recipe.html?id=${recipe.id}`;
        const image = document.createElement('img'); image.src = recipe.image || 'placeholder.jpg'; image.alt = recipe.title; image.loading = 'lazy'; link.appendChild(image);
        const textContentDiv = document.createElement('div'); textContentDiv.classList.add('card-content');
        const title = document.createElement('h3'); title.textContent = recipe.title; textContentDiv.appendChild(title);
        const metaInfoDiv = document.createElement('div'); metaInfoDiv.classList.add('card-meta');
        if (recipe.readyInMinutes) { const t = document.createElement('span'); t.classList.add('card-meta-item', 'time'); t.innerHTML = `<span title="Ready in minutes">⏰</span> ${recipe.readyInMinutes} min`; metaInfoDiv.appendChild(t); }
        if (recipe.servings) { const s = document.createElement('span'); s.classList.add('card-meta-item', 'servings'); s.innerHTML = `<span title="Servings">👥</span> ${recipe.servings} servings`; metaInfoDiv.appendChild(s); }
        if (metaInfoDiv.hasChildNodes()){ textContentDiv.appendChild(metaInfoDiv); }
        const dietaryIconsDiv = document.createElement('div'); dietaryIconsDiv.classList.add('card-dietary-icons'); let addedIcon = false;
        if (recipe.vegetarian) { const i=document.createElement('span'); i.classList.add('diet-icon', 'veg'); i.title='Vegetarian'; i.textContent=' V '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (recipe.vegan) { const i=document.createElement('span'); i.classList.add('diet-icon', 'vegan'); i.title='Vegan'; i.textContent=' Vg '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (recipe.glutenFree) { const i=document.createElement('span'); i.classList.add('diet-icon', 'gf'); i.title='Gluten Free'; i.textContent=' GF '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (addedIcon) { textContentDiv.appendChild(dietaryIconsDiv); }
        link.appendChild(textContentDiv);
        recipeCard.appendChild(link);
        searchResultsContainer.appendChild(recipeCard);
    });
}

// --- Autocomplete Functions ---
const handleIngredientAutocomplete = debounce(async (inputElement, suggestionsContainer) => { /* ... (keep as before) ... */
    const query = inputElement.value.trim().split(',').pop().trim(); // Autocomplete last typed ingredient
    suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none';
    if (query.length < 2) return;
    if (autocompleteAbortController) autocompleteAbortController.abort();
    autocompleteAbortController = new AbortController(); const signal = autocompleteAbortController.signal;
    try {
        const response = await fetch(`${autocompleteUrl}?query=${encodeURIComponent(query)}`, { signal });
        if (!response.ok) { throw new Error('Autocomplete fetch failed'); }
        const suggestions = await response.json();
        displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer);
    } catch (error) { if (error.name !== 'AbortError') console.error("Error fetching autocomplete:", error); }
}, 300);

function displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer) { /* ... (keep as before) ... */
    suggestionsContainer.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        const ul = document.createElement('ul');
        suggestions.forEach(suggestion => {
            const li = document.createElement('li'); li.textContent = suggestion.name;
            li.tabIndex = 0; // Make focusable
            const suggestionSelectHandler = () => {
                 const currentValue = inputElement.value.trim(); const parts = currentValue.split(',').map(p => p.trim()).filter(p => p !== '');
                 if (parts.length > 0 && !currentValue.endsWith(',')) { parts[parts.length - 1] = suggestion.name; } else { parts.push(suggestion.name); }
                 inputElement.value = parts.join(', ') + ', ';
                 suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; inputElement.focus();
                 toggleClearButtons(); // Update clear button state
                 debouncedUpdateFilterCount(); // Update filter count
            };
            li.addEventListener('click', suggestionSelectHandler);
            li.addEventListener('keypress', (e) => { if(e.key === 'Enter') suggestionSelectHandler(); })
            ul.appendChild(li);
        });
        suggestionsContainer.appendChild(ul); suggestionsContainer.style.display = 'block';
    } else { suggestionsContainer.style.display = 'none'; }
}

// --- Pagination Update Function ---
function updatePaginationControls() { /* ... (keep as before) ... */
    if (totalResults <= resultsPerPage) { paginationControls.style.display = 'none'; return; }
    paginationControls.style.display = 'flex';
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageButton.disabled = (currentPage === 1);
    nextPageButton.disabled = (currentPage === totalPages);
}

// --- Scroll-to-Top Functionality ---
function handleScroll() {
    if (window.scrollY > 300) { // Show button after scrolling down 300px
        scrollToTopBtn.hidden = false;
    } else {
        scrollToTopBtn.hidden = true;
    }
}
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Clear Input Button Functionality ---
function setupClearButton(inputElement, clearButton) {
    const toggleVisibility = () => {
        clearButton.hidden = !inputElement.value;
    };
    inputElement.addEventListener('input', toggleVisibility);
    // Handle case where input is pre-filled from URL state
    inputElement.addEventListener('change', toggleVisibility); // For selects/checkboxes too if needed
    clearButton.addEventListener('click', () => {
        inputElement.value = '';
        toggleVisibility(); // Hide button immediately
        inputElement.focus(); // Return focus
        // Trigger filter count update if it's a filter input
        if(inputElement.closest('#filterSidebar')) {
            debouncedUpdateFilterCount();
        }
    });
    toggleVisibility(); // Initial check
}
// Helper to call setup for all clear buttons
function toggleClearButtons() {
    setupClearButton(searchInput, clearSearchBtn);
    setupClearButton(includeIngredientsInput, clearIncludeBtn);
    setupClearButton(excludeIngredientsInput, clearExcludeBtn);
}

// --- Update Active Quick Filters ---
function updateActiveQuickFilters() {
    document.querySelectorAll('.quick-filter-tag').forEach(button => {
        const type = button.dataset.filterType;
        const value = button.dataset.filterValue;
        let isActive = false;
        if (type === 'cuisine' && currentFilters.cuisine === value) isActive = true;
        if (type === 'diet' && currentFilters.diet === value) isActive = true;
        if (type === 'type' && currentFilters.type === value) isActive = true;
        button.classList.toggle('active', isActive);
    });
}


// --- Event Listeners ---
searchButton.addEventListener('click', () => startSearch(false));
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') startSearch(false); });
filterToggleButton.addEventListener('click', toggleFilterSidebar);
closeFilterSidebarButton.addEventListener('click', toggleFilterSidebar);
overlay.addEventListener('click', toggleFilterSidebar);
applyFiltersButton.addEventListener('click', () => startSearch(true));
clearFiltersButton.addEventListener('click', clearAllFilters);
// Debounced filter count update
document.querySelectorAll('#filterSidebar input, #filterSidebar select').forEach(input => {
    const eventType = (input.type === 'text' || input.type === 'number') ? 'input' : 'change';
    input.addEventListener(eventType, debouncedUpdateFilterCount);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isSidebarOpen) toggleFilterSidebar(); });
sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; currentPage = 1; updateUrlState(); fetchAndDisplayRecipes(); }); // Update URL on sort change
prevPageButton.addEventListener('click', () => { if (currentPage > 1) { currentPage--; updateUrlState(); fetchAndDisplayRecipes(); } }); // Update URL on page change
nextPageButton.addEventListener('click', () => { const totalPages = Math.ceil(totalResults / resultsPerPage); if (currentPage < totalPages) { currentPage++; updateUrlState(); fetchAndDisplayRecipes(); } }); // Update URL on page change
quickFiltersContainer.addEventListener('click', (e) => { if (e.target.classList.contains('quick-filter-tag')) { const type = e.target.dataset.filterType; const value = e.target.dataset.filterValue; clearAllFilters(); // Clear others when using quick filter
    if (type === 'cuisine') cuisineSelect.value = value; if (type === 'diet') dietSelect.value = value; if (type === 'type') typeSelect.value = value;
    updateActiveQuickFilters(); // Update visual state immediately
    startSearch(false); } });
includeIngredientsInput.addEventListener('input', () => handleIngredientAutocomplete(includeIngredientsInput, includeSuggestionsContainer));
excludeIngredientsInput.addEventListener('input', () => handleIngredientAutocomplete(excludeIngredientsInput, excludeSuggestionsContainer));
includeIngredientsInput.addEventListener('blur', () => setTimeout(() => { includeSuggestionsContainer.style.display = 'none'; }, 150));
excludeIngredientsInput.addEventListener('blur', () => setTimeout(() => { excludeSuggestionsContainer.style.display = 'none'; }, 150));
// Scroll listener for scroll-to-top button
window.addEventListener('scroll', handleScroll);
scrollToTopBtn.addEventListener('click', scrollToTop);
// Listener for back/forward navigation
window.addEventListener('popstate', (event) => {
    console.log("Popstate event:", event.state);
    if (event.state) {
        // Restore state from history
        currentSearchQuery = event.state.query || '';
        currentFilters = event.state.filters || {};
        currentSort = event.state.sort || 'meta-score';
        currentPage = event.state.page || 1;

        // Update UI elements to reflect restored state
        searchInput.value = currentSearchQuery;
        includeIngredientsInput.value = currentFilters.includeIngredients || '';
        excludeIngredientsInput.value = currentFilters.excludeIngredients || '';
        cuisineSelect.value = currentFilters.cuisine || '';
        dietSelect.value = currentFilters.diet || '';
        typeSelect.value = currentFilters.type || '';
        maxReadyTimeInput.value = currentFilters.maxReadyTime || '';
        sortSelect.value = currentSort;
        const intolerances = currentFilters.intolerances || '';
        intoleranceCheckboxes.forEach(cb => { cb.checked = intolerances.split(',').includes(cb.value); });

        updateFilterCount();
        toggleClearButtons();
        updateActiveQuickFilters();
        fetchAndDisplayRecipes(); // Refetch results for the restored state
    } else {
        // Handle initial page load or state where event.state is null
        applyStateFromUrl(); // Re-apply based on URL in case state is missing
    }
});

// --- Initial Load ---
applyStateFromUrl(); // Load state from URL on initial load
