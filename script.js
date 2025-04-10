// script.js (Handles search, filters, sorting, pagination, autocomplete, URL state, UX enhancements)

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
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const skeletonLoader = document.querySelector('.skeleton-loader');
const statusMessage = document.getElementById('statusMessage'); // For screen readers

// Input clear buttons
const clearSearchBtn = document.getElementById('clearSearchBtn');
const clearIncludeBtn = document.getElementById('clearIncludeBtn');
const clearExcludeBtn = document.getElementById('clearExcludeBtn');

// Filter Input Elements
const includeIngredientsInput = document.getElementById('includeIngredients');
const excludeIngredientsInput = document.getElementById('excludeIngredients');
const includeSuggestionsContainer = document.getElementById('include-suggestions');
const excludeSuggestionsContainer = document.getElementById('exclude-suggestions');
const cuisineSelect = document.getElementById('cuisineSelect');
const dietSelect = document.getElementById('dietSelect');
const typeSelect = document.getElementById('typeSelect');
const maxReadyTimeInput = document.getElementById('maxReadyTime');
const intoleranceCheckboxes = document.querySelectorAll('input[name="intolerance"]');
const sidebarInputs = document.querySelectorAll('#filterSidebar input, #filterSidebar select'); // For listeners

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
let isLoading = false;
let lastFocusedElement = null; // For sidebar focus management

// --- Debounce Function ---
function debounce(func, delay) { let timeoutId; return function(...args) { clearTimeout(timeoutId); timeoutId = setTimeout(() => { func.apply(this, args); }, delay); }; }

// --- Functions ---

function announceStatus(message) {
    if (statusMessage) {
        statusMessage.textContent = message;
        // Clear after a delay so it can be re-announced later if needed
        setTimeout(() => { statusMessage.textContent = ''; }, 1000);
    }
}

function toggleFilterSidebar() {
    isSidebarOpen = !isSidebarOpen;
    if (isSidebarOpen) {
        lastFocusedElement = document.activeElement; // Store focus before opening
    }
    filterSidebar.hidden = !isSidebarOpen;
    overlay.hidden = !isSidebarOpen;
    document.body.classList.toggle('sidebar-open-overlay', isSidebarOpen);
    filterToggleButton.setAttribute('aria-expanded', isSidebarOpen);

    if (isSidebarOpen) {
        closeFilterSidebarButton.focus(); // Focus close button on open
    } else {
        if (lastFocusedElement) {
            lastFocusedElement.focus(); // Return focus on close
        } else {
            filterToggleButton.focus(); // Fallback
        }
    }
    // updateFilterCount(); // Count updated by debounced listener now
}

const debouncedUpdateFilterCount = debounce(updateFilterCount, 300); // Debounce count update

function updateFilterCount() { /* ... (keep function body as before) ... */
    let count = 0; const activeFilters = getCurrentFilters();
    if (activeFilters.includeIngredients) count++; if (activeFilters.excludeIngredients) count++; if (activeFilters.cuisine) count++; if (activeFilters.diet) count++; if (activeFilters.type) count++; if (activeFilters.maxReadyTime) count++; if (activeFilters.intolerances) count += activeFilters.intolerances.split(',').length;
    if (count > 0) { filterCountBadge.textContent = count; filterCountBadge.style.display = 'inline-block'; filterToggleButton.classList.add('has-filters'); }
    else { filterCountBadge.style.display = 'none'; filterToggleButton.classList.remove('has-filters'); }
}

function getCurrentFilters() { /* ... (keep as before) ... */
    const intolerances = Array.from(document.querySelectorAll('input[name="intolerance"]:checked')).map(cb => cb.value).join(',');
    return { includeIngredients: includeIngredientsInput.value.trim(), excludeIngredients: excludeIngredientsInput.value.trim(), cuisine: cuisineSelect.value, diet: dietSelect.value, type: typeSelect.value, maxReadyTime: maxReadyTimeInput.value.trim(), intolerances: intolerances };
}

function applyCurrentFilters() { currentFilters = getCurrentFilters(); /* Badge updated by listener */ }

function clearAllFilters() { /* ... (keep as before, update visual state) ... */
    includeIngredientsInput.value = ''; excludeIngredientsInput.value = ''; cuisineSelect.value = ''; dietSelect.value = ''; typeSelect.value = ''; maxReadyTimeInput.value = '';
    intoleranceCheckboxes.forEach(cb => cb.checked = false);
    currentFilters = {};
    debouncedUpdateFilterCount();
    toggleClearButtons();
    updateActiveQuickFilters(); // Deactivate quick filters if they were active
    // Focus first filter element after clearing
    if (includeIngredientsInput) includeIngredientsInput.focus();
}

function showFilterAppliedFeedback() { /* ... (keep as before) ... */ }

function showSkeletonLoader() { if (skeletonLoader) skeletonLoader.style.display = 'grid'; searchResultsContainer.innerHTML = ''; /* Ensure no text message */ }
function hideSkeletonLoader() { if (skeletonLoader) skeletonLoader.style.display = 'none'; }

function updateUrlState() { /* ... (keep as before) ... */
    const params = new URLSearchParams(); if (currentSearchQuery) params.set('query', currentSearchQuery); Object.entries(currentFilters).forEach(([key, value]) => { if (value) params.set(key, value); }); if (currentSort !== 'meta-score') params.set('sort', currentSort); if (currentPage > 1) params.set('page', currentPage); const newUrl = `${window.location.pathname}?${params.toString()}`; history.pushState({ query: currentSearchQuery, filters: currentFilters, sort: currentSort, page: currentPage }, '', newUrl);
}

function applyStateFromUrl() { /* ... (keep as before) ... */
    const params = new URLSearchParams(window.location.search); searchInput.value = params.get('query') || ''; includeIngredientsInput.value = params.get('includeIngredients') || ''; excludeIngredientsInput.value = params.get('excludeIngredients') || ''; cuisineSelect.value = params.get('cuisine') || ''; dietSelect.value = params.get('diet') || ''; typeSelect.value = params.get('type') || ''; maxReadyTimeInput.value = params.get('maxReadyTime') || ''; sortSelect.value = params.get('sort') || 'meta-score'; currentPage = parseInt(params.get('page') || '1', 10); const intolerances = params.get('intolerances'); intoleranceCheckboxes.forEach(cb => { cb.checked = intolerances ? intolerances.split(',').includes(cb.value) : false; });
    currentSearchQuery = searchInput.value; currentFilters = getCurrentFilters(); currentSort = sortSelect.value; updateFilterCount(); toggleClearButtons(); updateActiveQuickFilters();
    if (currentSearchQuery || Object.values(currentFilters).some(v => v)) { fetchAndDisplayRecipes(); }
    else { searchResultsContainer.innerHTML = '<p id="initial-placeholder" role="status">Enter search criteria above or use filters to find recipes!</p>'; hideSkeletonLoader(); }
}

function displaySearchError(error) { /* ... (keep as before - already improved) ... */
     console.error("Error fetching recipes from backend:", error); hideSkeletonLoader(); totalResults = 0; updatePaginationControls(); updateFilterCount(); let userMessage = `😕 Sorry, couldn't fetch recipes. An unexpected error occurred.`;
     if (error.message) { const lowerCaseError = error.message.toLowerCase(); if (lowerCaseError.includes('quota') || lowerCaseError.includes('limit') || error.status === 402) { userMessage = "📋 Sorry, the daily recipe lookup limit has been reached. Please try again tomorrow!"; } else if (lowerCaseError.includes('api key') || error.status === 401 || error.status === 403) { userMessage = "🔑 Oops! There seems to be an issue accessing the recipe data. Please contact support."; } else { userMessage = `😕 Sorry, couldn't fetch recipes. Error: ${error.message}.`; } }
     searchResultsContainer.innerHTML = `<p class="no-results-message" role="alert">${userMessage}</p>`; // Added role=alert
     announceStatus(userMessage); // Announce error
}

function startSearch(triggeredByApply = false) { /* ... (keep as before) ... */
    if (isLoading) return; currentSearchQuery = searchInput.value.trim(); currentPage = 1; applyCurrentFilters(); if (triggeredByApply) { showFilterAppliedFeedback(); if (isSidebarOpen) { toggleFilterSidebar(); } } updateUrlState(); fetchAndDisplayRecipes();
}

async function fetchAndDisplayRecipes() { /* ... (keep as before, add announceStatus) ... */
    if (isLoading) return; isLoading = true; showSkeletonLoader(); paginationControls.style.display = 'none'; const offset = (currentPage - 1) * resultsPerPage; const params = new URLSearchParams(); if (currentSearchQuery) params.append('query', currentSearchQuery); Object.entries(currentFilters).forEach(([key, value]) => { if (value) params.append(key, value); }); params.append('sort', currentSort); params.append('number', resultsPerPage); params.append('offset', offset); const fetchUrl = `${backendApiUrl}?${params.toString()}`;
    try { console.log(`Fetching from backend: ${fetchUrl}`); const response = await fetch(fetchUrl); if (!response.ok) { const errorData = await response.json().catch(() => ({})); const error = new Error(errorData.error || `HTTP error! status: ${response.status}`); error.status = response.status; throw error; } const data = await response.json(); totalResults = data.totalResults || 0; hideSkeletonLoader(); displayRecipes(data.results); updatePaginationControls(); announceStatus(totalResults > 0 ? `Loaded ${data.results.length} recipes.` : 'No recipes found.'); // Announce result count
    } catch (error) { displaySearchError(error);
    } finally { isLoading = false; }
    updateFilterCount();
}

function displayRecipes(recipes) { /* ... (Add tooltips to meta spans) ... */
    searchResultsContainer.innerHTML = '';
    if (!recipes || recipes.length === 0) { searchResultsContainer.innerHTML = currentPage === 1 ? '<p class="no-results-message" role="status">😕 No recipes found matching your criteria. Try broadening your search!</p>' : '<p class="no-results-message" role="status">End of results.</p>'; return; }
    recipes.forEach((recipe, index) => {
        const recipeCard = document.createElement('div'); recipeCard.classList.add('recipe-card'); recipeCard.style.animationDelay = `${index * 0.08}s`;
        const link = document.createElement('a'); link.href = `recipe.html?id=${recipe.id}`; link.setAttribute('aria-label', recipe.title); // Accessibility: Card link label
        const image = document.createElement('img'); image.src = recipe.image || 'placeholder.jpg'; image.alt = ''; /* Alt handled by link label */ image.loading = 'lazy'; image.setAttribute('aria-hidden', 'true'); link.appendChild(image);
        const textContentDiv = document.createElement('div'); textContentDiv.classList.add('card-content');
        const title = document.createElement('h3'); title.textContent = recipe.title; title.setAttribute('aria-hidden', 'true'); textContentDiv.appendChild(title);
        const metaInfoDiv = document.createElement('div'); metaInfoDiv.classList.add('card-meta'); metaInfoDiv.setAttribute('aria-hidden', 'true'); // Hide decorative meta from SR
        if (recipe.readyInMinutes) { const t = document.createElement('span'); t.classList.add('card-meta-item', 'time'); t.innerHTML = `<span title="Ready in minutes">⏰</span> ${recipe.readyInMinutes} min`; metaInfoDiv.appendChild(t); }
        if (recipe.servings) { const s = document.createElement('span'); s.classList.add('card-meta-item', 'servings'); s.innerHTML = `<span title="Servings">👥</span> ${recipe.servings} servings`; metaInfoDiv.appendChild(s); }
        if (metaInfoDiv.hasChildNodes()){ textContentDiv.appendChild(metaInfoDiv); }
        const dietaryIconsDiv = document.createElement('div'); dietaryIconsDiv.classList.add('card-dietary-icons'); dietaryIconsDiv.setAttribute('aria-hidden', 'true'); let addedIcon = false;
        if (recipe.vegetarian) { const i=document.createElement('span'); i.classList.add('diet-icon', 'veg'); i.title='Vegetarian'; i.textContent=' V '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (recipe.vegan) { const i=document.createElement('span'); i.classList.add('diet-icon', 'vegan'); i.title='Vegan'; i.textContent=' Vg '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (recipe.glutenFree) { const i=document.createElement('span'); i.classList.add('diet-icon', 'gf'); i.title='Gluten Free'; i.textContent=' GF '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (addedIcon) { textContentDiv.appendChild(dietaryIconsDiv); }
        link.appendChild(textContentDiv);
        recipeCard.appendChild(link);
        searchResultsContainer.appendChild(recipeCard);
    });
}

const handleIngredientAutocomplete = debounce(async (inputElement, suggestionsContainer) => { /* ... (keep as before) ... */ }, 300);

function displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer) { /* ... (Add keyboard nav and focus logic) ... */
    suggestionsContainer.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'listbox'); // ARIA for autocomplete
        ul.id = `${inputElement.id}-listbox`;
        inputElement.setAttribute('aria-controls', ul.id); // Link input to listbox

        suggestions.forEach((suggestion, index) => {
            const li = document.createElement('li');
            li.textContent = suggestion.name;
            li.setAttribute('role', 'option');
            li.id = `${inputElement.id}-option-${index}`;
            li.tabIndex = -1; // Make focusable only via JS/arrow keys

            const suggestionSelectHandler = () => { /* ... (keep existing select logic) ... */
                 const currentValue = inputElement.value.trim(); const parts = currentValue.split(',').map(p => p.trim()).filter(p => p !== '');
                 if (parts.length > 0 && !currentValue.endsWith(',')) { parts[parts.length - 1] = suggestion.name; } else { parts.push(suggestion.name); }
                 inputElement.value = parts.join(', ') + ', ';
                 suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; inputElement.focus();
                 toggleClearButtons(); debouncedUpdateFilterCount();
            };
            li.addEventListener('click', suggestionSelectHandler);
            // No keypress needed here, handled by input's keydown
            ul.appendChild(li);
        });
        suggestionsContainer.appendChild(ul);
        suggestionsContainer.style.display = 'block';
        inputElement.setAttribute('aria-expanded', 'true');
    } else {
        suggestionsContainer.style.display = 'none';
        inputElement.setAttribute('aria-expanded', 'false');
    }
}

// --- Autocomplete Keyboard Navigation ---
function handleAutocompleteKeyDown(event, inputElement, suggestionsContainer) {
    const suggestionsList = suggestionsContainer.querySelector('ul');
    if (!suggestionsList || suggestionsContainer.style.display === 'none') return;

    const options = Array.from(suggestionsList.querySelectorAll('li'));
    if (!options.length) return;

    let currentFocusIndex = options.findIndex(opt => opt === document.activeElement);

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault(); // Prevent cursor move
            currentFocusIndex = (currentFocusIndex + 1) % options.length;
            options[currentFocusIndex].focus();
            inputElement.setAttribute('aria-activedescendant', options[currentFocusIndex].id);
            break;
        case 'ArrowUp':
            event.preventDefault(); // Prevent cursor move
            currentFocusIndex = (currentFocusIndex - 1 + options.length) % options.length;
            options[currentFocusIndex].focus();
            inputElement.setAttribute('aria-activedescendant', options[currentFocusIndex].id);
            break;
        case 'Enter':
             if (currentFocusIndex >= 0) {
                 event.preventDefault(); // Prevent form submission if any
                 options[currentFocusIndex].click(); // Trigger click handler
             }
             // Allow Enter to submit search if suggestion list is closed or no item focused
             break;
        case 'Escape':
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
            inputElement.setAttribute('aria-expanded', 'false');
            inputElement.removeAttribute('aria-activedescendant');
            break;
        case 'Tab':
             // Allow tab to close suggestions naturally
             suggestionsContainer.innerHTML = '';
             suggestionsContainer.style.display = 'none';
             inputElement.setAttribute('aria-expanded', 'false');
             inputElement.removeAttribute('aria-activedescendant');
             break;
    }
}


function updatePaginationControls() { /* ... (keep as before) ... */ }

function handleScroll() { /* ... (keep as before) ... */
    if (!scrollToTopBtn) return; // Guard clause
    if (window.scrollY > 300) { scrollToTopBtn.hidden = false; }
    else { scrollToTopBtn.hidden = true; }
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function setupClearButton(inputElement, clearButton) { /* ... (keep as before) ... */
    if (!inputElement || !clearButton) return; // Guard clauses
    const toggleVisibility = () => { clearButton.hidden = !inputElement.value; };
    inputElement.addEventListener('input', toggleVisibility); inputElement.addEventListener('change', toggleVisibility);
    clearButton.addEventListener('click', () => { inputElement.value = ''; toggleVisibility(); inputElement.focus(); if(inputElement.closest('#filterSidebar')) { debouncedUpdateFilterCount(); } });
    toggleVisibility();
}
function toggleClearButtons() { setupClearButton(searchInput, clearSearchBtn); setupClearButton(includeIngredientsInput, clearIncludeBtn); setupClearButton(excludeIngredientsInput, clearExcludeBtn); }

function updateActiveQuickFilters() { /* ... (keep as before) ... */
    document.querySelectorAll('.quick-filter-tag').forEach(button => {
        const type = button.dataset.filterType; const value = button.dataset.filterValue; let isActive = false;
        if (type === 'cuisine' && currentFilters.cuisine === value) isActive = true; if (type === 'diet' && currentFilters.diet === value) isActive = true; if (type === 'type' && currentFilters.type === value) isActive = true;
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
sidebarInputs.forEach(input => { const eventType = (input.type === 'text' || input.type === 'number') ? 'input' : 'change'; input.addEventListener(eventType, debouncedUpdateFilterCount); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isSidebarOpen) toggleFilterSidebar(); });
sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; currentPage = 1; updateUrlState(); fetchAndDisplayRecipes(); });
prevPageButton.addEventListener('click', () => { if (currentPage > 1) { currentPage--; updateUrlState(); fetchAndDisplayRecipes(); } });
nextPageButton.addEventListener('click', () => { const totalPages = Math.ceil(totalResults / resultsPerPage); if (currentPage < totalPages) { currentPage++; updateUrlState(); fetchAndDisplayRecipes(); } });
quickFiltersContainer.addEventListener('click', (e) => { if (e.target.classList.contains('quick-filter-tag')) { const type = e.target.dataset.filterType; const value = e.target.dataset.filterValue; clearAllFilters(); if (type === 'cuisine') cuisineSelect.value = value; if (type === 'diet') dietSelect.value = value; if (type === 'type') typeSelect.value = value; updateActiveQuickFilters(); startSearch(false); } });
includeIngredientsInput.addEventListener('input', () => handleIngredientAutocomplete(includeIngredientsInput, includeSuggestionsContainer));
excludeIngredientsInput.addEventListener('input', () => handleIngredientAutocomplete(excludeIngredientsInput, excludeSuggestionsContainer));
includeIngredientsInput.addEventListener('blur', () => setTimeout(() => { includeSuggestionsContainer.style.display = 'none'; includeIngredientsInput.setAttribute('aria-expanded', 'false'); }, 150));
excludeIngredientsInput.addEventListener('blur', () => setTimeout(() => { excludeSuggestionsContainer.style.display = 'none'; excludeIngredientsInput.setAttribute('aria-expanded', 'false'); }, 150));
// Autocomplete keydown listeners
includeIngredientsInput.addEventListener('keydown', (e) => handleAutocompleteKeyDown(e, includeIngredientsInput, includeSuggestionsContainer));
excludeIngredientsInput.addEventListener('keydown', (e) => handleAutocompleteKeyDown(e, excludeIngredientsInput, excludeSuggestionsContainer));

window.addEventListener('scroll', handleScroll);
scrollToTopBtn.addEventListener('click', scrollToTop);
window.addEventListener('popstate', (e) => { if (e.state) { currentSearchQuery = e.state.query || ''; currentFilters = e.state.filters || {}; currentSort = e.state.sort || 'meta-score'; currentPage = e.state.page || 1; searchInput.value = currentSearchQuery; includeIngredientsInput.value = currentFilters.includeIngredients || ''; excludeIngredientsInput.value = currentFilters.excludeIngredients || ''; cuisineSelect.value = currentFilters.cuisine || ''; dietSelect.value = currentFilters.diet || ''; typeSelect.value = currentFilters.type || ''; maxReadyTimeInput.value = currentFilters.maxReadyTime || ''; sortSelect.value = currentSort; const intolerances = currentFilters.intolerances || ''; intoleranceCheckboxes.forEach(cb => { cb.checked = intolerances.split(',').includes(cb.value); }); updateFilterCount(); toggleClearButtons(); updateActiveQuickFilters(); fetchAndDisplayRecipes(); } else { applyStateFromUrl(); } });

// --- Initial Load ---
applyStateFromUrl(); // Load state from URL or set initial state
toggleClearButtons(); // Initial check for clear buttons
